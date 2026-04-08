/**
 * schemas.ts
 *
 * Zod schemas for all domain types.
 * These are the single source of truth for validation — used in both
 * Server Actions (input sanitisation) and the client (real-time previews).
 */

import { z } from "zod";

// ─── Enums (mirror the Postgres enums exactly) ────────────────────────────────

export const TripStatusSchema = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export const ExpenseTypeSchema = z.enum(["TAGGELD", "MILEAGE", "MEAL_DEDUCTION", "RECEIPT"]);
export const VatRateSchema = z.enum(["0", "10", "13", "20"]);
export const UserRoleSchema = z.enum(["USER", "ADMIN"]);

export type TripStatus = z.infer<typeof TripStatusSchema>;
export type ExpenseType = z.infer<typeof ExpenseTypeSchema>;
export type VatRate = z.infer<typeof VatRateSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;

// ─── Profile ──────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1, "Name erforderlich"),
  email: z.string().email(),
  role: UserRoleSchema,
  kv_daily_rate: z.number().min(30, "KV-Satz muss mindestens €30 betragen"),
  ytd_mileage_km: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(1, "Name erforderlich").optional(),
  kv_daily_rate: z
    .number()
    .min(30, "KV-Satz muss mindestens €30 betragen")
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ─── Trip ─────────────────────────────────────────────────────────────────────

/**
 * The shape used when creating or updating a trip (user-supplied fields only).
 * The server derives all calculated fields.
 */
export const CreateTripSchema = z
  .object({
    destination: z
      .string()
      .min(2, "Zielort muss mindestens 2 Zeichen haben")
      .max(200, "Zielort zu lang")
      .transform((v) => v.trim()),

    start_time: z
      .string()
      .datetime({ message: "Ungültiges Startdatum" }),

    end_time: z
      .string()
      .datetime({ message: "Ungültiges Enddatum" }),

    distance_km: z
      .number({ error: "Kilometer muss eine Zahl sein" })
      .int("Kilometer muss eine ganze Zahl sein")
      .min(0, "Kilometer kann nicht negativ sein")
      .max(5000, "Kilometer pro Fahrt zu hoch (max. 5000)"),

    meals_provided: z
      .union([z.literal(0), z.literal(1), z.literal(2)])
      .default(0),

    notes: z.string().max(1000).optional(),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: "Enddatum muss nach dem Startdatum liegen",
    path: ["end_time"],
  })
  .refine(
    (data) => {
      const durationMs =
        new Date(data.end_time).getTime() - new Date(data.start_time).getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return durationHours <= 7 * 24; // max 7 days per trip entry
    },
    {
      message: "Reisedauer darf 7 Tage nicht überschreiten",
      path: ["end_time"],
    }
  );

export type CreateTripInput = z.infer<typeof CreateTripSchema>;

export const UpdateTripSchema = CreateTripSchema.partial();
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;

/** Full trip row as returned from the DB (with all calculated fields). */
export const TripSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  destination: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  distance_km: z.number().int(),
  meals_provided: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  status: TripStatusSchema,
  calculated_taggeld_gross: z.number().nullable(),
  calculated_taggeld_net: z.number().nullable(),
  calculated_mileage_payout: z.number().nullable(),
  calculated_total_tax_free: z.number().nullable(),
  calculated_total_taxable: z.number().nullable(),
  consecutive_days_at_destination: z.number().int(),
  total_days_this_year: z.number().int(),
  is_secondary_workplace: z.boolean(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Trip = z.infer<typeof TripSchema>;

// ─── Expense Line ─────────────────────────────────────────────────────────────

export const CreateExpenseLineSchema = z.object({
  trip_id: z.string().uuid(),
  type: ExpenseTypeSchema,
  amount: z.number().min(0, "Betrag kann nicht negativ sein"),
  vat_rate: VatRateSchema.default("0"),
  description: z.string().max(500).optional(),
});

export type CreateExpenseLineInput = z.infer<typeof CreateExpenseLineSchema>;

export const ExpenseLineSchema = CreateExpenseLineSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
});

export type ExpenseLine = z.infer<typeof ExpenseLineSchema>;

// ─── Receipt ──────────────────────────────────────────────────────────────────

export const ReceiptSchema = z.object({
  id: z.string().uuid(),
  expense_line_id: z.string().uuid(),
  storage_path: z.string(),
  original_amount: z.number().nullable(),
  ocr_extracted_amount: z.number().nullable(),
  ocr_extracted_date: z.string().nullable(),
  ocr_raw_text: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;

// ─── Server Action Response wrapper ───────────────────────────────────────────

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
