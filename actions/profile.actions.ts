"use server";

/**
 * profile.actions.ts — Server Actions for Profile management.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  UpdateProfileSchema,
  type ActionResult,
  type Profile,
} from "@/lib/schemas";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Nicht autorisiert.");
  return user.id;
}

// ─── GET CURRENT USER'S PROFILE ───────────────────────────────────────────────

export async function getProfile(): Promise<ActionResult<Profile>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return { success: false, error: "Profil nicht gefunden." };
    }

    return { success: true, data: data as Profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── GET ALL PROFILES (Admin only) ────────────────────────────────────────────

export async function getAllProfiles(): Promise<ActionResult<Profile[]>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    // Verify admin role
    const { data: self } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!self || self.role !== "ADMIN") {
      return { success: false, error: "Keine Berechtigung." };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) {
      return { success: false, error: "Profile konnten nicht geladen werden." };
    }

    return { success: true, data: (data ?? []) as Profile[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────

export async function updateProfile(
  rawInput: unknown
): Promise<ActionResult<Profile>> {
  try {
    const userId = await requireAuth();

    const parsed = UpdateProfileSchema.safeParse(rawInput);
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

    const { data, error } = await supabase
      .from("profiles")
      .update(parsed.data)
      .eq("id", userId)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: "Profil konnte nicht aktualisiert werden." };
    }

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return { success: true, data: data as Profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── RESET YTD MILEAGE (Admin / new year) ─────────────────────────────────────

export async function resetYtdMileage(
  targetUserId?: string
): Promise<ActionResult<{ reset: true }>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    // If targeting another user, must be admin
    if (targetUserId && targetUserId !== userId) {
      const { data: self } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!self || self.role !== "ADMIN") {
        return { success: false, error: "Keine Berechtigung." };
      }
    }

    const resetId = targetUserId ?? userId;

    const { error } = await supabase
      .from("profiles")
      .update({ ytd_mileage_km: 0 })
      .eq("id", resetId);

    if (error) {
      return { success: false, error: "Reset fehlgeschlagen." };
    }

    revalidatePath("/dashboard");

    return { success: true, data: { reset: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
