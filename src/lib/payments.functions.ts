import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderInput = z.object({
  turf_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot_hour: z.number().int().min(0).max(23),
  payment_type: z.enum(["half", "full"]),
  customer_name: z.string().trim().max(80).default(""),
  customer_phone: z.string().trim().max(20).default(""),
});

/**
 * Creates the booking in `pending` state (amounts are computed by database
 * triggers) and opens a Razorpay order for exactly that amount.
 */
export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { createRazorpayOrder, razorpayCreds } = await import("@/lib/payments.server");
    const { keyId } = razorpayCreds();

    const { data: booking, error } = await context.supabase
      .from("bookings")
      .insert({
        turf_id: data.turf_id,
        user_id: context.userId,
        booking_date: data.booking_date,
        slot_hour: data.slot_hour,
        payment_type: data.payment_type,
        payment_method: "razorpay",
        amount_total: 0,
        amount_paid: 0,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
      })
      .select("id, amount_paid, amount_total")
      .single();

    if (error || !booking) {
      const message = error?.message ?? "Could not hold this slot.";
      if (error?.code === "23505" || /duplicate|unique/i.test(message)) {
        throw new Error("That slot was just taken. Please pick another time.");
      }
      throw new Error(message);
    }

    const amountPaise = Math.round(Number(booking.amount_paid) * 100);

    try {
      const order = await createRazorpayOrder({
        amountPaise,
        receipt: booking.id,
        notes: { booking_id: booking.id, turf_id: data.turf_id },
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ razorpay_order_id: order.id })
        .eq("id", booking.id);

      return {
        bookingId: booking.id,
        orderId: order.id,
        amount: order.amount,
        keyId,
        amountPaid: Number(booking.amount_paid),
        amountTotal: Number(booking.amount_total),
      };
    } catch (e) {
      // No order = no way to pay, so release the held slot immediately.
      await context.supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      throw e;
    }
  });

const verifyInput = z.object({
  bookingId: z.string().uuid(),
  razorpay_order_id: z.string().min(4),
  razorpay_payment_id: z.string().min(4),
  razorpay_signature: z.string().min(8),
});

/**
 * Confirms a booking ONLY after the checkout signature is valid and Razorpay
 * itself reports the payment as captured for the right order and amount.
 */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verifyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { verifyCheckoutSignature, fetchRazorpayPayment } = await import(
      "@/lib/payments.server"
    );

    const { data: booking } = await context.supabase
      .from("bookings")
      .select("id, amount_paid, razorpay_order_id, status")
      .eq("id", data.bookingId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!booking) throw new Error("Booking not found.");
    if (booking.razorpay_order_id !== data.razorpay_order_id) {
      throw new Error("Payment does not match this booking.");
    }

    const valid = await verifyCheckoutSignature({
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    });
    if (!valid) throw new Error("Payment could not be verified.");

    const payment = await fetchRazorpayPayment(data.razorpay_payment_id);
    const expectedPaise = Math.round(Number(booking.amount_paid) * 100);
    if (
      payment.order_id !== data.razorpay_order_id ||
      payment.amount !== expectedPaise ||
      !["captured", "authorized"].includes(payment.status)
    ) {
      throw new Error("Payment was not completed.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "confirmed",
        razorpay_payment_id: payment.id,
        payment_method: payment.method ?? "razorpay",
      })
      .eq("id", booking.id);
    if (error) throw new Error(error.message);

    return { status: "confirmed" as const };
  });

/** Releases a held slot when the player abandons or fails the payment. */
export const abandonBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    return { ok: true };
  });

