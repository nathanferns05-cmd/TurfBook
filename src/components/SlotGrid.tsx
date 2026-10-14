import { hourLabel } from "@/lib/turf";

export function SlotGrid({
  slots,
  booked,
  selected,
  onSelect,
  date,
}: {
  slots: number[];
  booked: Set<number>;
  selected?: number | null;
  onSelect?: (hour: number) => void;
  date: string;
}) {
  const now = new Date();
  const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {slots.map((hour) => {
        const isBooked = booked.has(hour);
        const isPast = isToday && hour <= now.getHours();
        const disabled = isBooked || isPast;
        const isSelected = selected === hour;

        return (
          <button
            key={hour}
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(hour)}
            className={[
              "rounded-xl border px-3 py-3 text-left transition-all",
              isSelected
                ? "border-primary bg-primary text-primary-foreground glow"
                : isBooked
                  ? "border-destructive/40 bg-destructive/12 text-destructive"
                  : isPast
                    ? "border-border bg-muted/40 text-muted-foreground"
                    : "border-success/40 bg-success/12 text-success active:scale-[0.97]",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold">{hourLabel(hour)}</span>
            <span className="block text-[11px] uppercase tracking-wider opacity-80">
              {isBooked ? "Booked" : isPast ? "Passed" : "Available"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

