import { SlotGrid } from "@/components/SlotGrid";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings";
import { PAYMENT_APPS, buildUpiLink, hourLabel, nextDays, rupees, slotRange, todayISO } from "@/lib/turf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/slots")({
  component: AdminSlots,
});

type Turf = {
  id: string;
  name: string;
  price_per_hour: number;
  advance_percent: number;
  open_hour: number;
  close_hour: number;
  upi_id: string | null;
  payee_name: string | null;
};

function AdminSlots() {
  const { data: user } = useAuthUser();
  const queryClient = useQueryClient();
  const [turfId, setTurfId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [hour, setHour] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentType, setPaymentType] = useState<"half" | "full">("full");
  const [busy, setBusy] = useState(false);

  const { data: turfs } = useQuery({
    queryKey: ["admin-turfs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turfs")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Turf[];
    },
  });

  useEffect(() => {
    if (!turfId && turfs?.length) setTurfId(turfs[0].id);
  }, [turfs, turfId]);

  const turf = turfs?.find((t) => t.id === turfId);

  const { data: bookedHours } = useQuery({
    queryKey: ["booked", turfId, date],
    enabled: !!turfId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booked_slots", {
        p_turf_id: turfId,
        p_date: date,
      });
      if (error) throw error;
      return (data ?? []).map((r: { slot_hour: number }) => r.slot_hour);
    },
  });

  const total = Number(turf?.price_per_hour ?? 0);
  const advance = Math.round((total * (turf?.advance_percent ?? 50)) / 100);
  const payable = paymentType === "half" ? advance : total;

  const book = async (method: string, scheme?: string) => {
    if (!turf || hour === null) return;
    if (name.trim().length < 2) {
      toast.error("Enter the customer's name");
      return;
    }
    setBusy(true);
    const result = await createBooking({
      turf_id: turf.id,
      booking_date: date,
      slot_hour: hour,
      amount_total: total,
      amount_paid: payable,
      payment_type: paymentType,
      payment_method: method,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      created_by_admin: true,
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["booked", turf.id] });
    queryClient.invalidateQueries({ queryKey: ["owner-bookings"] });
    setSheet(false);
    setHour(null);
    setName("");
    setPhone("");
    toast.success("Slot booked — it now shows as red for players.");
    if (scheme && turf.upi_id) {
      window.location.href = buildUpiLink({
        scheme,
        upiId: turf.upi_id,
        payeeName: turf.payee_name || turf.name,
        amount: payable,
        note: `${turf.name} ${date} ${hourLabel(hour)}`,
      });
    }
  };

  const slots = turf ? slotRange(turf.open_hour, turf.close_hour) : [];

  return (
    <main className="px-4 py-6">
      <h1 className="text-3xl leading-none">SLOTS</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Green is free, red is booked. Tap a free slot to book a walk-in customer.
      </p>

      {!turfs?.length ? (
        <div className="card-surface mt-5 p-8 text-center text-sm text-muted-foreground">
          Add a turf first to manage slots.
        </div>
      ) : (
        <>
          <select
            value={turfId}
            onChange={(e) => {
              setTurfId(e.target.value);
              setHour(null);
            }}
            className="mt-4 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          >
            {turfs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {nextDays(7).map((d) => (
              <button
                key={d.iso}
                onClick={() => {
                  setDate(d.iso);
                  setHour(null);
                }}
                className={`flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 ${
                  date === d.iso
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                <span className="text-[11px] uppercase">{d.day}</span>
                <span className="text-lg font-bold leading-none">{d.date}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <SlotGrid
              slots={slots}
              booked={new Set(bookedHours ?? [])}
              selected={hour}
              onSelect={(h) => {
                setHour(h);
                setSheet(true);
              }}
              date={date}
            />
          </div>
        </>
      )}

      {sheet && hour !== null && turf && (
        <div className="fixed inset-0 z-40 flex items-end bg-background/70 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">BOOK {hourLabel(hour)}</h2>
              <button onClick={() => setSheet(false)} aria-label="Close">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={15}
                  inputMode="tel"
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["half", "full"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`card-surface p-3 text-left ${paymentType === type ? "border-primary" : ""}`}
                >
                  <span className="block font-display text-xl uppercase leading-none">{type}</span>
                  <span className="mt-1 block text-sm font-bold text-primary">
                    {rupees(type === "half" ? advance : total)}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              {PAYMENT_APPS.map((app) => (
                <button
                  key={app.id}
                  disabled={busy}
                  onClick={() => book(app.id, app.scheme)}
                  className="card-surface flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-60"
                >
                  <Wallet className="size-5 text-primary" />
                  <span className="flex-1 text-sm font-semibold">{app.label}</span>
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => book("cash")}
                className="card-surface flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-60"
              >
                <Banknote className="size-5 text-accent" />
                <span className="flex-1 text-sm font-semibold">Cash on delivery</span>
              </button>
            </div>

            <Button variant="outline" className="mt-4 w-full" onClick={() => setSheet(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

