"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  Users,
  Filter,
} from "lucide-react";
import { approveTrip, rejectTrip, approveTripsBatch, exportBmdCsv } from "@/actions/admin.actions";
import type { AdminTrip } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number | null) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(iso));
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  trip,
  open,
  onClose,
  onRejected,
}: {
  trip: AdminTrip;
  open: boolean;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleReject() {
    startTransition(async () => {
      const result = await rejectTrip(trip.id, reason);
      if (result.success) {
        toast.success("Reise abgelehnt");
        onRejected(trip.id);
        onClose();
        setReason("");
      } else {
        toast.error("Fehler", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reise ablehnen</DialogTitle>
          <DialogDescription>
            {trip.destination} — {trip.profiles?.full_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ablehnungsgrund *</label>
            <Input
              placeholder="z.B. Belege fehlen, Betrag zu hoch…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || !reason.trim()}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ablehnen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single trip row ──────────────────────────────────────────────────────────

function TripRow({
  trip,
  selected,
  onSelect,
  onApproved,
  onRejected,
}: {
  trip: AdminTrip;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveTrip(trip.id);
      if (result.success) {
        toast.success("Reise genehmigt", {
          description: `${trip.destination} — ${trip.profiles?.full_name}`,
        });
        onApproved(trip.id);
      } else {
        toast.error("Fehler", { description: result.error });
      }
    });
  }

  const isPending_ = trip.status === "PENDING";

  return (
    <>
      <div
        className={cn(
          "rounded-lg border transition-colors",
          selected ? "border-primary/40 bg-primary/5" : "border-border bg-card",
          expanded && "rounded-b-none border-b-0"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checkbox — only for PENDING */}
          {isPending_ ? (
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-primary flex-shrink-0"
              checked={selected}
              onChange={(e) => onSelect(trip.id, e.target.checked)}
              aria-label={`Reise ${trip.destination} auswählen`}
            />
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}

          {/* Employee */}
          <div className="w-40 flex-shrink-0 min-w-0">
            <p className="text-sm font-medium truncate">
              {trip.profiles?.full_name ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {trip.profiles?.email ?? ""}
            </p>
          </div>

          {/* Destination + date */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{trip.destination}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(trip.start_time)} · {formatDuration(trip.start_time, trip.end_time)}
            </p>
          </div>

          {/* Amount */}
          <div className="w-28 text-right flex-shrink-0">
            <p className="text-sm font-bold text-primary">
              {formatCurrency(trip.calculated_total_tax_free)}
            </p>
            {(trip.calculated_total_taxable ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                +{formatCurrency(trip.calculated_total_taxable)} stpfl.
              </p>
            )}
          </div>

          {/* Status */}
          <div className="w-24 flex-shrink-0 flex justify-center">
            <StatusBadge status={trip.status} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending_ && (
              <>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="h-7 px-2 text-xs"
                  title="Genehmigen"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRejectOpen(true)}
                  disabled={isPending}
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Ablehnen"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 px-2"
              title={expanded ? "Zuklappen" : "Details"}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded detail row */}
        {expanded && (
          <div className="border-t px-4 py-3 grid grid-cols-4 gap-3 text-xs bg-muted/20">
            <div>
              <p className="text-muted-foreground">Taggeld</p>
              <p className="font-medium">{formatCurrency(trip.calculated_taggeld_net)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Kilometergeld</p>
              <p className="font-medium">
                {formatCurrency(trip.calculated_mileage_payout)} ({trip.distance_km} km)
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Mahlzeiten</p>
              <p className="font-medium">
                {["Keine", "1", "2+"][trip.meals_provided]}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">KV-Satz</p>
              <p className="font-medium">
                €{Number(trip.profiles?.kv_daily_rate ?? 30).toFixed(2)}/Tag
              </p>
            </div>
            {trip.is_secondary_workplace && (
              <div className="col-span-4 text-amber-700 bg-amber-50 rounded px-2 py-1">
                Tätigkeitsmittelpunkt — Taggeld €0 (5/15-Tage-Regel)
              </div>
            )}
            {trip.notes && (
              <div className="col-span-4 text-muted-foreground italic">
                &ldquo;{trip.notes}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      <RejectDialog
        trip={trip}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onRejected={onRejected}
      />
    </>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function AdminTripTable({
  initialTrips,
}: {
  initialTrips: AdminTrip[];
}) {
  const [trips, setTrips] = useState<AdminTrip[]>(initialTrips);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [search, setSearch] = useState("");
  const [isBatchPending, startBatch] = useTransition();
  const [isExporting, startExport] = useTransition();

  const pendingTrips = trips.filter((t) => t.status === "PENDING");

  const filtered = trips.filter((t) => {
    const matchesStatus = filter === "ALL" || t.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.destination.toLowerCase().includes(q) ||
      t.profiles?.full_name?.toLowerCase().includes(q) ||
      t.profiles?.email?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const pendingIds = filtered
        .filter((t) => t.status === "PENDING")
        .map((t) => t.id);
      setSelected(new Set(pendingIds));
    } else {
      setSelected(new Set());
    }
  }

  function handleApproved(id: string) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "APPROVED" as const } : t
      )
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleRejected(id: string) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "REJECTED" as const } : t
      )
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleBatchApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    startBatch(async () => {
      const result = await approveTripsBatch(ids);
      if (result.success) {
        toast.success(
          `${result.data.approved} ${result.data.approved === 1 ? "Reise" : "Reisen"} genehmigt`,
          result.data.failed > 0
            ? { description: `${result.data.failed} konnten nicht genehmigt werden.` }
            : undefined
        );
        setTrips((prev) =>
          prev.map((t) =>
            ids.includes(t.id) && t.status === "PENDING"
              ? { ...t, status: "APPROVED" as const }
              : t
          )
        );
        setSelected(new Set());
      } else {
        toast.error("Fehler", { description: result.error });
      }
    });
  }

  function handleExport() {
    startExport(async () => {
      const result = await exportBmdCsv();
      if (result.success) {
        const blob = new Blob([result.data.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("BMD-Export heruntergeladen", {
          description: result.data.filename,
        });
      } else {
        toast.error("Export fehlgeschlagen", { description: result.error });
      }
    });
  }

  const allPendingSelected =
    pendingTrips.length > 0 &&
    filtered
      .filter((t) => t.status === "PENDING")
      .every((t) => selected.has(t.id));

  // Stats
  const stats = {
    pending: trips.filter((t) => t.status === "PENDING").length,
    approved: trips.filter((t) => t.status === "APPROVED").length,
    rejected: trips.filter((t) => t.status === "REJECTED").length,
  };

  return (
    <div className="space-y-5">
      {/* Stat chips */}
      <div className="flex gap-3 flex-wrap">
        {[
          { key: "ALL", label: "Alle", count: trips.length },
          { key: "PENDING", label: "Ausstehend", count: stats.pending, color: "text-amber-700 bg-amber-50 border-amber-200" },
          { key: "APPROVED", label: "Genehmigt", count: stats.approved, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { key: "REJECTED", label: "Abgelehnt", count: stats.rejected, color: "text-red-700 bg-red-50 border-red-200" },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
              filter === key
                ? color ?? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {label}
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-xs ml-0.5 font-bold"
            >
              {count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Mitarbeiter oder Zielort…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="ml-auto flex gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={handleBatchApprove}
              disabled={isBatchPending}
              className="gap-1.5"
            >
              {isBatchPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {selected.size} genehmigen
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-1.5"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            BMD-Export
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-20" />
            <p className="text-sm">
              {filter === "PENDING"
                ? "Keine ausstehenden Reisen"
                : "Keine Einträge gefunden"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select-all header for PENDING view */}
          {filter !== "APPROVED" && filter !== "REJECTED" && pendingTrips.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary"
                checked={allPendingSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                aria-label="Alle auswählen"
              />
              <span>Alle ausstehenden auswählen</span>
              {selected.size > 0 && (
                <span className="text-primary font-medium">
                  {selected.size} ausgewählt
                </span>
              )}
            </div>
          )}

          {filtered.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              selected={selected.has(trip.id)}
              onSelect={handleSelect}
              onApproved={handleApproved}
              onRejected={handleRejected}
            />
          ))}
        </div>
      )}

      <Separator />

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} Einträge</span>
        <span>
          Gesamt genehmigt:{" "}
          <strong className="text-foreground">
            {new Intl.NumberFormat("de-AT", {
              style: "currency",
              currency: "EUR",
            }).format(
              trips
                .filter((t) => t.status === "APPROVED")
                .reduce((s, t) => s + (t.calculated_total_tax_free ?? 0), 0)
            )}
          </strong>
        </span>
      </div>
    </div>
  );
}
