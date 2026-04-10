"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2, Calculator, AlertTriangle, CheckCircle2,
  Euro, Car, Clock, Plus, Trash2, Plane, Train,
  Bus, MapPin, Briefcase, ChevronDown, Users,
  ArrowRight, ArrowUpRight, ArrowDownLeft, Search, Globe,
} from "lucide-react";

import { CreateTripSchema } from "@/lib/schemas";
import { INTERNATIONAL_PER_DIEM_RATES } from "@/lib/AustrianTaxCalculator";
import type { Segment, BorderCrossing } from "@/lib/schemas";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import type { PlaceResult } from "@/components/PlaceAutocomplete";

type TransportMode = "CAR" | "FLIGHT" | "TRAIN" | "BUS" | "OTHER";
type SegmentType = "TRAVEL" | "WORK";

type TripFormValues = {
  purpose: string;
  destination: string;
  start_time: string;
  end_time: string;
  distance_km: number;
  passenger_count: number;
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

function datetimeLocalToISO(val: string): string {
  if (!val) return "";
  const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val) ? val + ":00" : val;
  const d = new Date(withSec);
  return isNaN(d.getTime()) ? val : d.toISOString();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function countryFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

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
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function PreviewPanel({ preview, loading }: { preview: PreviewData | null; loading: boolean }) {
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
            <span className="text-sm font-semibold">Gesetzliche Sätze 2026</span>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Taggeld (§26 Z 4 EStG)
            </p>
            <div className="space-y-1.5">
              {[
                { label: "Unter 3 Stunden", value: "€ 0,00" },
                { label: "3 – 12 Stunden",  value: "€ 2,50/h" },
                { label: "Über 12 Stunden", value: "€ 30,00" },
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
                <Car className="w-3.5 h-3.5" /> bis 30.000 km/Jahr
              </span>
              <span className="tabular-nums font-medium">€ 0,50 / km</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> + Beifahrer
              </span>
              <span className="tabular-nums font-medium">+ € 0,05 / km</span>
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
    <Card className={cn("card-shadow border-2 transition-colors duration-200", preview.totalTaxFree > 0 ? "border-primary/20" : "border-border")}>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-primary" /> Berechnung
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 inline mr-1" />{formatHours(preview.durationInHours)}
          </span>
        </div>
        <Separator />
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
                  <span className="tabular-nums">− {formatEur(preview.taggeldGross - preview.taggeldNet)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <span>Netto Taggeld</span>
                <span className="text-primary tabular-nums">{formatEur(preview.taggeldNet)}</span>
              </div>
            </div>
          )}
        </div>
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
                <span className="text-primary tabular-nums">{formatEur(preview.naechtigungsgeld)}</span>
              </div>
            </div>
          </>
        )}
        <Separator />
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Kilometergeld
          </p>
          <div className="flex justify-between text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-muted-foreground" /> à €0,50/km
            </span>
            <span className="text-primary tabular-nums">{formatEur(preview.mileagePayout)}</span>
          </div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between font-bold text-base">
            <span className="flex items-center gap-1.5">
              <Euro className="w-4 h-4 text-primary" /> Gesamt steuerfrei
            </span>
            <span className="text-primary tabular-nums">{formatEur(preview.totalTaxFree)}</span>
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

// ─── Segment row ──────────────────────────────────────────────────────────────

function SegmentRow({
  seg,
  onChange,
  onRemove,
}: {
  seg: Segment;
  onChange: (updated: Segment) => void;
  onRemove: () => void;
}) {
  const isWork = seg.type === "WORK";
  const Icon = seg.transport ? TRANSPORT_LABELS[seg.transport as TransportMode]?.Icon ?? MapPin : Briefcase;

  return (
    <div className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/40 border rounded-lg">
      {/* Type / mode selector */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", isWork ? "bg-blue-50" : "bg-primary/5")}>
          <Icon className={cn("w-3.5 h-3.5", isWork ? "text-blue-600" : "text-primary")} />
        </div>
        <Select
          value={isWork ? "WORK" : (seg.transport ?? "CAR")}
          onValueChange={(v) => {
            if (v === "WORK") {
              onChange({ ...seg, type: "WORK", transport: undefined });
            } else {
              onChange({ ...seg, type: "TRAVEL", transport: v as TransportMode });
            }
          }}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
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

      {/* Fields */}
      <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
        {isWork ? (
          <>
            <Input
              placeholder="Ort / Veranstaltung"
              className="h-8 text-xs flex-1 min-w-[120px]"
              value={seg.description ?? ""}
              onChange={(e) => onChange({ ...seg, description: e.target.value })}
            />
          </>
        ) : (
          <>
            <Input
              placeholder="Von"
              className="h-8 text-xs w-24"
              value={seg.from ?? ""}
              onChange={(e) => onChange({ ...seg, from: e.target.value })}
            />
            <span className="text-muted-foreground text-xs">→</span>
            <Input
              placeholder="Nach"
              className="h-8 text-xs w-24"
              value={seg.to ?? ""}
              onChange={(e) => onChange({ ...seg, to: e.target.value })}
            />
          </>
        )}
        <Input
          type="time"
          className="h-8 text-xs w-24"
          value={seg.start_time ?? ""}
          onChange={(e) => onChange({ ...seg, start_time: e.target.value })}
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="time"
          className="h-8 text-xs w-24"
          value={seg.end_time ?? ""}
          onChange={(e) => onChange({ ...seg, end_time: e.target.value })}
        />
        {seg.transport === "CAR" && (
          <div className="relative w-20">
            <Input
              type="number"
              min={0}
              placeholder="0"
              className="h-8 text-xs pr-6"
              value={seg.km ?? ""}
              onChange={(e) => onChange({ ...seg, km: parseInt(e.target.value) || 0 })}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">km</span>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Border crossing row ──────────────────────────────────────────────────────

function CrossingRow({
  crossing,
  onChange,
  onRemove,
  index,
}: {
  crossing: BorderCrossing;
  onChange: (updated: BorderCrossing) => void;
  onRemove: () => void;
  index: number;
}) {
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === crossing.country_code);

  const filteredCountries = countryQuery.trim().length > 0
    ? COUNTRY_OPTIONS.filter((c) =>
        c.name.toLowerCase().includes(countryQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(countryQuery.toLowerCase())
      )
    : COUNTRY_OPTIONS;

  // Split ISO datetime into date + time parts for cleaner UX
  const raw = crossing.crossed_at ? crossing.crossed_at.slice(0, 16) : "";
  const [datePart, timePart] = raw.includes("T") ? raw.split("T") : [raw, ""];

  function updateDateTime(date: string, time: string) {
    if (!date) return;
    onChange({ ...crossing, crossed_at: datetimeLocalToISO(`${date}T${time || "00:00"}`) });
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountryQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-visible">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b">
        <span className="text-xl leading-none flex-shrink-0" aria-hidden>
          {selectedCountry ? countryFlagEmoji(crossing.country_code) : "🌍"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {crossing.direction === "ENTRY" ? "Einreise" : "Ausreise"}
            {selectedCountry ? ` · ${selectedCountry.name}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {crossing.direction === "ENTRY"
              ? "Ich betrete ein neues Land"
              : "Ich verlasse das aktuelle Land"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Grenzübertritt entfernen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Direction toggle */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Richtung</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["ENTRY", "EXIT"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => onChange({ ...crossing, direction: dir })}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-medium transition-all",
                  crossing.direction === dir
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-muted/50 border-border"
                )}
              >
                {dir === "ENTRY"
                  ? <ArrowDownLeft className="w-3.5 h-3.5 flex-shrink-0" />
                  : <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" />}
                {dir === "ENTRY" ? "Einreise" : "Ausreise"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {crossing.direction === "ENTRY"
              ? "Einreise: du betrittst das unten gewählte Land (z.B. Deutschland)"
              : "Ausreise: du verlässt das unten gewählte Land (z.B. Österreich)"}
          </p>
        </div>

        {/* Country picker with search */}
        <div className="space-y-1.5" ref={containerRef}>
          <Label className="text-xs text-muted-foreground">Land</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCountryOpen((o) => !o)}
              className={cn(
                "w-full flex items-center gap-2 h-10 px-3 rounded-md border bg-background text-sm text-left transition-colors",
                "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "hover:bg-muted/30",
                !selectedCountry && "text-muted-foreground"
              )}
            >
              {selectedCountry ? (
                <>
                  <span className="text-base leading-none flex-shrink-0">{countryFlagEmoji(crossing.country_code)}</span>
                  <span className="flex-1 truncate">{selectedCountry.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {crossing.country_code}
                  </span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span>Land auswählen…</span>
                </>
              )}
            </button>

            {countryOpen && (
              <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-popover border rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      placeholder="Land suchen…"
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredCountries.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                      Kein Ergebnis für „{countryQuery}"
                    </p>
                  ) : (
                    filteredCountries.map((c, i) => (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onChange({ ...crossing, country_code: c.code, country_name: c.name });
                          setCountryOpen(false);
                          setCountryQuery("");
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                          crossing.country_code === c.code
                            ? "bg-primary/10 font-medium"
                            : "hover:bg-muted/60",
                          i > 0 && "border-t border-border/30"
                        )}
                      >
                        <span className="text-base leading-none w-6 flex-shrink-0">{countryFlagEmoji(c.code)}</span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{c.code}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Date + Time split for clarity */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Datum</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={datePart}
              onChange={(e) => updateDateTime(e.target.value, timePart)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
            <Input
              type="time"
              className="h-9 text-sm"
              value={timePart}
              onChange={(e) => updateDateTime(datePart, e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Route visualization ──────────────────────────────────────────────────────

function RouteViz({ crossings }: { crossings: BorderCrossing[] }) {
  if (crossings.length === 0) return null;

  // Build the route: start in AT, each ENTRY crossing adds a new country leg
  const sorted = [...crossings].sort((a, b) =>
    (a.crossed_at || "").localeCompare(b.crossed_at || "")
  );

  const stops: string[] = ["AT"];
  for (const c of sorted) {
    if (c.direction === "ENTRY" && c.country_code) {
      stops.push(c.country_code);
    }
  }
  // Deduplicate consecutive duplicates
  const deduped = stops.filter((s, i) => i === 0 || s !== stops[i - 1]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1">
      {deduped.map((code, i) => (
        <div key={`${code}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
          <span className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border",
            code === "AT"
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-muted border-border text-foreground"
          )}>
            <span className="text-sm leading-none">{countryFlagEmoji(code)}</span>
            <span className="font-mono">{code}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function TripForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [crossings, setCrossings] = useState<BorderCrossing[]>([]);
  const [internationalHint, setInternationalHint] = useState<PlaceResult | null>(null);

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
      purpose: "",
      destination: "",
      start_time: "",
      end_time: "",
      distance_km: 0,
      passenger_count: 0,
      meals_provided: 0,
      notes: "",
    },
  });

  const watchedValues = watch([
    "destination", "start_time", "end_time", "distance_km", "meals_provided", "passenger_count",
  ]);

  const runPreview = useCallback(async () => {
    const [destination, start_time, end_time, distance_km, meals_provided, passenger_count] = watchedValues;
    if (!destination || !start_time || !end_time) { setPreview(null); return; }
    setPreviewLoading(true);
    const result = await previewTrip({
      purpose: "preview",
      destination,
      start_time,
      end_time,
      distance_km: distance_km ?? 0,
      meals_provided: meals_provided ?? 0,
      passenger_count: passenger_count ?? 0,
      segments: [],
      border_crossings: [],
    });
    setPreviewLoading(false);
    if (result.success) setPreview(result.data);
    else setPreview(null);
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify(watchedValues)]);

  useEffect(() => {
    const timer = setTimeout(runPreview, 400);
    return () => clearTimeout(timer);
  }, [runPreview]);

  function onSubmit(data: TripFormValues) {
    startTransition(async () => {
      const result = await createTrip({ ...data, segments, border_crossings: crossings });
      if (result.success) {
        toast.success("Reise gespeichert", {
          description: `Entwurf für „${result.data.destination}" angelegt.`,
        });
        router.push(`/trips/${result.data.id}`);
      } else {
        toast.error("Fehler beim Speichern", { description: result.error });
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errs]) => {
            setError(field as keyof TripFormValues, { message: errs[0] ?? "Ungültiger Wert" });
          });
        }
      }
    });
  }

  function addSegment(type: SegmentType) {
    setSegments((prev) => [
      ...prev,
      { id: uid(), type, transport: type === "TRAVEL" ? "CAR" : undefined },
    ]);
  }

  function updateSegment(id: string, updated: Segment) {
    setSegments((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  function removeSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  function addCrossing() {
    setCrossings((prev) => [
      ...prev,
      { id: uid(), country_code: "DE", country_name: "Deutschland", crossed_at: "", direction: "ENTRY" },
    ]);
  }

  function updateCrossing(id: string, updated: BorderCrossing) {
    setCrossings((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  function removeCrossing(id: string) {
    setCrossings((prev) => prev.filter((c) => c.id !== id));
  }

  const passengerCount = watch("passenger_count");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* ── Form ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-3 space-y-5">

        {/* Reisezweck — REQUIRED */}
        <div className="space-y-1.5">
          <Label htmlFor="purpose">
            Reisezweck <span className="text-destructive">*</span>
          </Label>
          <Input
            id="purpose"
            placeholder="z.B. Kundentermin, Messe München, Schulung"
            className="h-10"
            {...register("purpose")}
          />
          {errors.purpose && (
            <p className="text-xs text-destructive">{errors.purpose.message}</p>
          )}
        </div>

        {/* Zielort */}
        <div className="space-y-1.5">
          <Label htmlFor="destination">Zielort</Label>
          <PlaceAutocomplete
            id="destination"
            value={watch("destination")}
            error={!!errors.destination}
            onChange={(val, result) => {
              setValue("destination", val, { shouldValidate: true });
              if (result && result.countryCode !== "AT") {
                setInternationalHint(result);
              } else {
                setInternationalHint(null);
              }
            }}
          />
          {errors.destination && (
            <p className="text-xs text-destructive">{errors.destination.message}</p>
          )}
          {internationalHint && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200/60 rounded-lg px-3 py-2.5 text-xs text-blue-800">
              <span className="text-base leading-none flex-shrink-0">
                {internationalHint.countryCode.replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397))}
              </span>
              <span className="flex-1">
                <strong>Auslandsreise erkannt</strong> — {internationalHint.country}.
                Grenzübertritt unter „Grenzübertritte" erfassen für korrekte Taggeld-Berechnung.
              </span>
            </div>
          )}
          {!internationalHint && (
            <p className="text-xs text-muted-foreground">
              Exakter Name wichtig für die 5/15-Tage-Regel
            </p>
          )}
        </div>

        {/* Abreise / Rückkehr */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Abreise</Label>
            <Input
              id="start_time"
              type="datetime-local"
              className="h-10"
              {...register("start_time", { setValueAs: datetimeLocalToISO })}
            />
            {errors.start_time && (
              <p className="text-xs text-destructive">{errors.start_time.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Rückkehr</Label>
            <Input
              id="end_time"
              type="datetime-local"
              className="h-10"
              {...register("end_time", { setValueAs: datetimeLocalToISO })}
            />
            {errors.end_time && (
              <p className="text-xs text-destructive">{errors.end_time.message}</p>
            )}
          </div>
        </div>

        {/* Reiseabschnitte */}
        <Section title="Reiseabschnitte" badge={segments.length}>
          <p className="text-xs text-muted-foreground">
            Einzelne Fahrt-, Flug- oder Zugabschnitte sowie Arbeitszeiten am Zielort erfassen.
          </p>
          <div className="space-y-2">
            {segments.map((seg) => (
              <SegmentRow
                key={seg.id}
                seg={seg}
                onChange={(u) => updateSegment(seg.id, u)}
                onRemove={() => removeSegment(seg.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => addSegment("TRAVEL")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Fahrtabschnitt
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => addSegment("WORK")}>
              <Briefcase className="w-3.5 h-3.5 mr-1" /> Arbeitszeit
            </Button>
          </div>
        </Section>

        {/* Grenzübertritte */}
        <Section title="Grenzübertritte (Ausland)" badge={crossings.length}>
          {/* Explanation callout */}
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-lg px-3 py-2.5">
            <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
              <p className="font-medium">Warum ist das wichtig?</p>
              <p className="text-amber-700 dark:text-amber-400">
                Der genaue Zeitpunkt des Grenzübertritts bestimmt, welches Taggeld gilt — österreichisch (€30/Tag) oder das jeweilige Auslandssatz (BMF-Erlass). Erfasse jeden Übergang Einreise/Ausreise separat.
              </p>
            </div>
          </div>

          {/* Route visualization */}
          {crossings.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Route</p>
              <RouteViz crossings={crossings} />
            </div>
          )}

          {/* Auto-fill from destination */}
          {internationalHint && crossings.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setCrossings([
                  {
                    id: uid(),
                    country_code: "AT",
                    country_name: "Österreich",
                    crossed_at: "",
                    direction: "EXIT",
                  },
                  {
                    id: uid(),
                    country_code: internationalHint.countryCode,
                    country_name: internationalHint.country,
                    crossed_at: "",
                    direction: "ENTRY",
                  },
                ]);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-sm text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="text-base leading-none">{countryFlagEmoji(internationalHint.countryCode)}</span>
              <span className="font-medium">Auto-fill für {internationalHint.country}</span>
              <span className="text-xs text-primary/70 ml-auto">AT → {internationalHint.countryCode} vorausfüllen</span>
            </button>
          )}

          <div className="space-y-3">
            {crossings.map((c, i) => (
              <CrossingRow
                key={c.id}
                index={i}
                crossing={c}
                onChange={(u) => updateCrossing(c.id, u)}
                onRemove={() => removeCrossing(c.id)}
              />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addCrossing}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Grenzübertritt hinzufügen
          </Button>
        </Section>

        {/* Kilometergeld */}
        <div className="space-y-3">
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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">km</span>
            </div>
            {errors.distance_km && (
              <p className="text-xs text-destructive">{errors.distance_km.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Hin- und Rückfahrt (§26 Z 4b EStG · €0,50/km)
            </p>
          </div>

          {/* Passenger */}
          <div className="space-y-1.5">
            <Label htmlFor="passenger_count">
              Beifahrer im PKW{" "}
              <span className="text-muted-foreground font-normal text-xs">(+€0,05/km pro Person)</span>
            </Label>
            <Select
              defaultValue="0"
              onValueChange={(v) => v != null && setValue("passenger_count", parseInt(v, 10))}
            >
              <SelectTrigger className="h-10" id="passenger_count">
                <SelectValue />
              </SelectTrigger>
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
              <SelectItem value="1">1 Mahlzeit (z.B. Frühstück im Hotel)</SelectItem>
              <SelectItem value="2">2 oder mehr Mahlzeiten (z.B. Vollpension)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Inkludierte Mahlzeiten kürzen das Taggeld (§26 Z 4 EStG)
          </p>
        </div>

        {/* Notizen */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">
            Notizen{" "}
            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Kunden, Projekte, sonstige Anmerkungen…"
            className="resize-none"
            rows={2}
            {...register("notes")}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1 h-10 font-medium">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Als Entwurf speichern
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending} className="h-10">
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
