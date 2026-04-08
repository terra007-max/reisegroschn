import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTrips } from "@/actions/trip.actions";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { StatusBadge } from "@/components/StatusBadge";
import { PlusCircle, MapPin } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meine Reisen</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {trips.length} {trips.length === 1 ? "Reise" : "Reisen"} erfasst
          </p>
        </div>
        <LinkButton href="/trips/new">
          <PlusCircle className="w-4 h-4 mr-2" />
          Neue Reise
        </LinkButton>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <MapPin className="w-12 h-12 text-muted-foreground/25" />
            <div className="text-center">
              <p className="font-medium text-muted-foreground">
                Keine Reisen vorhanden
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Beginnen Sie mit der Erfassung Ihrer ersten Dienstreise
              </p>
            </div>
            <LinkButton href="/trips/new">
              <PlusCircle className="w-4 h-4 mr-2" />
              Erste Reise erfassen
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {trip.destination}
                      </span>
                      <StatusBadge status={trip.status} />
                      {trip.is_secondary_workplace && (
                        <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                          Tätigkeitsmittelpunkt
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(trip.start_time)} →{" "}
                      {formatDateTime(trip.end_time)} ·{" "}
                      {formatDuration(trip.start_time, trip.end_time)} ·{" "}
                      {trip.distance_km} km
                    </p>
                  </div>
                  <div className="text-right ml-6 flex-shrink-0">
                    <p className="font-bold text-primary">
                      {formatCurrency(trip.calculated_total_tax_free)}
                    </p>
                    <p className="text-xs text-muted-foreground">steuerfrei</p>
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
