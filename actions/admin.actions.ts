"use server";

/**
 * admin.actions.ts — Server Actions for HR/Admin trip management.
 *
 * All actions verify ADMIN role before executing.
 * Approved trips are immutable per BAO §131 (enforced by DB trigger).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Trip } from "@/lib/schemas";

// ─── Auth + role guard ────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Nicht autorisiert.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    throw new Error("Keine Admin-Berechtigung.");
  }
  return user.id;
}

// ─── GET ALL PENDING TRIPS (admin view) ───────────────────────────────────────

export interface AdminTrip extends Trip {
  profiles: {
    full_name: string;
    email: string;
    kv_daily_rate: number;
  };
}

export async function getAdminTrips(filters?: {
  status?: Trip["status"];
}): Promise<ActionResult<AdminTrip[]>> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase
      .from("trips")
      .select("*, profiles!trips_user_id_fkey(full_name, email, kv_daily_rate)")
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: "Reisen konnten nicht geladen werden." };
    }

    return { success: true, data: (data ?? []) as unknown as AdminTrip[] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}

// ─── APPROVE ──────────────────────────────────────────────────────────────────

export async function approveTrip(
  tripId: string
): Promise<ActionResult<Trip>> {
  try {
    const adminId = await requireAdmin();
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (!existing) return { success: false, error: "Reise nicht gefunden." };
    if (existing.status !== "PENDING") {
      return { success: false, error: "Nur ausstehende Reisen können genehmigt werden." };
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .update({
        status: "APPROVED",
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .select()
      .single();

    if (error || !trip) {
      return { success: false, error: "Genehmigung fehlgeschlagen." };
    }

    revalidatePath("/admin");
    revalidatePath(`/trips/${tripId}`);

    return { success: true, data: trip as Trip };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}

// ─── BATCH APPROVE ────────────────────────────────────────────────────────────

export async function approveTripsBatch(
  tripIds: string[]
): Promise<ActionResult<{ approved: number; failed: number }>> {
  try {
    const adminId = await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("trips")
      .update({
        status: "APPROVED",
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .in("id", tripIds)
      .eq("status", "PENDING")
      .select("id");

    if (error) {
      return { success: false, error: "Batch-Genehmigung fehlgeschlagen." };
    }

    const approved = data?.length ?? 0;
    const failed = tripIds.length - approved;

    revalidatePath("/admin");
    revalidatePath("/trips");

    return { success: true, data: { approved, failed } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}

// ─── REJECT ───────────────────────────────────────────────────────────────────

export async function rejectTrip(
  tripId: string,
  reason: string
): Promise<ActionResult<Trip>> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    if (!reason.trim()) {
      return { success: false, error: "Ablehnungsgrund ist erforderlich." };
    }

    const { data: existing } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (!existing) return { success: false, error: "Reise nicht gefunden." };
    if (!["PENDING", "APPROVED"].includes(existing.status)) {
      return { success: false, error: "Diese Reise kann nicht abgelehnt werden." };
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .update({ status: "REJECTED", rejection_reason: reason.trim() })
      .eq("id", tripId)
      .select()
      .single();

    if (error || !trip) {
      return { success: false, error: "Ablehnung fehlgeschlagen." };
    }

    revalidatePath("/admin");
    revalidatePath(`/trips/${tripId}`);

    return { success: true, data: trip as Trip };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}

// ─── BMD CSV EXPORT ───────────────────────────────────────────────────────────

/**
 * Generates a BMD-compatible CSV of approved trips.
 *
 * BMD column format:
 * Date | Account | Amount | VAT_Code | Cost_Center | Description
 *
 * Austrian BMD accounting conventions:
 * - Date: DD.MM.YYYY
 * - Account: 7300 (Reisespesen steuerf.) | 7310 (KV-Überschuss steuerpfl.)
 * - VAT_Code: 0 (tax-free per §26 EStG)
 * - Cost_Center: employee email (used as cost centre reference)
 * - Amount: comma as decimal separator (e.g. 12,50)
 */
export async function exportBmdCsv(filters?: {
  fromDate?: string;
  toDate?: string;
  userId?: string;
}): Promise<ActionResult<{ csv: string; filename: string }>> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase
      .from("trips")
      .select(
        `
        id, destination, start_time, end_time,
        calculated_taggeld_net, calculated_mileage_payout,
        calculated_total_tax_free, calculated_total_taxable,
        distance_km, approved_at,
        profiles!trips_user_id_fkey(full_name, email)
      `
      )
      .eq("status", "APPROVED")
      .order("approved_at", { ascending: true });

    if (filters?.fromDate) query = query.gte("approved_at", filters.fromDate);
    if (filters?.toDate) query = query.lte("approved_at", filters.toDate);
    if (filters?.userId) query = query.eq("user_id", filters.userId);

    const { data: trips, error } = await query;
    if (error || !trips) {
      return { success: false, error: "Export fehlgeschlagen." };
    }

    // Build CSV
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const SEPARATOR = ";"; // BMD uses semicolon

    const header = [
      "Datum",
      "Konto",
      "Betrag",
      "MwSt.-Code",
      "Kostenstelle",
      "Beschreibung",
    ].join(SEPARATOR);

    const formatDateBmd = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    };

    const formatAmountBmd = (v: number) =>
      v.toFixed(2).replace(".", ",");

    const rows: string[] = [];

    for (const trip of trips) {
      const profile = trip.profiles as unknown as { full_name: string; email: string } | null;
      const date = formatDateBmd(trip.approved_at ?? trip.start_time);
      const costCentre = profile?.email ?? "";
      const employee = profile?.full_name ?? "";

      // Row 1: Tax-free reimbursement (Taggeld + Kilometergeld)
      const taxFree = (trip.calculated_total_tax_free as number | null) ?? 0;
      if (taxFree > 0) {
        rows.push(
          [
            date,
            "7300", // Reisespesen steuerfrei §26 EStG
            formatAmountBmd(taxFree),
            "0",    // MwSt.-Code 0 = steuerbefreit
            costCentre,
            `Reisespesen ${employee} — ${trip.destination} (${formatDateBmd(trip.start_time)})`,
          ].join(SEPARATOR)
        );
      }

      // Row 2: Taxable KV excess (only if > 0)
      const taxable = (trip.calculated_total_taxable as number | null) ?? 0;
      if (taxable > 0) {
        rows.push(
          [
            date,
            "7310", // Reisespesen steuerpflichtig (KV-Überschuss)
            formatAmountBmd(taxable),
            "0",
            costCentre,
            `KV-Überschuss ${employee} — ${trip.destination} (${formatDateBmd(trip.start_time)})`,
          ].join(SEPARATOR)
        );
      }
    }

    const csv = BOM + [header, ...rows].join("\r\n");

    const now = new Date();
    const filename = `evodia_bmd_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.csv`;

    return { success: true, data: { csv, filename } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  kpis: {
    totalTrips: number;
    approvedTrips: number;
    pendingTrips: number;
    rejectedTrips: number;
    totalTaxFreeEur: number;
    totalTaxableEur: number;
    totalTaggeldEur: number;
    totalMileageEur: number;
    totalKm: number;
  };
  monthlyTrend: { month: string; taxFree: number; trips: number }[];
  costBreakdown: { name: string; value: number }[];
  topDestinations: { destination: string; count: number; totalEur: number }[];
  topEmployees: { name: string; email: string; trips: number; totalEur: number }[];
  statusDistribution: { status: string; count: number }[];
}

export async function getAnalytics(filters?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ActionResult<AnalyticsData>> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase
      .from("trips")
      .select(
        "id, destination, status, start_time, end_time, distance_km, calculated_total_tax_free, calculated_total_taxable, calculated_taggeld_net, calculated_mileage_payout, created_at, approved_at, profiles!trips_user_id_fkey(full_name, email)"
      )
      .order("created_at", { ascending: true });

    if (filters?.fromDate) query = query.gte("created_at", filters.fromDate);
    if (filters?.toDate) query = query.lte("created_at", filters.toDate);

    const { data: trips, error } = await query;
    if (error || !trips) return { success: false, error: "Daten konnten nicht geladen werden." };

    // ── KPIs ──
    const approved = trips.filter((t) => t.status === "APPROVED");
    const pending  = trips.filter((t) => t.status === "PENDING");
    const rejected = trips.filter((t) => t.status === "REJECTED");

    const sum = (arr: typeof trips, key: "calculated_total_tax_free" | "calculated_total_taxable" | "calculated_taggeld_net" | "calculated_mileage_payout" | "distance_km") =>
      arr.reduce((acc, t) => acc + ((t[key] as number | null) ?? 0), 0);

    // ── Monthly trend (last 12 months) ──
    const monthMap = new Map<string, { taxFree: number; trips: number }>();
    for (const t of trips) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) ?? { taxFree: 0, trips: 0 };
      monthMap.set(key, {
        taxFree: existing.taxFree + ((t.calculated_total_tax_free as number | null) ?? 0),
        trips: existing.trips + 1,
      });
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v }));

    // ── Cost breakdown (approved only) ──
    const taggeld  = sum(approved, "calculated_taggeld_net");
    const mileage  = sum(approved, "calculated_mileage_payout");
    const naechtigungsgeld = Math.max(0, sum(approved, "calculated_total_tax_free") - taggeld - mileage);
    const costBreakdown = [
      { name: "TAGGELD", value: Math.round(taggeld * 100) / 100 },
      { name: "KILOMETERGELD", value: Math.round(mileage * 100) / 100 },
      { name: "NAECHTIGUNGSGELD", value: Math.round(naechtigungsgeld * 100) / 100 },
    ].filter((c) => c.value > 0);

    // ── Top destinations ──
    const destMap = new Map<string, { count: number; totalEur: number }>();
    for (const t of trips) {
      const dest = t.destination;
      const existing = destMap.get(dest) ?? { count: 0, totalEur: 0 };
      destMap.set(dest, {
        count: existing.count + 1,
        totalEur: existing.totalEur + ((t.calculated_total_tax_free as number | null) ?? 0),
      });
    }
    const topDestinations = Array.from(destMap.entries())
      .map(([destination, v]) => ({ destination, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── Top employees ──
    const empMap = new Map<string, { name: string; trips: number; totalEur: number }>();
    for (const t of trips) {
      const prof = t.profiles as unknown as { full_name: string; email: string } | null;
      const key = prof?.email ?? "unknown";
      const existing = empMap.get(key) ?? { name: prof?.full_name ?? key, trips: 0, totalEur: 0 };
      empMap.set(key, {
        name: prof?.full_name ?? key,
        trips: existing.trips + 1,
        totalEur: existing.totalEur + ((t.calculated_total_tax_free as number | null) ?? 0),
      });
    }
    const topEmployees = Array.from(empMap.entries())
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.totalEur - a.totalEur)
      .slice(0, 8);

    return {
      success: true,
      data: {
        kpis: {
          totalTrips: trips.length,
          approvedTrips: approved.length,
          pendingTrips: pending.length,
          rejectedTrips: rejected.length,
          totalTaxFreeEur: Math.round(sum(approved, "calculated_total_tax_free") * 100) / 100,
          totalTaxableEur: Math.round(sum(approved, "calculated_total_taxable") * 100) / 100,
          totalTaggeldEur: Math.round(taggeld * 100) / 100,
          totalMileageEur: Math.round(mileage * 100) / 100,
          totalKm: sum(trips, "distance_km"),
        },
        monthlyTrend,
        costBreakdown,
        topDestinations,
        topEmployees,
        statusDistribution: [
          { status: "APPROVED", count: approved.length },
          { status: "PENDING", count: pending.length },
          { status: "REJECTED", count: rejected.length },
          { status: "DRAFT", count: trips.filter((t) => t.status === "DRAFT").length },
        ],
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Fehler" };
  }
}
