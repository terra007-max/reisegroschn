/**
 * GET /api/export/datev?year=2026
 *
 * Generates a DATEV-compatible CSV export of all approved trips for the
 * authenticated user. Finance teams import this into DATEV Lohn & Gehalt
 * or SAP Payroll.
 *
 * Column mapping follows DATEV Buchungsstapel format (simplified subset
 * relevant for employee expense reimbursements).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveOvernightStays, calculateNaechtigungsgeld } from "@/lib/AustrianTaxCalculator";

export const runtime = "nodejs";

function esc(v: string): string {
  // DATEV CSV uses semicolons; quote fields containing semicolons or quotes
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtEur(v: number | null): string {
  if (v === null) return "0,00";
  return v.toFixed(2).replace(".", ",");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  // Admins can export all; users export only their own
  const isAdmin = profile?.role === "ADMIN";
  let query = supabase
    .from("trips")
    .select("*, profiles(full_name, email)")
    .eq("status", "APPROVED")
    .gte("start_time", `${year}-01-01T00:00:00Z`)
    .lte("start_time", `${year}-12-31T23:59:59Z`)
    .order("start_time", { ascending: true });

  if (!isAdmin) {
    query = query.eq("user_id", user.id);
  }

  const { data: trips, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Build CSV ────────────────────────────────────────────────────────────────
  const headers = [
    "Belegdatum",
    "Buchungstext",
    "Mitarbeiter",
    "E-Mail",
    "Zielort",
    "Abreise",
    "Rückkehr",
    "Dauer (h)",
    "Nächte",
    "km",
    "Taggeld Brutto (€)",
    "Taggeld Netto (€)",
    "Nächtigungsgeld (€)",
    "Kilometergeld (€)",
    "Gesamt steuerfrei (€)",
    "KV-Überschuss steuerpflichtig (€)",
    "Status",
    "Genehmigt am",
  ];

  const rows = (trips ?? []).map((t) => {
    const start = new Date(t.start_time);
    const end = new Date(t.end_time);
    const durationH = (end.getTime() - start.getTime()) / 3_600_000;
    const nights = deriveOvernightStays(start, end);
    const naechtigungsgeld = calculateNaechtigungsgeld({ overnightStays: nights }).taxFreeAmount;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = (t as any).profiles;
    const name = prof?.full_name ?? profile?.full_name ?? "";
    const email = prof?.email ?? user.email ?? "";

    return [
      esc(fmtDate(t.start_time)),
      esc(`Reisekosten ${t.destination}`),
      esc(name),
      esc(email),
      esc(t.destination),
      esc(fmtDate(t.start_time)),
      esc(fmtDate(t.end_time)),
      esc(durationH.toFixed(1).replace(".", ",")),
      esc(String(nights)),
      esc(String(t.distance_km)),
      esc(fmtEur(t.calculated_taggeld_gross)),
      esc(fmtEur(t.calculated_taggeld_net)),
      esc(fmtEur(naechtigungsgeld)),
      esc(fmtEur(t.calculated_mileage_payout)),
      esc(fmtEur(t.calculated_total_tax_free)),
      esc(fmtEur(t.calculated_total_taxable)),
      esc("APPROVED"),
      esc(t.approved_at ? fmtDate(t.approved_at) : ""),
    ].join(";");
  });

  const csv = [headers.join(";"), ...rows].join("\r\n");
  const filename = `ReiseGroschn_DATEV_${year}_${isAdmin ? "alle" : profile?.full_name?.replace(/\s/g, "_") ?? "export"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
