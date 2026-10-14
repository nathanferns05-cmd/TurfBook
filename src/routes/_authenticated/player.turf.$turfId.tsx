import { SlotGrid } from "@/components/SlotGrid";
import { TurfImage } from "@/components/TurfImage";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { hourLabel, nextDays, rupees, slotRange, todayISO } from "@/lib/turf";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/player/turf/$turfId")({
  component: TurfSlots,
});

function TurfSlots() {
  const { turfId } = useParams({ from: "/_authenticated/player/turf/$turfId" });
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [hour, setHour] = useState<number | null>(null);
  const days = nextDays(7);

  const { data: turf } = useQuery({
    queryKey: ["turf", turfId],
    queryFn: async () => {
      const { data, error } = await supabase.from("turfs").select("*").eq("id", turfId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookedHours } = useQuery({
    queryKey: ["booked", turfId, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booked_slots", {
        p_turf_id: turfId,
        p_date: date,
      });
      if (error) throw error;
      return (data ?? []).map((row: { slot_hour: number }) => row.slot_hour);
    },
  });

  const slots = turf ? slotRange(turf.open_hour, turf.close_hour) : [];
  const booked = new Set<number>(bookedHours ?? []);

  return (
    <main className="px-4 py-6">
      <Link
        to="/player"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>

      {turf?.image_url && (
        <TurfImage
          path={turf.image_url}
          alt={turf.name}
          className="mt-4 h-44 w-full rounded-2xl object-cover"
        />
      )}

      <h1 className="mt-4 text-3xl leading-none">{(turf?.name ?? "TURF").toUpperCase()}</h1>
      <p className="mt-1.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="size-4" /> {turf?.address || turf?.location}
      </p>
      {turf && (
        <p className="mt-1 text-sm">
          <span className="font-bold text-primary">{rupees(Number(turf.price_per_hour))}</span>
          <span className="text-muted-foreground"> per slot · {turf.advance_percent}% advance</span>
        </p>
      )}
      {!!turf?.amenities?.length && (

<div className="mt-3 flex flex-wrap gap-1.5">
          {turf.amenities.map((a: string) => (
            <span
              key={a}
              className="rounded-full bg-secondary px-3 py-1 text-[11px] text-secondary-foreground"
            >
              {a}
            </span>
          ))}
        </div>
      )}


      <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Select date
      </h2>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => {
              setDate(d.iso);
              setHour(null);
            }}
            className={`flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 ${
              date === d.iso
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            <span className="text-[11px] uppercase">{d.day}</span>
            <span className="text-lg font-bold leading-none">{d.date}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Time slots
        </h2>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-success" /> Available
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-destructive" /> Booked
          </span>
        </div>
      </div>

      <div className="mt-3">
        <SlotGrid slots={slots} booked={booked} selected={hour} onSelect={setHour} date={date} />
      </div>

      {hour !== null && (
        <div className="fixed inset-x-0 bottom-[72px] z-20 border-t border-border bg-card/95 p-4 backdrop-blur-lg">
          <p className="text-sm">
            Book <span className="font-semibold text-primary">{hourLabel(hour)}</span> on{" "}
            {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}?
          </p>
          <Button
            className="mt-3 h-12 w-full text-base font-semibold"
            onClick={() =>
              navigate({
                to: "/player/book/$turfId",
                params: { turfId },
                search: { date, hour },
              })
            }
          >
            Continue booking
          </Button>
        </div>
      )}
    </main>
  );
}

