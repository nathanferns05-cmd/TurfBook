import { useMyProfile } from "@/hooks/useSession";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Headphones, Home, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/player")({
  component: PlayerLayout,
});

function PlayerLayout() {
  const { data: profile } = useMyProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = (profile?.full_name || "P")
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navItem = (to: string, label: string, Icon: typeof Home, exact = false) => {
    const active = exact ? pathname === to : pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-lg">
        <Link
          to="/player/profile"
          className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
        >
          {initials}
        </Link>
        <span className="font-display text-2xl tracking-wide text-gradient-lime">TURFBOOK</span>
        <Link
          to="/player/support"
          className="flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent"
          aria-label="Customer support"
        >
          <Headphones className="size-5" />
        </Link>
      </header>

      <Outlet />

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        {navItem("/player", "Home", Home, true)}
        {navItem("/player/bookings", "My Bookings", CalendarCheck)}
        {navItem("/player/profile", "Profile", User)}
      </nav>
    </div>
  );
}