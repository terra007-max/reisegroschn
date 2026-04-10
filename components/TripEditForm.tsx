"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2, Calculator, AlertTriangle, CheckCircle2,
  Euro, Car, Clock, Plus, Trash2, Plane, Train,
  Bus, MapPin, Briefcase, ChevronDown, Users,
} from "lucide-react";

import { UpdateTripSchema } from "@/lib/schemas";
import { INTERNATIONAL_PER_DIEM_RATES } from "@/lib/AustrianTaxCalculator";
import type { Segment, BorderCrossing, Trip } from "@/lib/schemas";
import { updateTrip, previewTrip } from "@/actions/trip.actions";
import type { Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function datetimeLocalToISO(val: string): string {
  if (!val) return "";
  const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val) ? val + ":00" : val;
  const d = new Date(withSec);
  return isNaN(d.getTime()) ? val : d.toISOString();
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

type TransportMode = "CAR" | "FLIGHT" | "TRAIN" | "BUS" | "OTHER";
type SegmentType = "TRAVEL" | "WORK";

const TRANSPORT_LABELS: Record<TransportMode, { label: string; Icon: React.ElementType }> = {
  CAR:    { label: "Auto",    Icon: Car },
  FLIGHT: { label: "Flug",   Icon: Plane },
  TRAIN:  { label: "Zug",    Icon: Train },
  BUS:    { label: "Bus",    Icon: Bus },
  OTHER:  { label: "Sonstig",Icon: MapPin },
};

const COUNTRY_OPTIONS = Object.entries(INTERNATIONAL_PER_DIEM_RATES)
  .map(([code, { name }]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

type FormValues = {
  purpose: string;
  destination: string;
  start_time: string;
  end_time: string;
  distance_km: number;
  passenger_count: number;
  meals_provided: 0 | 1 | 2;
  notes: string;
};

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
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

// ─── Preview panel (compact) ──────────────────────────────────────────────────

function PreviewPanel({ preview, loading }: { preview: PreviewData | null; loading: boolean }) {
  if (loading) return (
    <Card className="border-dashed card-shadow">
      <CardContent className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Berechne…</span>
      </CardContent>
    </Card>
  );
  if (!preview) return null;
  return (
    <Card className={cn("card-shadow border-2", preview.totalTaxFree > 0 ? "border-primary/20" : "border-border")}>
      <CardContent className="pt-4 pb-4 px-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-primary" /> Berechnung
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 inline mr-1" />{formatHours(preview.durationInHours)}
          </span>
        </div>
        <Separator />
        {preview.isSecondaryWorkplace ? (
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg p-3 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {preview.triggersTaggeld && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Netto Taggeld</span>
                <span className="tabular-nums font-medium">{formatEur(preview.taggeldNet)}</span>
              </div>
            )}
            {preview.overnightStays > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nächtigungsgeld</span>
                <span className="tabular-nums font-medium">{formatEur(preview.naechtigungsgeld)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kilometergeld</span>
              <span className="tabular-nums font-medium">{formatEur(preview.mileagePayout)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-sm">
              <span className="flex items-center gap-1.5">
                <Euro className="w-3.5 h-3.5 text-primary" /> Gesamt steuerfrei
              </span>
              <span className="text-primary tabular-nums">{formatEur(preview.totalTaxFree)}</span>
            </div>
          </div>
        )}
        {preview.totalTaxFree > 0 && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-lg p-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>§26 Z 4 EStG — steuer- und sozialversicherungsfrei</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Segment row ──────────────────────────────────────────────────────────────

function SegmentRow({ seg, onChange, onRemove }: {
  seg: Segment; onChange: (u: Segment) => void; onRemove: () => void;
}) {
  const isWork = seg.type === "WORK";
  const Icon = seg.transport ? TRANSPORT_LABELS[seg.transport as TransportMode]?.Icon ?? MapPin : Briefcase;
  return (
    <div className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/40 border rounded-lg">
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", isWork ? "bg-blue-50" : "bg-primary/5")}>
          <Icon className={cn("w-3.5 h-3.5", isWork ? "text-blue-600" : "text-primary")} />
        </div>
        <Select
          value={isWork ? "WORK" : (seg.transport ?? "CAR")}
          onValueChange={(v) => {
            if (v === "WORK") onChange({ ...seg, type: "WORK", transport: undefined });
            else onChange({ ...seg, type: "TRAVEL", transport: v as TransportMode });
          }}
        >
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CAR">Auto</SelectItem>
            <SelectItem value="FLIGHT">Flug</SelectItem>
            <SelectItem value="TRAIN">Zug</SelectItem>
            <SelectItem value="BUS">Bus</SelectItem>
            <SelectItem value="OTHER">Sonstig</SelectItem>
            <SelectItem value="WORK">Arbeitszeit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
        {isWork ? (
          <Input placeholder="Ort / Veranstaltung" className="h-8 text-xs flex-1 min-w-[120px]"
            value={seg.description ?? ""} onChange={(e) => onChange({ ...seg, description: e.target.value })} />
        ) : (
          <>
            <Input placeholder="Von" className="h-8 text-xs w-24" value={seg.from ?? ""}
              onChange={(e) => onChange({ ...seg, from: e.target.value })} />
            <span className="text-muted-foreground text-xs">→</span>
            <Input placeholder="Nach" className="h-8 text-xs w-24" value={seg.to ?? ""}
              onChange={(e) => onChange({ ...seg, to: e.target.value })} />
          </>
        )}
        <Input type="time" className="h-8 text-xs w-24" value={seg.start_time ?? ""}
          onChange={(e) => onChange({ ...seg, start_time: e.target.value })} />
        <span className="text-muted-foreground text-xs">–</span>
        <Input type="time" className="h-8 text-xs w-24" value={seg.end_time ?? ""}
          onChange={(e) => onChange({ ...seg, end_time: e.target.value })} />
        {seg.transport === "CAR" && (
          <div className="relative w-20">
            <Input type="number" min={0} placeholder="0" className="h-8 text-xs pr-6"
              value={seg.km ?? ""} onChange={(e) => onChange({ ...seg, km: parseInt(e.target.value) || 0 })} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">km</span>
          </div>
        )}
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function CrossingRow({ crossing, onChange, onRemove }: {
  crossing: BorderCrossing; onChange: (u: BorderCrossing) => void; onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/40 border rounded-lg">
      <Select value={crossing.direction} onValueChange={(v) => onChange({ ...crossing, direction: v as "ENTRY" | "EXIT" })}>
        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ENTRY">Einreise</SelectItem>
          <SelectItem value="EXIT">Ausreise</SelectItem>
        </SelectContent>
      </Select>
      <Select value={crossing.country_code} onValueChange={(v) => {
        if (!v) return;
        const found = COUNTRY_OPTIONS.find((c) => c.code === v);
        onChange({ ...crossing, country_code: v, country_name: found?.name ?? v });
      }}>
        <SelectTrigger className="h-8 flex-1 min-w-[140px] text-xs"><SelectValue placeholder="Land wählen" /></SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((c) => (
            <SelectItem key={c.code} value={c.code} className="text-xs">{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="datetime-local" className="h-8 text-xs flex-1 min-w-[160px]"
        value={crossing.crossed_at?.slice(0, 16) ?? ""}
        onChange={(e) => onChange({ ...crossing, crossed_at: datetimeLocalToISO(e.target.value) })} />
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function Section({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        <span className="text-sm font-semibold flex items-center gap-2">
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
          )}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Main edit form ───────────────────────────────────────────────────────────

export default function TripEditForm({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [segments, setSegments] = useState<Segment[]>(
    (trip.segments as Segment[] | null) ?? []
  );
  const [crossings, setCrossings] = useState<BorderCrossing[]>(
    (trip.border_crossings as BorderCrossing[] | null) ?? []
  );

  const {
    register, handleSubmit, watch, setValue, setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(UpdateTripSchema) as Resolver<FormValues>,
    defaultValues: {
      purpose: trip.purpose ?? "",
      destination: trip.destination,
      start_time: isoToDatetimeLocal(trip.start_time),
      end_time: isoToDatetimeLocal(trip.end_time),
      distance_km: trip.distance_km,
      passenger_count: trip.passenger_count ?? 0,
      meals_provided: (trip.meals_provided as 0 | 1 | 2) ?? 0,
      notes: trip.notes ?? "",
    },
  });

  const watchedValues = watch(["destination", "start_time", "end_time", "distance_km", "meals_provided", "passenger_count"]);

  const runPreview = useCallback(async () => {
    const [destination, start_time, end_time, distance_km, meals_provided, passenger_count] = watchedValues;
    if (!destination || !start_time || !end_time) { setPreview(null); return; }
    setPreviewLoading(true);
    const result = await previewTrip({
      purpose: "preview",
      destination,
      start_time: datetimeLocalToISO(start_time),
      end_time: datetimeLocalToISO(end_time),
      distance_km: distance_km ?? 0,
      meals_provided: meals_provided ?? 0,
      passenger_count: passenger_count ?? 0,
      segments: [],
      border_crossings: [],
    });
    setPreviewLoading(false);
    if (result.success) setPreview(result.data);
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify(watchedValues)]);

  useEffect(() => {
    const t = setTimeout(runPreview, 400);
    return () => clearTimeout(t);
  }, [runPreview]);

  // Trigger initial preview on mount
  useEffect(() => { runPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const result = await updateTrip(trip.id, {
        ...data,
        start_time: datetimeLocalToISO(data.start_time),
        end_time: datetimeLocalToISO(data.end_time),
        segments,
        border_crossings: crossings,
      });
      if (result.success) {
        toast.success("Reise aktualisiert");
        router.push(`/trips/${trip.id}`);
      } else {
        toast.error("Fehler beim Speichern", { description: result.error });
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errs]) => {
            setError(field as keyof FormValues, { message: errs[0] ?? "Ungültiger Wert" });
          });
        }
      }
    });
  }

  const passengerCount = watch("passenger_count");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-3 space-y-5">

        {/* Reisezweck */}
        <div className="space-y-1.5">
          <Label htmlFor="purpose">Reisezweck <span className="text-destructive">*</span></Label>
          <Input id="purpose" placeholder="z.B. Kundentermin, Messe, Schulung" className="h-10" {...register("purpose")} />
          {errors.purpose && <p className="text-xs text-destructive">{errors.purpose.message}</p>}
        </div>

        {/* Zielort */}
        <div className="space-y-1.5">
          <Label htmlFor="destination">Zielort</Label>
          <Input id="destination" className="h-10" {...register("destination")} />
          {errors.destination && <p className="text-xs text-destructive">{errors.destination.message}</p>}
        </div>

        {/* Abreise / Rückkehr */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Abreise</Label>
            <Input id="start_time" type="datetime-local" className="h-10" {...register("start_time")} />
            {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Rückkehr</Label>
            <Input id="end_time" type="datetime-local" className="h-10" {...register("end_time")} />
            {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
          </div>
        </div>

        {/* Reiseabschnitte */}
        <Section title="Reiseabschnitte" badge={segments.length} defaultOpen={segments.length > 0}>
          <div className="space-y-2">
            {segments.map((seg) => (
              <SegmentRow key={seg.id} seg={seg}
                onChange={(u) => setSegments((p) => p.map((s) => s.id === seg.id ? u : s))}
                onRemove={() => setSegments((p) => p.filter((s) => s.id !== seg.id))} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setSegments((p) => [...p, { id: uid(), type: "TRAVEL", transport: "CAR" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Fahrtabschnitt
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setSegments((p) => [...p, { id: uid(), type: "WORK" }])}>
              <Briefcase className="w-3.5 h-3.5 mr-1" /> Arbeitszeit
            </Button>
          </div>
        </Section>

        {/* Grenzübertritte */}
        <Section title="Grenzübertritte (Ausland)" badge={crossings.length} defaultOpen={crossings.length > 0}>
          <div className="space-y-2">
            {crossings.map((c) => (
              <CrossingRow key={c.id} crossing={c}
                onChange={(u) => setCrossings((p) => p.map((x) => x.id === c.id ? u : x))}
                onRemove={() => setCrossings((p) => p.filter((x) => x.id !== c.id))} />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => setCrossings((p) => [...p, { id: uid(), country_code: "DE", country_name: "Deutschland", crossed_at: "", direction: "ENTRY" }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Grenzübertritt hinzufügen
          </Button>
        </Section>

        {/* Kilometer + Beifahrer */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="distance_km">Gefahrene Kilometer</Label>
            <div className="relative">
              <Input id="distance_km" type="number" min={0} max={5000} className="h-10 pr-10"
                {...register("distance_km", { valueAsNumber: true })} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">km</span>
            </div>
            {errors.distance_km && <p className="text-xs text-destructive">{errors.distance_km.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Beifahrer im PKW <span className="text-muted-foreground font-normal text-xs">(+€0,05/km pro Person)</span></Label>
            <Select defaultValue={String(trip.passenger_count ?? 0)}
              onValueChange={(v) => v != null && setValue("passenger_count", parseInt(v, 10))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Kein Beifahrer</SelectItem>
                <SelectItem value="1">1 Beifahrer (€0,55/km)</SelectItem>
                <SelectItem value="2">2 Beifahrer (€0,60/km)</SelectItem>
                <SelectItem value="3">3 Beifahrer (€0,65/km)</SelectItem>
                <SelectItem value="4">4 Beifahrer (€0,70/km)</SelectItem>
              </SelectContent>
            </Select>
            {passengerCount > 0 && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-md px-2 py-1.5">
                Beifahrerzuschlag: +{passengerCount} × €0,05 = €{(passengerCount * 0.05).toFixed(2)}/km zusätzlich
              </p>
            )}
          </div>
        </div>

        {/* Mahlzeiten */}
        <div className="space-y-1.5">
          <Label>Inkludierte / bezahlte Mahlzeiten</Label>
          <Select defaultValue={String(trip.meals_provided ?? 0)}
            onValueChange={(v) => v != null && setValue("meals_provided", parseInt(v, 10) as 0 | 1 | 2)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Keine</SelectItem>
              <SelectItem value="1">1 Mahlzeit (z.B. Frühstück im Hotel)</SelectItem>
              <SelectItem value="2">2 oder mehr Mahlzeiten (z.B. Vollpension)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notizen */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notizen <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          <Textarea id="notes" className="resize-none" rows={2} {...register("notes")} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1 h-10 font-medium">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Änderungen speichern
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending} className="h-10">
            Abbrechen
          </Button>
        </div>
      </form>

      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-6 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Echtzeit-Vorschau</p>
          <PreviewPanel preview={preview} loading={previewLoading} />
        </div>
      </div>
    </div>
  );
}
