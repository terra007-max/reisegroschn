import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTrips } from "@/actions/trip.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LinkButton } from "@/components/ui/link-button";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  TrendingUp,
  Car,
  Clock,
  Euro,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { MILEAGE_ANNUAL_CAP_KM } from "@/lib/AustrianTaxCalculator";

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, ytd_mileage_km, kv_daily_rate")
    .eq("id", user.id)
    .single();

  const tripsResult = await getTrips({ limit: 100 });
  const trips = tripsResult.success ? tripsResult.data : [];

  const ytdMileage = profile?.ytd_mileage_km ?? 0;
  const mileagePct = Math.min(100, (ytdMileage / MILEAGE_ANNUAL_CAP_KM) * 100);

  const approvedTrips = trips.filter((t) => t.status === "APPROVED");
  const pendingTrips = trips.filter((t) => t.status === "PENDING");
  const totalTaxFree = approvedTrips.reduce(
    (sum, t) => sum + (t.calculated_total_tax_free ?? 0),
    0
  );
  const totalTaxable = approvedTrips.reduce(
    (sum, t) => sum + (t.calculated_total_taxable ?? 0),
    0
  );

  const recentTrips = [...trips]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Guten Tag, {profile?.full_name?.split(" ")[0] ?? ""}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ihre Reisekostenübersicht — {new Date().getFullYear()}
          </p>
        </div>
        <LinkButton href="/trips/new">
          <PlusCircle className="w-4 h-4 mr-2" />
          Neue Reise
        </LinkButton>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Euro className="w-3.5 h-3.5" />
              Steuerfrei (genehmigt)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalTaxFree)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Taggeld + Kilometergeld
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Steuerpflichtig (KV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalTaxable)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              KV-Überschuss über €30
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Ausstehend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingTrips.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingTrips.length === 1 ? "Reise" : "Reisen"} zur Genehmigung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Car className="w-3.5 h-3.5" />
              Gesamt Reisen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{trips.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {approvedTrips.length} genehmigt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kilometergeld cap progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              Kilometerstand — Jahresgrenze (§26 Z 4b EStG)
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">
              {ytdMileage.toLocaleString("de-AT")} /{" "}
              {MILEAGE_ANNUAL_CAP_KM.toLocaleString("de-AT")} km
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={mileagePct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {(MILEAGE_ANNUAL_CAP_KM - ytdMileage).toLocaleString("de-AT")} km
              verbleibend à €0,50
            </span>
            <span className={mileagePct >= 90 ? "text-destructive font-medium" : ""}>
              {mileagePct.toFixed(1)}% ausgeschöpft
            </span>
          </div>
          {mileagePct >= 100 && (
            <p className="text-xs text-destructive font-medium bg-destructive/5 px-3 py-2 rounded-md">
              Jahresgrenze erreicht — weitere Kilometer erhalten €0 Erstattung
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent trips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Letzte Reisen</h2>
          <Link
            href="/trips"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5 text-xs"
            )}
          >
            Alle anzeigen <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTrips.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <MapPin className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Noch keine Reisen erfasst
              </p>
              <LinkButton href="/trips/new" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Erste Reise anlegen
              </LinkButton>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {trip.destination}
                        </p>
                        <StatusBadge status={trip.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(trip.start_time)} ·{" "}
                        {formatDuration(trip.start_time, trip.end_time)} ·{" "}
                        {trip.distance_km} km
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-semibold text-sm text-primary">
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
    </div>
  );
}
