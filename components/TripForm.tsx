"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Euro,
  Car,
  Clock,
} from "lucide-react";

import { CreateTripSchema } from "@/lib/schemas";

// Explicit form values type avoids Zod input/output mismatch with react-hook-form
type TripFormValues = {
  destination: string;
  start_time: string;
  end_time: string;
  distance_km: number;
  meals_provided: 0 | 1 | 2;
  notes: string;
};
import { createTrip, previewTrip } from "@/actions/trip.actions";
import type { Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a datetime-local string ("YYYY-MM-DDTHH:mm") to a full ISO UTC string. */
function datetimeLocalToISO(val: string): string {
  if (!val) return "";
  // datetime-local omits seconds — add them so Date can parse correctly
  const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val) ? val + ":00" : val;
  const d = new Date(withSec);
  return isNaN(d.getTime()) ? val : d.toISOString();
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewData {
  durationInHours: number;
  taggeldGross: number;
  taggeldNet: number;
  naechtigungsgeld: number;
  overnightStays: number;
  mileagePayout: number;
  totalTaxFree: number;
  totalTaxable: number;
  isSecondaryWorkplace: boolean;
  triggersTaggeld: boolean;
}

function formatEur(v: number) {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function PreviewPanel({
  preview,
  loading,
}: {
  preview: PreviewData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="border-dashed card-shadow">
        <CardContent className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Berechne…</span>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="card-shadow">
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Gesetzliche Sätze 2024</span>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Taggeld (§26 Z 4 EStG)
            </p>
            <div className="space-y-1.5">
              {[
                { label: "Unter 3 Stunden", value: "€ 0,00" },
                { label: "3 – 12 Stunden", value: "€ 13,20" },
                { label: "Über 12 Stunden", value: "€ 26,40" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Kilometergeld (§26 Z 4b EStG)
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" />
                bis 30.000 km/Jahr
              </span>
              <span className="tabular-nums font-medium">€ 0,50 / km</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" />
                ab 30.000 km/Jahr
              </span>
              <span className="tabular-nums font-medium text-muted-foreground">€ 0,00 / km</span>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 leading-relaxed">
            Zielort und Zeiten eingeben für Ihre persönliche Berechnung.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "card-shadow border-2 transition-colors duration-200",
        preview.totalTaxFree > 0 ? "border-primary/20" : "border-border"
      )}
    >
      <CardContent className="pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-primary" />
            Berechnung
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatHours(preview.durationInHours)}
          </span>
        </div>

        <Separator />

        {/* Taggeld */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Taggeld (§26 Z 4 EStG)
          </p>
          {preview.isSecondaryWorkplace ? (
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-3 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)</span>
            </div>
          ) : !preview.triggersTaggeld ? (
            <div className="flex items-center gap-2 text-muted-foreground bg-muted rounded-lg p-3 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Unter 3 Stunden — kein Taggeld-Anspruch</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Brutto</span>
                <span className="tabular-nums">{formatEur(preview.taggeldGross)}</span>
              </div>
              {preview.taggeldGross !== preview.taggeldNet && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Mahlzeitenkürzung</span>
                  <span className="tabular-nums">
                    − {formatEur(preview.taggeldGross - preview.taggeldNet)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <span>Netto Taggeld</span>
                <span className="text-primary tabular-nums">
                  {formatEur(preview.taggeldNet)}
                </span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Nächtigungsgeld */}
        {preview.overnightStays > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Nächtigungsgeld (§26 Z 4 EStG)
              </p>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-muted-foreground">
                  {preview.overnightStays} Nacht{preview.overnightStays > 1 ? "nächte" : ""} × €17
                </span>
                <span className="text-primary tabular-nums">
                  {formatEur(preview.naechtigungsgeld)}
                </span>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Kilometergeld */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Kilometergeld
          </p>
          <div className="flex justify-between text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-muted-foreground" />
              à €0,50/km
            </span>
            <span className="text-primary tabular-nums">
              {formatEur(preview.mileagePayout)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Total */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold text-base">
            <span className="flex items-center gap-1.5">
              <Euro className="w-4 h-4 text-primary" />
              Gesamt steuerfrei
            </span>
            <span className="text-primary tabular-nums">
              {formatEur(preview.totalTaxFree)}
            </span>
          </div>
          {preview.totalTaxable > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Steuerpflichtig (KV-Überschuss)</span>
              <span className="tabular-nums">{formatEur(preview.totalTaxable)}</span>
            </div>
          )}
        </div>

        {preview.totalTaxFree > 0 && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-lg p-2.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>§26 Z 4 EStG — steuer- und sozialversicherungsfrei</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function TripForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(CreateTripSchema) as Resolver<TripFormValues>,
    defaultValues: {
      destination: "",
      start_time: "",
      end_time: "",
      distance_km: 0,
      meals_provided: 0,
      notes: "",
    },
  });

  const watchedValues = watch([
    "destination",
    "start_time",
    "end_time",
    "distance_km",
    "meals_provided",
  ]);

  const runPreview = useCallback(async () => {
    const [destination, start_time, end_time, distance_km, meals_provided] =
      watchedValues;

    if (!destination || !start_time || !end_time) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    const result = await previewTrip({
      destination,
      start_time,
      end_time,
      distance_km: distance_km ?? 0,
      meals_provided: meals_provided ?? 0,
    });
    setPreviewLoading(false);

    if (result.success) {
      setPreview(result.data);
    } else {
      setPreview(null);
    }
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify(watchedValues)]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [runPreview]);

  function onSubmit(data: TripFormValues) {
    startTransition(async () => {
      const result = await createTrip(data);
      if (result.success) {
        toast.success("Reise gespeichert", {
          description: `Entwurf für „${result.data.destination}" angelegt.`,
        });
        router.push(`/trips/${result.data.id}`);
      } else {
        toast.error("Fehler beim Speichern", { description: result.error });
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errs]) => {
            setError(field as keyof TripFormValues, {
              message: errs[0] ?? "Ungültiger Wert",
            });
          });
        }
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* ── Form ──────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="lg:col-span-3 space-y-5"
      >
        {/* Destination */}
        <div className="space-y-1.5">
          <Label htmlFor="destination">Zielort</Label>
          <Input
            id="destination"
            placeholder="z.B. Wien, Graz, Linz"
            className="h-10"
            {...register("destination")}
          />
          {errors.destination && (
            <p className="text-xs text-destructive">{errors.destination.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Exakter Name wichtig für die 5/15-Tage-Regel
          </p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Abreise</Label>
            <Input
              id="start_time"
              type="datetime-local"
              className="h-10"
              {...register("start_time", {
                setValueAs: datetimeLocalToISO,
              })}
            />
            {errors.start_time && (
              <p className="text-xs text-destructive">
                {errors.start_time.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Rückkehr</Label>
            <Input
              id="end_time"
              type="datetime-local"
              className="h-10"
              {...register("end_time", {
                setValueAs: datetimeLocalToISO,
              })}
            />
            {errors.end_time && (
              <p className="text-xs text-destructive">
                {errors.end_time.message}
              </p>
            )}
          </div>
        </div>

        {/* Distance */}
        <div className="space-y-1.5">
          <Label htmlFor="distance_km">Gefahrene Kilometer</Label>
          <div className="relative">
            <Input
              id="distance_km"
              type="number"
              min={0}
              max={5000}
              placeholder="0"
              className="h-10 pr-10"
              {...register("distance_km", { valueAsNumber: true })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              km
            </span>
          </div>
          {errors.distance_km && (
            <p className="text-xs text-destructive">{errors.distance_km.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Hin- und Rückfahrt (§26 Z 4b EStG · €0,50/km)
          </p>
        </div>

        {/* Meals */}
        <div className="space-y-1.5">
          <Label>Vom Arbeitgeber bezahlte Mahlzeiten</Label>
          <Select
            defaultValue="0"
            onValueChange={(v) =>
              v != null && setValue("meals_provided", parseInt(v, 10) as 0 | 1 | 2)
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Keine</SelectItem>
              <SelectItem value="1">1 Mahlzeit (−€15 Kürzung)</SelectItem>
              <SelectItem value="2">2+ Mahlzeiten (Taggeld entfällt)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Mahlzeiten kürzen das Taggeld (§26 Z 4 EStG)
          </p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">
            Notizen{" "}
            <span className="text-muted-foreground font-normal text-xs">
              (optional)
            </span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Zweck der Reise, Kunden, Projekte…"
            className="resize-none"
            rows={3}
            {...register("notes")}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            disabled={isPending}
            className="flex-1 h-10 font-medium"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Als Entwurf speichern
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
            className="h-10"
          >
            Abbrechen
          </Button>
        </div>
      </form>

      {/* ── Preview panel ─────────────────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-6 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Echtzeit-Vorschau
          </p>
          <PreviewPanel preview={preview} loading={previewLoading} />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vorläufige Berechnung. Endgültige Beträge nach HR-Genehmigung.
          </p>
        </div>
      </div>
    </div>
  );
}
