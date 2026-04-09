"use server";

/**
 * trip.actions.ts — Server Actions for Trip management.
 *
 * All mutations run server-side. Auth is verified on every action.
 * The AustrianTaxCalculator is invoked here; clients never compute tax values.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calculateTaggeld,
  calculateMileage,
  calculateNaechtigungsgeld,
  deriveOvernightStays,
  checkDestinationRule,
  roundCents,
} from "@/lib/AustrianTaxCalculator";
import {
  CreateTripSchema,
  UpdateTripSchema,
  type ActionResult,
  type Trip,
  type CreateTripInput,
} from "@/lib/schemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifies session and returns the authenticated user's id. Throws on failure. */
async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Nicht autorisiert. Bitte erneut anmelden.");
  }
  return user.id;
}

/**
 * Queries the DB to determine the 5/15-day rule context for a destination.
 *
 * Returns:
 * - consecutiveDays: unbroken chain of days ending at the proposed start_time
 * - yearlyDays: total distinct calendar days at this destination in the current year
 */
async function getDestinationContext(
  userId: string,
  destination: string,
  startTime: Date
): Promise<{ consecutiveDays: number; yearlyDays: number }> {
  const supabase = await createClient();

  const currentYear = startTime.getFullYear();
  const yearStart = new Date(currentYear, 0, 1).toISOString();
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();

  // Fetch all non-rejected trips to the same destination this year
  const { data: existingTrips } = await supabase
    .from("trips")
    .select("start_time, end_time")
    .eq("user_id", userId)
    .ilike("destination", destination.trim())
    .neq("status", "REJECTED")
    .gte("start_time", yearStart)
    .lte("end_time", yearEnd)
    .order("start_time", { ascending: false });

  if (!existingTrips || existingTrips.length === 0) {
    return { consecutiveDays: 1, yearlyDays: 1 };
  }

  // Count distinct calendar days in the year
  const distinctDays = new Set<string>();
  for (const trip of existingTrips) {
    const d = new Date(trip.start_time);
    distinctDays.add(d.toISOString().slice(0, 10));
  }
  const yearlyDays = distinctDays.size + 1; // +1 for the current trip

  // Count consecutive days: walk backwards from startTime
  let consecutiveDays = 1;
  let checkDate = new Date(startTime);
  checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const found = existingTrips.some(
      (t) => new Date(t.start_time).toISOString().slice(0, 10) === dateStr
    );
    if (!found) break;
    consecutiveDays++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { consecutiveDays, yearlyDays };
}

/**
 * Runs the full Austrian tax calculation for a trip and returns the DB-ready
 * calculated fields. Reads ytd_mileage and kv_daily_rate from the profile.
 */
async function runCalculations(
  userId: string,
  input: CreateTripInput,
  excludeTripId?: string
) {
  const supabase = await createClient();

  // Fetch profile for KV rate + YTD mileage.
  // If the row is missing (e.g. signup trigger failed), create it with safe defaults.
  let { data: profile } = await supabase
    .from("profiles")
    .select("kv_daily_rate, ytd_mileage_km")
    .eq("id", userId)
    .single();

  if (!profile) {
    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email ?? "";
    const fullName = authUser.user?.user_metadata?.full_name ?? email;
    await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      role: "USER",
      kv_daily_rate: 30,
      ytd_mileage_km: 0,
    });
    profile = { kv_daily_rate: 30, ytd_mileage_km: 0 };
  }

  // If updating an existing trip, we need to subtract its distance from YTD
  // to avoid double-counting when recalculating.
  let ytdMileageKm = profile.ytd_mileage_km;
  if (excludeTripId) {
    const { data: oldTrip } = await supabase
      .from("trips")
      .select("distance_km")
      .eq("id", excludeTripId)
      .single();
    if (oldTrip) {
      ytdMileageKm = Math.max(0, ytdMileageKm - oldTrip.distance_km);
    }
  }

  const startTime = new Date(input.start_time);
  const endTime = new Date(input.end_time);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationInHours = durationMs / (1000 * 60 * 60);

  // 5/15-day rule
  const { consecutiveDays, yearlyDays } = await getDestinationContext(
    userId,
    input.destination,
    startTime
  );

  const destinationRule = checkDestinationRule({
    consecutiveDaysAtDestination: consecutiveDays,
    totalDaysThisYearAtDestination: yearlyDays,
  });

  // Taggeld
  const taggeld = destinationRule.isSecondaryWorkplace
    ? {
        grossStatutory: 0,
        net: 0,
        taxFreeAmount: 0,
        taxableAmount: 0,
        mealDeduction: 0,
        triggersTaggeld: false,
      }
    : calculateTaggeld({
        durationInHours,
        mealsProvided: input.meals_provided as 0 | 1 | 2,
        kvDailyRate: Number(profile.kv_daily_rate),
      });

  // Nächtigungsgeld (§26 Z 4 EStG) — €17/night, derived from trip duration
  const overnightStays = deriveOvernightStays(startTime, endTime);
  const naechtigungsgeld = destinationRule.isSecondaryWorkplace
    ? { taxFreeAmount: 0, qualifyingNights: 0 }
    : calculateNaechtigungsgeld({ overnightStays });

  // Kilometergeld
  const mileage = calculateMileage({
    distanceKm: input.distance_km,
    ytdMileageKm,
  });

  return {
    // For DB storage
    calculated_taggeld_gross: roundCents(taggeld.grossStatutory),
    calculated_taggeld_net: roundCents(taggeld.net),
    calculated_mileage_payout: mileage.payout,
    calculated_total_tax_free: roundCents(
      taggeld.net + naechtigungsgeld.taxFreeAmount + mileage.payout
    ),
    calculated_total_taxable: roundCents(taggeld.taxableAmount),
    consecutive_days_at_destination: consecutiveDays,
    total_days_this_year: yearlyDays,
    is_secondary_workplace: destinationRule.isSecondaryWorkplace,
    // For YTD update
    newYtdMileageKm: mileage.newYtdMileageKm,
  };
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createTrip(
  rawInput: unknown
): Promise<ActionResult<Trip>> {
  try {
    const userId = await requireAuth();

    const parsed = CreateTripSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Ungültige Eingabe",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const input = parsed.data;

    // ── Duplicate detection ──────────────────────────────────────────────────
    // Block re-submission of the same trip (same destination within ±2h of start).
    const supabase = await createClient();
    const startWindow = new Date(new Date(input.start_time).getTime() - 2 * 3600_000).toISOString();
    const endWindow   = new Date(new Date(input.start_time).getTime() + 2 * 3600_000).toISOString();
    const { data: duplicates } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", userId)
      .ilike("destination", input.destination.trim())
      .gte("start_time", startWindow)
      .lte("start_time", endWindow)
      .neq("status", "REJECTED");
    if (duplicates && duplicates.length > 0) {
      return {
        success: false,
        error: "Mögliches Duplikat: Eine Reise zum gleichen Ziel zu dieser Zeit wurde bereits erfasst.",
      };
    }

    const calcs = await runCalculations(userId, input);

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        destination: input.destination,
        start_time: input.start_time,
        end_time: input.end_time,
        distance_km: input.distance_km,
        meals_provided: input.meals_provided,
        notes: input.notes ?? null,
        status: "DRAFT",
        ...calcs,
      })
      .select()
      .single();

    if (error || !trip) {
      console.error("createTrip DB error:", error);
      return {
        success: false,
        error: error?.message ?? "Reise konnte nicht gespeichert werden.",
      };
    }

    // Update YTD mileage on the profile
    await supabase
      .from("profiles")
      .update({ ytd_mileage_km: calcs.newYtdMileageKm })
      .eq("id", userId);

    revalidatePath("/trips");
    revalidatePath("/dashboard");

    return { success: true, data: trip as Trip };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateTrip(
  tripId: string,
  rawInput: unknown
): Promise<ActionResult<Trip>> {
  try {
    const userId = await requireAuth();

    const idParsed = z.string().uuid().safeParse(tripId);
    if (!idParsed.success) {
      return { success: false, error: "Ungültige Reise-ID." };
    }

    const parsed = UpdateTripSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Ungültige Eingabe",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const supabase = await createClient();

    // Verify ownership and that trip is still editable
    const { data: existing } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return { success: false, error: "Reise nicht gefunden." };
    }

    if (!["DRAFT", "PENDING"].includes(existing.status)) {
      return {
        success: false,
        error: "Genehmigte oder abgelehnte Reisen können nicht bearbeitet werden.",
      };
    }

    // Merge with existing values so partial updates work
    const merged: CreateTripInput = {
      destination: parsed.data.destination ?? existing.destination,
      start_time: parsed.data.start_time ?? existing.start_time,
      end_time: parsed.data.end_time ?? existing.end_time,
      distance_km: parsed.data.distance_km ?? existing.distance_km,
      meals_provided:
        (parsed.data.meals_provided as 0 | 1 | 2) ?? existing.meals_provided,
      notes: parsed.data.notes ?? existing.notes ?? undefined,
    };

    const calcs = await runCalculations(userId, merged, tripId);

    const { data: trip, error } = await supabase
      .from("trips")
      .update({
        ...merged,
        ...calcs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !trip) {
      console.error("updateTrip DB error:", error);
      return { success: false, error: "Reise konnte nicht aktualisiert werden." };
    }

    // Adjust YTD mileage (old was subtracted in runCalculations, new is added)
    await supabase
      .from("profiles")
      .update({ ytd_mileage_km: calcs.newYtdMileageKm })
      .eq("id", userId);

    revalidatePath("/trips");
    revalidatePath(`/trips/${tripId}`);
    revalidatePath("/dashboard");

    return { success: true, data: trip as Trip };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── SUBMIT (DRAFT → PENDING) ─────────────────────────────────────────────────

export async function submitTrip(tripId: string): Promise<ActionResult<Trip>> {
  try {
    const userId = await requireAuth();

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return { success: false, error: "Reise nicht gefunden." };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false,
        error: `Reise ist bereits im Status "${existing.status}" und kann nicht eingereicht werden.`,
      };
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .update({ status: "PENDING" })
      .eq("id", tripId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !trip) {
      return { success: false, error: "Einreichung fehlgeschlagen." };
    }

    revalidatePath("/trips");
    revalidatePath(`/trips/${tripId}`);

    return { success: true, data: trip as Trip };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteTrip(
  tripId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireAuth();

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("trips")
      .select("status, distance_km")
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return { success: false, error: "Reise nicht gefunden." };
    }

    if (existing.status === "APPROVED") {
      return {
        success: false,
        error: "Genehmigte Reisen können nicht gelöscht werden (BAO §131).",
      };
    }

    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", tripId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: "Reise konnte nicht gelöscht werden." };
    }

    // Subtract this trip's mileage from YTD (only for non-approved trips)
    const { data: profile } = await supabase
      .from("profiles")
      .select("ytd_mileage_km")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          ytd_mileage_km: Math.max(
            0,
            profile.ytd_mileage_km - existing.distance_km
          ),
        })
        .eq("id", userId);
    }

    revalidatePath("/trips");
    revalidatePath("/dashboard");

    return { success: true, data: { id: tripId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

export async function getTrips(filters?: {
  status?: Trip["status"];
  limit?: number;
  offset?: number;
}): Promise<ActionResult<Trip[]>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    let query = supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .order("start_time", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.limit) {
      const offset = filters.offset ?? 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: "Reisen konnten nicht geladen werden." };
    }

    return { success: true, data: (data ?? []) as Trip[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────

export async function getTripById(
  tripId: string
): Promise<ActionResult<Trip & { expense_lines: unknown[] }>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("trips")
      .select("*, expense_lines(*)")
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return { success: false, error: "Reise nicht gefunden." };
    }

    return { success: true, data: data as Trip & { expense_lines: unknown[] } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── PREVIEW (no DB write) ────────────────────────────────────────────────────

/**
 * Calculates Taggeld + Kilometergeld for a trip WITHOUT saving to DB.
 * Used for the real-time preview in the trip creation form.
 */
export async function previewTrip(rawInput: unknown): Promise<
  ActionResult<{
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
  }>
> {
  try {
    const userId = await requireAuth();

    const parsed = CreateTripSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: "Ungültige Eingabe für Vorschau." };
    }

    const input = parsed.data;
    const supabase = await createClient();

    let { data: profile } = await supabase
      .from("profiles")
      .select("kv_daily_rate, ytd_mileage_km")
      .eq("id", userId)
      .single();

    if (!profile) {
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser.user?.email ?? "";
      const fullName = authUser.user?.user_metadata?.full_name ?? email;
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email,
        role: "USER",
        kv_daily_rate: 30,
        ytd_mileage_km: 0,
      });
      profile = { kv_daily_rate: 30, ytd_mileage_km: 0 };
    }

    const startTime = new Date(input.start_time);
    const endTime = new Date(input.end_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationInHours = durationMs / (1000 * 60 * 60);

    const { consecutiveDays, yearlyDays } = await getDestinationContext(
      userId,
      input.destination,
      startTime
    );

    const destinationRule = checkDestinationRule({
      consecutiveDaysAtDestination: consecutiveDays,
      totalDaysThisYearAtDestination: yearlyDays,
    });

    const taggeld = destinationRule.isSecondaryWorkplace
      ? {
          grossStatutory: 0,
          net: 0,
          taxableAmount: 0,
          triggersTaggeld: false,
        }
      : calculateTaggeld({
          durationInHours,
          mealsProvided: input.meals_provided as 0 | 1 | 2,
          kvDailyRate: Number(profile.kv_daily_rate),
        });

    const overnightStays = deriveOvernightStays(startTime, endTime);
    const naechtigungsgeld = destinationRule.isSecondaryWorkplace
      ? { taxFreeAmount: 0, qualifyingNights: 0 }
      : calculateNaechtigungsgeld({ overnightStays });

    const mileage = calculateMileage({
      distanceKm: input.distance_km,
      ytdMileageKm: profile.ytd_mileage_km,
    });

    return {
      success: true,
      data: {
        durationInHours: roundCents(durationInHours),
        taggeldGross: roundCents(taggeld.grossStatutory),
        taggeldNet: roundCents(taggeld.net),
        naechtigungsgeld: naechtigungsgeld.taxFreeAmount,
        overnightStays,
        mileagePayout: mileage.payout,
        totalTaxFree: roundCents(
          taggeld.net + naechtigungsgeld.taxFreeAmount + mileage.payout
        ),
        totalTaxable: roundCents(taggeld.taxableAmount),
        isSecondaryWorkplace: destinationRule.isSecondaryWorkplace,
        triggersTaggeld: taggeld.triggersTaggeld ?? false,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
