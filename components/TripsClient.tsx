"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlusCircle, Search, MapPin, X } from "lucide-react";
import type { Trip, TripStatus } from "@/lib/schemas";

type FilterStatus = TripStatus | "ALL";

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "ALL", label: "Alle" },
  { key: "DRAFT", label: "Entwurf" },
  { key: "PENDING", label: "Ausstehend" },
  { key: "APPROVED", label: "Genehmigt" },
  { key: "REJECTED", label: "Abgelehnt" },
];

const STATUS_BORDER: Record<TripStatus, string> = {
  DRAFT: "border-l-slate-300",
  PENDING: "border-l-amber-400",
  APPROVED: "border-l-emerald-500",
  REJECTED: "border-l-red-400",
};

const STATUS_DOT: Record<TripStatus, string> = {
  DRAFT: "bg-slate-300",
  PENDING: "bg-amber-400",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-red-400",
};

function formatCurrency(v: number | null) {
  if (v === null) return "—";
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);
}

function formatDateShort(iso: string) {
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
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getMonthLabel(iso: string) {
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(
    new Date(iso)
  );
}

function groupByMonth(trips: Trip[]): { month: string; trips: Trip[] }[] {
  const groups: Map<string, Trip[]> = new Map();
  for (const trip of trips) {
    const key = getMonthLabel(trip.start_time);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(trip);
  }
  return Array.from(groups.entries()).map(([month, trips]) => ({ month, trips }));
}

interface TripsClientProps {
  trips: Trip[];
}

export default function TripsClient({ trips }: TripsClientProps) {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<FilterStatus, number> = { ALL: trips.length, DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const t of trips) c[t.status]++;
    return c;
  }, [trips]);

  const filtered = useMemo(() => {
    let result = trips;
    if (filter !== "ALL") result = result.filter((t) => t.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.destination.toLowerCase().includes(q) ||
          (t.purpose ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [trips, filter, search]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
        {FILTER_TABS.filter((t) => counts[t.key] > 0 || t.key === "ALL").map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === tab.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            )}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span
                className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 leading-none font-semibold",
                  filter === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zielort oder Reisezweck suchen…"
          className="pl-9 pr-8 h-10"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Trip list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <MapPin className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold">
              {search ? `Keine Ergebnisse für „${search}"` : "Keine Reisen vorhanden"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Versuchen Sie einen anderen Suchbegriff"
                : "Beginnen Sie mit der Erfassung Ihrer ersten Dienstreise"}
            </p>
          </div>
          {!search && (
            <LinkButton href="/trips/new">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Erste Reise erfassen
            </LinkButton>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ month, trips: monthTrips }) => (
            <div key={month} className="space-y-2">
              {/* Month label */}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                {month}
              </p>

              {/* Cards */}
              <div className="space-y-2">
                {monthTrips.map((trip) => (
                  <Link key={trip.id} href={`/trips/${trip.id}`} className="block group">
                    <div
                      className={cn(
                        "bg-card border border-l-[3px] rounded-xl card-shadow",
                        "hover:card-shadow-md hover:border-primary/20 transition-all duration-150",
                        STATUS_BORDER[trip.status]
                      )}
                    >
                      {/* Mobile layout */}
                      <div className="flex items-start gap-3 p-3.5 sm:hidden">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm truncate leading-tight">
                              {trip.destination}
                            </span>
                            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[trip.status])} />
                          </div>
                          {trip.purpose && (
                            <p className="text-xs text-muted-foreground truncate leading-tight">
                              {trip.purpose}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span>{formatDateShort(trip.start_time)}</span>
                            <span className="text-border">·</span>
                            <span>{formatDuration(trip.start_time, trip.end_time)}</span>
                            {trip.distance_km > 0 && (
                              <>
                                <span className="text-border">·</span>
                                <span>{trip.distance_km} km</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-bold text-sm text-primary tabular-nums">
                            {formatCurrency(trip.calculated_total_tax_free)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">steuerfrei</p>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden sm:flex items-center gap-4 px-4 py-3.5">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-semibold text-sm">{trip.destination}</span>
                            <StatusBadge status={trip.status} />
                            {trip.is_secondary_workplace && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">
                                Tätigkeitsmittelpunkt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {trip.purpose && <span className="text-foreground/70">{trip.purpose}</span>}
                            {trip.purpose && <span className="text-border">·</span>}
                            <span>{formatDateShort(trip.start_time)}</span>
                            <span className="text-border">·</span>
                            <span>{formatDuration(trip.start_time, trip.end_time)}</span>
                            {trip.distance_km > 0 && (
                              <>
                                <span className="text-border">·</span>
                                <span>{trip.distance_km} km</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-sm text-primary tabular-nums">
                              {formatCurrency(trip.calculated_total_tax_free)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">steuerfrei</p>
                          </div>
                          <svg
                            className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
