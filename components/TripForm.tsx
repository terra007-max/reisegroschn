"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";

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

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewData {
  durationInHours: number;
  taggeldGross: number;
  taggeldNet: number;
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
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Berechne…</span>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Calculator className="w-4 h-4" />
          <span className="text-sm">
            Gültige Daten eingeben für Echtzeit-Vorschau
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-2 transition-colors",
        preview.totalTaxFree > 0 ? "border-primary/20" : "border-border"
      )}
    >
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Berechnung (§26 EStG)
          </span>
          <span className="text-xs text-muted-foreground">
            Dauer: {formatHours(preview.durationInHours)}
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Taggeld
          </p>
          {preview.isSecondaryWorkplace ? (
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded-md p-3 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)</span>
            </div>
          ) : !preview.triggersTaggeld ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Unter 3 Stunden — kein Taggeld-Anspruch</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Brutto</span>
                <span>{formatEur(preview.taggeldGross)}</span>
              </div>
              {preview.taggeldGross !== preview.taggeldNet && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Mahlzeitenkürzung</span>
                  <span>
                    − {formatEur(preview.taggeldGross - preview.taggeldNet)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span>Netto Taggeld</span>
                <span className="text-primary">
                  {formatEur(preview.taggeldNet)}
                </span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Kilometergeld
          </p>
          <div className="flex justify-between text-sm font-medium">
            <span>Erstattung (à €0,50)</span>
            <span className="text-primary">
              {formatEur(preview.mileagePayout)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <div className="flex justify-between font-bold text-base">
            <span>Gesamt steuerfrei</span>
            <span className="text-primary">{formatEur(preview.totalTaxFree)}</span>
          </div>
          {preview.totalTaxable > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Steuerpflichtig (KV-Überschuss)</span>
              <span>{formatEur(preview.totalTaxable)}</span>
            </div>
          )}
        </div>

        {preview.totalTaxFree > 0 && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-md p-2.5 text-xs">
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
          description: `Entwurf für "${result.data.destination}" angelegt.`,
        });
        router.push(`/trips/${result.data.id}`);
      } else {
        toast.error("Fehler", { description: result.error });
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
      {/* ── Form ──────────────────────────────────────── */}
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
            {...register("destination")}
          />
          {errors.destination && (
            <p className="text-xs text-destructive">
              {errors.destination.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Exakter Name wichtig für die 5/15-Tage-Regel
          </p>
        </div>

        {/* Start + End time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Abreise</Label>
            <Input id="start_time" type="datetime-local" {...register("start_time")} />
            {errors.start_time && (
              <p className="text-xs text-destructive">
                {errors.start_time.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Rückkehr</Label>
            <Input id="end_time" type="datetime-local" {...register("end_time")} />
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
              className="pr-10"
              {...register("distance_km", { valueAsNumber: true })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              km
            </span>
          </div>
          {errors.distance_km && (
            <p className="text-xs text-destructive">
              {errors.distance_km.message}
            </p>
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
              v !== null &&
              setValue("meals_provided", parseInt(v, 10) as 0 | 1 | 2)
            }
          >
            <SelectTrigger>
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
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Zweck der Reise, Kunden, Projekte…"
            className="resize-none"
            rows={3}
            {...register("notes")}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Als Entwurf speichern
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Abbrechen
          </Button>
        </div>
      </form>

      {/* ── Preview panel (sticky) ─────────────────── */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
