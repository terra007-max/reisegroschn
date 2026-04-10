import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTripById } from "@/actions/trip.actions";
import { getReceiptsForTrip } from "@/actions/receipt.actions";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import TripActions from "@/components/TripActions";
import ReceiptUploader from "@/components/ReceiptUploader";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Clock,
  Car,
  UtensilsCrossed,
  Euro,
  AlertTriangle,
  ArrowLeft,
  Receipt,
  Briefcase,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tripResult, receiptsResult] = await Promise.all([
    getTripById(id),
    getReceiptsForTrip(id),
  ]);

  if (!tripResult.success) notFound();
  const trip = tripResult.data;
  const receipts = receiptsResult.success ? receiptsResult.data : [];

  function formatCurrency(v: number | null) {
    if (v === null) return "—";
    return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);
  }

  function formatDT(iso: string) {
    return new Intl.DateTimeFormat("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  function formatDateLong(iso: string) {
    return new Intl.DateTimeFormat("de-AT", { dateStyle: "long" }).format(new Date(iso));
  }

  const durationMs = new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime();
  const durationH = Math.floor(durationMs / 3_600_000);
  const durationM = Math.floor((durationMs % 3_600_000) / 60_000);

  const mealsLabel = ["Keine", "1 Mahlzeit bezahlt", "2+ Mahlzeiten bezahlt"][trip.meals_provided];
  const isImmutable = trip.status === "APPROVED";

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      {/* Back nav */}
      <Link
        href="/trips"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 inline-flex")}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Zurück
      </Link>

      {/* Hero header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {trip.destination}
            </h1>
            <StatusBadge status={trip.status} />
          </div>
          {trip.purpose && (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
              {trip.purpose}
            </p>
          )}
          {trip.is_secondary_workplace && (
            <div className="flex items-center gap-1.5 text-amber-700 text-sm mt-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Tätigkeitsmittelpunkt — Taggeld nicht erstattungsfähig</span>
            </div>
          )}
        </div>
        <TripActions trip={trip} />
      </div>

      {/* Status banner */}
      {trip.status === "APPROVED" && trip.approved_at && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-800">
              Genehmigt am {formatDateLong(trip.approved_at)}
            </p>
            <p className="text-xs text-emerald-600/80">Unveränderbar gemäß BAO §131</p>
          </div>
        </div>
      )}

      {trip.status === "REJECTED" && trip.rejection_reason && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Abgelehnt</p>
            <p className="text-sm text-red-600 mt-0.5">{trip.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Trip details + calculation — side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Travel details */}
        <Card className="card-shadow">
          <CardContent className="pt-4 pb-4 px-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Reisedaten
            </p>

            <DetailRow icon={Clock} label="Abreise" value={formatDT(trip.start_time)} />
            <DetailRow icon={Clock} label="Rückkehr" value={formatDT(trip.end_time)} />
            <Separator />
            <DetailRow
              icon={MapPin}
              label="Dauer"
              value={`${durationH}h ${durationM}m`}
            />
            {trip.distance_km > 0 && (
              <DetailRow icon={Car} label="Kilometer" value={`${trip.distance_km} km`} />
            )}
            <DetailRow icon={UtensilsCrossed} label="Mahlzeiten" value={mealsLabel} />

            {trip.notes && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground leading-relaxed">{trip.notes}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Calculation */}
        <Card className="card-shadow">
          <CardContent className="pt-4 pb-4 px-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Berechnung §26 EStG
            </p>

            {trip.is_secondary_workplace ? (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-3 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)</span>
              </div>
            ) : (
              <>
                <CalcRow label="Taggeld Brutto" value={formatCurrency(trip.calculated_taggeld_gross)} />
                <CalcRow label="Taggeld Netto" value={formatCurrency(trip.calculated_taggeld_net)} />
                <CalcRow
                  label={`Kilometergeld (${trip.distance_km} km)`}
                  value={formatCurrency(trip.calculated_mileage_payout)}
                />
                {(trip.calculated_total_taxable ?? 0) > 0 && (
                  <CalcRow
                    label="KV-Überschuss (steuerpfl.)"
                    value={formatCurrency(trip.calculated_total_taxable)}
                    muted
                  />
                )}
              </>
            )}

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Euro className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Gesamt steuerfrei</span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">
                {formatCurrency(trip.calculated_total_tax_free)}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/50 rounded-lg px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              §26 Z 4 EStG — steuer- und sozialversicherungsfrei
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipts */}
      <Card className="card-shadow">
        <CardContent className="pt-4 pb-4 px-4 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Belege ({receipts.length})
            </p>
          </div>
          <ReceiptUploader
            tripId={trip.id}
            userId={user.id}
            initialReceipts={receipts as Parameters<typeof ReceiptUploader>[0]["initialReceipts"]}
            disabled={isImmutable}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium leading-tight">{value}</p>
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex justify-between text-sm", muted ? "text-muted-foreground" : "")}>
      <span className={muted ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
