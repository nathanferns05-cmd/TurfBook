import { TurfImage } from "@/components/TurfImage";
import { supabase } from "@/integrations/supabase/client";
import { LOCATIONS, rupees, sportBySlug } from "@/lib/turf";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

type TurfRow = {
  id: string;
  name: string;
  location: string;
  address: string | null;
  price_per_hour: number;
  image_url: string | null;
  amenities: string[] | null;
};

export const Route = createFileRoute("/_authenticated/player/sport/$sport")({
  component: SportTurfs,
});

function SportTurfs() {
  const { sport: sportSlug } = Route.useParams();
  const navigate = useNavigate();
  const sport = sportBySlug(sportSlug);
  const [location, setLocation] = useState<string>("all");

  const { data: turfs, isLoading } = useQuery({
    queryKey: ["turfs", sportSlug, location],
    queryFn: async () => {
      let query = supabase
        .from("turfs")
        .select("id, name, location, address, price_per_hour, image_url, amenities")
        .eq("sport", sportSlug)
        .eq("is_active", true);
      if (location !== "all") query = query.eq("location", location);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as TurfRow[];
    },
  });

  return (
    <main className="px-4 py-6">
      <button
        onClick={() => navigate({ to: "/player" })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <h1 className="mt-3 text-3xl leading-none">{sport?.name ?? "TURFS"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Pick a station to narrow it down, or browse all.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setLocation("all")}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
            location === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          All stations
        </button>
        {LOCATIONS.map((l) => (
          <button
            key={l}
            onClick={() => setLocation(l)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              location === l
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading turfs…</p>}
        {!isLoading && !turfs?.length && (
          <div className="card-surface p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {sport?.name.toLowerCase()} turfs listed here yet.
            </p>
          </div>
        )}
        {turfs?.map((turf) => (
          <Link
            key={turf.id}
            to="/player/turf/$turfId"
            params={{ turfId: turf.id }}
            className="card-surface flex gap-3 overflow-hidden p-0"
          >
            <TurfImage
              path={turf.image_url}
              alt={turf.name}
              className="h-28 w-28 shrink-0 object-cover"
            />
            <div className="flex flex-1 flex-col justify-center gap-1 py-2 pr-3">
              <h2 className="font-display text-xl leading-none">{turf.name}</h2>
              <p className="text-xs text-muted-foreground">{turf.location}</p>
              <p className="text-sm font-semibold text-primary">
                {rupees(Number(turf.price_per_hour))} / slot
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}