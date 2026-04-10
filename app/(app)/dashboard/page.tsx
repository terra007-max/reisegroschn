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
  CheckCircle2,
  FileText,
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

const kpiConfig = [
  {
    key: "taxFree",
    icon: Euro,
    label: "Steuerfrei genehmigt",
    sublabel: "Taggeld + Kilometergeld",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
  },
  {
    key: "taxable",
    icon: TrendingUp,
    label: "KV-Überschuss",
    sublabel: "Steuerpflichtiger Anteil",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
  },
  {
    key: "pending",
    icon: Clock,
    label: "Ausstehend",
    sublabel: "Reisen zur Genehmigung",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-l-blue-500",
  },
  {
    key: "total",
    icon: Car,
    label: "Gesamt Reisen",
    sublabel: "inkl. Entwürfe",
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-l-primary",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, tripsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, ytd_mileage_km, kv_daily_rate, role")
      .eq("id", user.id)
      .single(),
    getTrips({ limit: 100 }),
  ]);

  const isAdmin = profile?.role === "ADMIN";
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

  const kpiValues: Record<string, { value: string; sub?: string }> = {
    taxFree: { value: formatCurrency(totalTaxFree) },
    taxable: { value: formatCurrency(totalTaxable) },
    pending: {
      value: String(pendingTrips.length),
      sub: `${approvedTrips.length} genehmigt`,
    },
    total: {
      value: String(trips.length),
      sub: `${approvedTrips.length} genehmigt`,
    },
  };

  // Employees see a simplified view without tax details
  const visibleKpis = isAdmin
    ? kpiConfig
    : kpiConfig.filter((k) => k.key !== "taxable");

  const recentTrips = [...trips]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {firstName ? `Guten Tag, ${firstName}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Reisekostenübersicht {new Date().getFullYear()}
          </p>
        </div>
        <LinkButton href="/trips/new" className="shrink-0">
          <PlusCircle className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Neue Reise</span>
          <span className="sm:hidden">Neu</span>
        </LinkButton>
      </div>

      {/* ── Quick actions (mobile-first row) ───────────────── */}
      <div className="flex gap-2 sm:hidden">
        <LinkButton href="/trips/new" className="flex-1 gap-1.5 h-11">
          <PlusCircle className="w-4 h-4" />
          Neue Reise
        </LinkButton>
        <LinkButton href="/trips" variant="outline" className="flex-1 gap-1.5 h-11">
          <FileText className="w-4 h-4" />
          Alle Reisen
        </LinkButton>
      </div>

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div className={cn("grid gap-3 sm:gap-4", isAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
        {visibleKpis.map((kpi) => {
          const Icon = kpi.icon;
          const vals = kpiValues[kpi.key];
          return (
            <Card
              key={kpi.key}
              className={cn(
                "border-l-[3px] card-shadow",
                kpi.border
              )}
            >
              <CardContent className="pt-4 pb-4 px-4">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center mb-3", kpi.bg)}>
                  <Icon className={cn("w-4 h-4", kpi.color)} />
                </div>
                <p className={cn("text-xl sm:text-2xl font-bold tabular-nums tracking-tight", kpi.color)}>
                  {vals.value}
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5 leading-tight">
                  {kpi.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {kpi.sublabel}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Mileage cap progress ─────────────────────────────── */}
      <Card className="card-shadow">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              Kilometergeld-Jahresgrenze
              <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                (§26 Z 4b EStG)
              </span>
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {ytdMileage.toLocaleString("de-AT")} /{" "}
              <span className="text-muted-foreground font-normal">
                {MILEAGE_ANNUAL_CAP_KM.toLocaleString("de-AT")} km
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-5 space-y-2">
          <Progress
            value={mileagePct}
            className={cn(
              "h-2.5 rounded-full",
              mileagePct >= 90 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {(MILEAGE_ANNUAL_CAP_KM - ytdMileage).toLocaleString("de-AT")} km
              verbleibend à €0,50
            </span>
            <span
              className={cn(
                "font-medium",
                mileagePct >= 90 ? "text-destructive" : ""
              )}
            >
              {mileagePct.toFixed(1)}% ausgeschöpft
            </span>
          </div>
          {mileagePct >= 100 && (
            <p className="text-xs text-destructive font-medium bg-destructive/5 border border-destructive/15 px-3 py-2 rounded-md">
              Jahresgrenze erreicht — weitere Kilometer werden mit €0 erstattet
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Recent trips ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Letzte Reisen</h2>
          <Link
            href="/trips"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1 text-xs h-7 px-2"
            )}
          >
            Alle anzeigen
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentTrips.length === 0 ? (
          <Card className="card-shadow">
            <CardContent className="flex flex-col items-center justify-center py-14 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <MapPin className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Noch keine Reisen erfasst
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Starten Sie mit Ihrer ersten Dienstreise
                </p>
              </div>
              <LinkButton href="/trips/new" size="sm">
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Erste Reise anlegen
              </LinkButton>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`} className="block">
                <Card className="card-shadow hover:card-shadow-md hover:border-primary/25 transition-all duration-150 cursor-pointer group">
                  <CardContent className="flex items-center gap-3 py-3.5 px-4">
                    {/* Status icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">
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

                    {/* Amount */}
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="font-bold text-sm text-primary tabular-nums">
                        {formatCurrency(trip.calculated_total_tax_free)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">steuerfrei</p>
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
