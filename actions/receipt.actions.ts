"use server";

/**
 * receipt.actions.ts — Server Actions for Receipt and ExpenseLine management.
 *
 * Upload flow:
 *  1. Client uploads file directly to Supabase Storage (browser → Storage).
 *  2. Client calls /api/ocr to extract amount + date.
 *  3. Client calls saveReceipt() with path + OCR data to persist the DB records.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, type Receipt } from "@/lib/schemas";

async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Nicht autorisiert.");
  return user.id;
}

// ─── SAVE RECEIPT (after client-side upload + OCR) ────────────────────────────

export interface SaveReceiptInput {
  tripId: string;
  /** Supabase Storage path returned after upload */
  storagePath: string;
  /** Amount as typed/confirmed by the user (post-OCR) */
  confirmedAmount: number;
  /** OCR-extracted amount (may differ if user corrected it) */
  ocrExtractedAmount: number | null;
  ocrExtractedDate: string | null;
  ocrRawText: string | null;
  vatRate: "0" | "10" | "13" | "20";
  description?: string;
}

export async function saveReceipt(
  input: SaveReceiptInput
): Promise<ActionResult<Receipt>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    // Verify the trip belongs to this user and is still editable
    const { data: trip } = await supabase
      .from("trips")
      .select("id, status")
      .eq("id", input.tripId)
      .eq("user_id", userId)
      .single();

    if (!trip) {
      return { success: false, error: "Reise nicht gefunden." };
    }
    if (trip.status === "APPROVED") {
      return {
        success: false,
        error: "Genehmigte Reisen können nicht bearbeitet werden (BAO §131).",
      };
    }

    // 1. Create an ExpenseLine for this receipt
    const { data: expenseLine, error: elError } = await supabase
      .from("expense_lines")
      .insert({
        trip_id: input.tripId,
        type: "RECEIPT",
        amount: input.confirmedAmount,
        vat_rate: input.vatRate,
        description: input.description ?? null,
      })
      .select()
      .single();

    if (elError || !expenseLine) {
      console.error("saveReceipt expense_line error:", elError);
      return { success: false, error: "Ausgabenzeile konnte nicht erstellt werden." };
    }

    // 2. Create the Receipt record linked to the ExpenseLine
    const { data: receipt, error: rError } = await supabase
      .from("receipts")
      .insert({
        expense_line_id: expenseLine.id,
        storage_path: input.storagePath,
        original_amount: input.confirmedAmount,
        ocr_extracted_amount: input.ocrExtractedAmount,
        ocr_extracted_date: input.ocrExtractedDate,
        ocr_raw_text: input.ocrRawText,
      })
      .select()
      .single();

    if (rError || !receipt) {
      // Rollback the expense line
      await supabase.from("expense_lines").delete().eq("id", expenseLine.id);
      return { success: false, error: "Beleg konnte nicht gespeichert werden." };
    }

    revalidatePath(`/trips/${input.tripId}`);

    return { success: true, data: receipt as Receipt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── GET RECEIPTS FOR TRIP ────────────────────────────────────────────────────

export interface ReceiptWithExpenseLine extends Receipt {
  expense_lines: {
    id: string;
    amount: number;
    vat_rate: string;
    description: string | null;
  };
}

export async function getReceiptsForTrip(
  tripId: string
): Promise<ActionResult<ReceiptWithExpenseLine[]>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("receipts")
      .select(
        `
        *,
        expense_lines!inner(
          id, amount, vat_rate, description,
          trips!inner(user_id)
        )
      `
      )
      .eq("expense_lines.trips.user_id", userId)
      .eq("expense_lines.trip_id", tripId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: "Belege konnten nicht geladen werden." };
    }

    return { success: true, data: (data ?? []) as unknown as ReceiptWithExpenseLine[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── DELETE RECEIPT ───────────────────────────────────────────────────────────

export async function deleteReceipt(
  receiptId: string,
  tripId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireAuth();
    const supabase = await createClient();

    // Fetch to get storage_path and verify ownership
    const { data: receipt } = await supabase
      .from("receipts")
      .select(
        `
        id, storage_path, expense_line_id,
        expense_lines!inner(
          id,
          trips!inner(user_id, status)
        )
      `
      )
      .eq("id", receiptId)
      .eq("expense_lines.trips.user_id", userId)
      .single();

    if (!receipt) {
      return { success: false, error: "Beleg nicht gefunden." };
    }

    // Delete from Storage
    await supabase.storage.from("receipts").remove([receipt.storage_path]);

    // Delete the receipt record (expense_line cascades)
    await supabase.from("expense_lines").delete().eq("id", receipt.expense_line_id);

    revalidatePath(`/trips/${tripId}`);

    return { success: true, data: { id: receiptId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// ─── GET SIGNED URL (for viewing a stored receipt) ───────────────────────────

export async function getReceiptSignedUrl(
  storagePath: string
): Promise<ActionResult<{ url: string }>> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(storagePath, 60 * 5); // 5-minute expiry

    if (error || !data) {
      return { success: false, error: "URL konnte nicht erstellt werden." };
    }

    return { success: true, data: { url: data.signedUrl } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
