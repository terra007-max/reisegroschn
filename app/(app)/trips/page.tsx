import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTrips } from "@/actions/trip.actions";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { StatusBadge } from "@/components/StatusBadge";
import { PlusCircle, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reisen — ReiseGroschn" };

function formatCurrency(v: number | null) {
  if (v === null) return "—";
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getTrips();
  const trips = result.success ? result.data : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meine Reisen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {trips.length} {trips.length === 1 ? "Reise" : "Reisen"} erfasst
          </p>
        </div>
        <LinkButton href="/trips/new" className="shrink-0">
          <PlusCircle className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Neue Reise</span>
          <span className="sm:hidden">Neu</span>
        </LinkButton>
      </div>

      {trips.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <MapPin className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Keine Reisen vorhanden</p>
              <p className="text-sm text-muted-foreground mt-1">
                Beginnen Sie mit der Erfassung Ihrer ersten Dienstreise
              </p>
            </div>
            <LinkButton href="/trips/new">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Erste Reise erfassen
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`} className="block group">
              <Card className="card-shadow hover:card-shadow-md hover:border-primary/25 transition-all duration-150 cursor-pointer">
                <CardContent className="flex items-center gap-3 py-3.5 px-4">
                  {/* Status icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      trip.status === "APPROVED"
                        ? "bg-emerald-50"
                        : trip.status === "PENDING"
                        ? "bg-amber-50"
                        : trip.status === "REJECTED"
                        ? "bg-red-50"
                        : "bg-muted"
                    )}
                  >
                    {trip.status === "APPROVED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <MapPin
                        className={cn(
                          "w-4 h-4",
                          trip.status === "PENDING"
                            ? "text-amber-600"
                            : trip.status === "REJECTED"
                            ? "text-red-500"
                            : "text-muted-foreground"
                        )}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{trip.destination}</span>
                      <StatusBadge status={trip.status} />
                      {trip.is_secondary_workplace && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                          Tätigkeitsmittelpunkt
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {formatDateTime(trip.start_time)} →{" "}
                      {formatDateTime(trip.end_time)} ·{" "}
                      {formatDuration(trip.start_time, trip.end_time)} ·{" "}
                      {trip.distance_km} km
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {formatDate(trip.start_time)} · {formatDuration(trip.start_time, trip.end_time)}
                    </p>
                  </div>

                  {/* Amount + arrow */}
                  <div className="text-right ml-2 flex-shrink-0 flex items-center gap-2">
                    <div>
                      <p className="font-bold text-sm text-primary tabular-nums">
                        {formatCurrency(trip.calculated_total_tax_free)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">steuerfrei</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
