import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTripById } from "@/actions/trip.actions";
import { getReceiptsForTrip } from "@/actions/receipt.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
    }).format(v);
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

  const durationMs =
    new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime();
  const durationH = Math.floor(durationMs / 3_600_000);
  const durationM = Math.floor((durationMs % 3_600_000) / 60_000);

  const mealsLabel = ["Keine", "1 Mahlzeit", "2+ Mahlzeiten"][
    trip.meals_provided
  ];

  const isImmutable = trip.status === "APPROVED";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/trips"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-3 inline-flex"
          )}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Zurück
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{trip.destination}</h1>
              <StatusBadge status={trip.status} />
            </div>
            {trip.is_secondary_workplace && (
              <div className="flex items-center gap-1.5 text-amber-700 text-sm mt-1">
                <AlertTriangle className="w-4 h-4" />
                Tätigkeitsmittelpunkt — Taggeld nicht erstattungsfähig
              </div>
            )}
          </div>
          <TripActions trip={trip} />
        </div>
      </div>

      {/* Trip details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Reisedaten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Abreise</p>
                <p className="text-sm font-medium">{formatDT(trip.start_time)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Rückkehr</p>
                <p className="text-sm font-medium">{formatDT(trip.end_time)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Dauer</p>
                <p className="text-sm font-medium">
                  {durationH}h {durationM}m
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Car className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Kilometer</p>
                <p className="text-sm font-medium">{trip.distance_km} km</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Mahlzeiten</p>
                <p className="text-sm font-medium">{mealsLabel}</p>
              </div>
            </div>
          </div>
          {trip.notes && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">{trip.notes}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Calculations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Berechnung (§26 EStG)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taggeld Brutto</span>
            <span>{formatCurrency(trip.calculated_taggeld_gross)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taggeld Netto</span>
            <span>{formatCurrency(trip.calculated_taggeld_net)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Kilometergeld ({trip.distance_km} km × €0,50)
            </span>
            <span>{formatCurrency(trip.calculated_mileage_payout)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Gesamt steuerfrei</span>
            <span className="text-primary">
              {formatCurrency(trip.calculated_total_tax_free)}
            </span>
          </div>
          {(trip.calculated_total_taxable ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Steuerpflichtig (KV-Überschuss)</span>
              <span>{formatCurrency(trip.calculated_total_taxable)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Belege ({receipts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReceiptUploader
            tripId={trip.id}
            userId={user.id}
            initialReceipts={receipts as Parameters<typeof ReceiptUploader>[0]["initialReceipts"]}
            disabled={isImmutable}
          />
        </CardContent>
      </Card>

      {/* Approval / rejection banners */}
      {trip.status === "APPROVED" && trip.approved_at && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <Euro className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Genehmigt am{" "}
                {new Intl.DateTimeFormat("de-AT", { dateStyle: "long" }).format(
                  new Date(trip.approved_at)
                )}
              </p>
              <p className="text-xs text-emerald-600">
                Unveränderbar gemäß BAO §131
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {trip.status === "REJECTED" && trip.rejection_reason && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-red-800">Ablehnungsgrund:</p>
            <p className="text-sm text-red-600 mt-1">{trip.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
