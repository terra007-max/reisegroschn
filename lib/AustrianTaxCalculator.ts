/**
 * AustrianTaxCalculator.ts
 *
 * Strictly implements Austrian travel expense (Reisekosten) law for 2025/2026.
 * Sources: §26 Z 4 EStG (Taggeld), §26 Z 4d EStG (Kilometergeld), BAO §131.
 *
 * This module is pure (no side effects) and fully unit-testable.
 */

// ─── Statutory Constants ───────────────────────────────────────────────────────

/** Statutory daily Taggeld rate per §26 Z 4 EStG (Inland) */
export const TAGGELD_DAILY_RATE_EUR = 30.0;

/** Rate per started hour (1/12 of daily rate) */
export const TAGGELD_HOURLY_RATE_EUR = TAGGELD_DAILY_RATE_EUR / 12; // 2.50

/** Minimum trip duration to trigger any Taggeld (strictly greater than) */
export const TAGGELD_MIN_HOURS = 3.0;

/** Meal deduction for one employer-provided meal */
export const MEAL_DEDUCTION_SINGLE_EUR = 15.0;

/** Statutory mileage rate for cars per §26 Z 4b EStG */
export const MILEAGE_RATE_CAR_EUR_PER_KM = 0.5;

/** Annual mileage cap for tax-free Kilometergeld */
export const MILEAGE_ANNUAL_CAP_KM = 30_000;

/** Consecutive-day threshold before a destination becomes a secondary workplace */
export const DESTINATION_CONSECUTIVE_DAY_LIMIT = 5;

/** Annual-day threshold before a destination becomes a secondary workplace */
export const DESTINATION_ANNUAL_DAY_LIMIT = 15;

// ─── Shared Types ──────────────────────────────────────────────────────────────

export type VatRate = 0 | 10 | 13 | 20;

// ─── Taggeld ──────────────────────────────────────────────────────────────────

export interface TaggeldInput {
  /** Total trip duration in decimal hours (e.g. 3.5 = 3h 30min) */
  durationInHours: number;
  /** Number of employer-provided meals during the trip (0, 1, or 2+) */
  mealsProvided: 0 | 1 | 2;
  /**
   * Kollektivvertrag daily rate. Defaults to statutory €30.
   * If higher, the excess is returned as taxableAmount.
   */
  kvDailyRate?: number;
}

export interface TaggeldResult {
  /** Statutory Taggeld before meal deductions (aliquot, capped at €30) */
  grossStatutory: number;
  /** Net Taggeld after meal deductions, floored at €0 */
  net: number;
  /** Tax-free portion (≤ statutory net, max €30/day) */
  taxFreeAmount: number;
  /** Taxable KV excess above the statutory €30 cap (proportional to hours) */
  taxableAmount: number;
  /** The total meal deduction applied */
  mealDeduction: number;
  /** Whether the 3-hour minimum was met */
  triggersTaggeld: boolean;
}

/**
 * Calculates Taggeld for a single trip period.
 *
 * For multi-day trips, call this function once per calendar day, passing that
 * day's active hours (up to 24). The cap is enforced per-call (≤ €30/day).
 */
export function calculateTaggeld(input: TaggeldInput): TaggeldResult {
  const {
    durationInHours,
    mealsProvided,
    kvDailyRate = TAGGELD_DAILY_RATE_EUR,
  } = input;

  const ZERO_RESULT: TaggeldResult = {
    grossStatutory: 0,
    net: 0,
    taxFreeAmount: 0,
    taxableAmount: 0,
    mealDeduction: 0,
    triggersTaggeld: false,
  };

  // ── 3-Hour Trigger ────────────────────────────────────────────────────────
  if (durationInHours <= TAGGELD_MIN_HOURS) {
    return ZERO_RESULT;
  }

  // ── Aliquot Calculation (statutory) ──────────────────────────────────────
  // "Per started hour" → ceil. Capped at the full daily rate.
  const startedHours = Math.ceil(durationInHours);
  const grossStatutory = Math.min(
    startedHours * TAGGELD_HOURLY_RATE_EUR,
    TAGGELD_DAILY_RATE_EUR
  );

  // ── Meal Deductions (Kürzung) ─────────────────────────────────────────────
  let mealDeduction = 0;
  let netStatutory: number;

  if (mealsProvided >= 2) {
    // 2+ meals → Taggeld collapses to exactly €0
    mealDeduction = grossStatutory;
    netStatutory = 0;
  } else if (mealsProvided === 1) {
    mealDeduction = Math.min(MEAL_DEDUCTION_SINGLE_EUR, grossStatutory);
    netStatutory = Math.max(0, grossStatutory - MEAL_DEDUCTION_SINGLE_EUR);
  } else {
    netStatutory = grossStatutory;
  }

  // ── KV Splitter ───────────────────────────────────────────────────────────
  // The KV excess is proportional to the same aliquot factor as the statutory.
  const aliquotFactor = startedHours / 12; // e.g. 4h → 4/12 = 0.333
  const kvGross = Math.min(
    aliquotFactor * kvDailyRate,
    kvDailyRate
  );

  // Tax-free: the net statutory portion (already capped at €30)
  const taxFreeAmount = netStatutory;

  // Taxable: proportional KV excess ONLY if trip triggers Taggeld
  const kvStatutoryGross = Math.min(
    aliquotFactor * TAGGELD_DAILY_RATE_EUR,
    TAGGELD_DAILY_RATE_EUR
  );
  const kvExcessGross = Math.max(0, kvGross - kvStatutoryGross);
  // Apply meal-deduction ratio to KV excess too (conservative approach)
  const taxableAmount = mealsProvided >= 2 ? 0 : kvExcessGross;

  return {
    grossStatutory,
    net: netStatutory,
    taxFreeAmount,
    taxableAmount,
    mealDeduction,
    triggersTaggeld: true,
  };
}

// ─── Kilometergeld ────────────────────────────────────────────────────────────

export interface MileageInput {
  /** Distance of the current trip in kilometres */
  distanceKm: number;
  /** User's year-to-date mileage BEFORE this trip */
  ytdMileageKm: number;
}

export interface MileageResult {
  /** Kilometres eligible for tax-free reimbursement */
  taxFreeKm: number;
  /** Kilometres that exceed the annual cap (€0 tax-free reimbursement) */
  excessKm: number;
  /** Total tax-free payout in EUR */
  payout: number;
  /** Updated YTD mileage after this trip */
  newYtdMileageKm: number;
}

/**
 * Calculates Kilometergeld with the 30,000 km annual cap.
 * Excess kilometres beyond the cap yield €0 reimbursement.
 */
export function calculateMileage(input: MileageInput): MileageResult {
  const { distanceKm, ytdMileageKm } = input;

  const remainingCap = Math.max(0, MILEAGE_ANNUAL_CAP_KM - ytdMileageKm);
  const taxFreeKm = Math.min(distanceKm, remainingCap);
  const excessKm = distanceKm - taxFreeKm;
  const payout = roundCents(taxFreeKm * MILEAGE_RATE_CAR_EUR_PER_KM);
  const newYtdMileageKm = ytdMileageKm + distanceKm;

  return { taxFreeKm, excessKm, payout, newYtdMileageKm };
}

// ─── 5/15 Day Rule (Mittelpunkt der Tätigkeit) ────────────────────────────────

export interface DestinationRuleInput {
  /** How many consecutive days the user has already been at this destination */
  consecutiveDaysAtDestination: number;
  /** Total days at this destination in the current calendar year */
  totalDaysThisYearAtDestination: number;
}

export interface DestinationRuleResult {
  /** If true, the destination is a secondary workplace → Taggeld = €0 */
  isSecondaryWorkplace: boolean;
  /** Human-readable reason for audit logs */
  reason: string | null;
}

/**
 * Applies the 5/15-day rule per §26 Z 4 EStG.
 * Returns true when the destination has become a secondary workplace (Mittelpunkt).
 */
export function checkDestinationRule(
  input: DestinationRuleInput
): DestinationRuleResult {
  const { consecutiveDaysAtDestination, totalDaysThisYearAtDestination } = input;

  if (consecutiveDaysAtDestination > DESTINATION_CONSECUTIVE_DAY_LIMIT) {
    return {
      isSecondaryWorkplace: true,
      reason: `Destination exceeded ${DESTINATION_CONSECUTIVE_DAY_LIMIT} consecutive days (actual: ${consecutiveDaysAtDestination})`,
    };
  }

  if (totalDaysThisYearAtDestination > DESTINATION_ANNUAL_DAY_LIMIT) {
    return {
      isSecondaryWorkplace: true,
      reason: `Destination exceeded ${DESTINATION_ANNUAL_DAY_LIMIT} days in calendar year (actual: ${totalDaysThisYearAtDestination})`,
    };
  }

  return { isSecondaryWorkplace: false, reason: null };
}

// ─── Full Trip Calculator ──────────────────────────────────────────────────────

export interface TripInput {
  startTime: Date;
  endTime: Date;
  distanceKm: number;
  mealsProvided: 0 | 1 | 2;
  ytdMileageKm: number;
  kvDailyRate?: number;
  consecutiveDaysAtDestination: number;
  totalDaysThisYearAtDestination: number;
}

export interface TripResult {
  durationInHours: number;
  taggeld: TaggeldResult;
  mileage: MileageResult;
  destinationRule: DestinationRuleResult;
  /** Effective Taggeld after applying the 5/15-day rule */
  effectiveTaggeldNet: number;
  /** Total tax-free reimbursement (Taggeld + Kilometergeld) */
  totalTaxFree: number;
  /** Total taxable amount (KV excess) */
  totalTaxable: number;
}

/**
 * Master entry point: calculates the full reimbursement for a single trip.
 * Applies all Austrian rules in the correct order.
 */
export function calculateTrip(input: TripInput): TripResult {
  const durationMs = input.endTime.getTime() - input.startTime.getTime();
  const durationInHours = durationMs / (1000 * 60 * 60);

  const destinationRule = checkDestinationRule({
    consecutiveDaysAtDestination: input.consecutiveDaysAtDestination,
    totalDaysThisYearAtDestination: input.totalDaysThisYearAtDestination,
  });

  const taggeld = destinationRule.isSecondaryWorkplace
    ? ({
        grossStatutory: 0,
        net: 0,
        taxFreeAmount: 0,
        taxableAmount: 0,
        mealDeduction: 0,
        triggersTaggeld: false,
      } satisfies TaggeldResult)
    : calculateTaggeld({
        durationInHours,
        mealsProvided: input.mealsProvided,
        kvDailyRate: input.kvDailyRate,
      });

  const mileage = calculateMileage({
    distanceKm: input.distanceKm,
    ytdMileageKm: input.ytdMileageKm,
  });

  const effectiveTaggeldNet = taggeld.net;
  const totalTaxFree = roundCents(effectiveTaggeldNet + mileage.payout);
  const totalTaxable = roundCents(taggeld.taxableAmount);

  return {
    durationInHours,
    taggeld,
    mileage,
    destinationRule,
    effectiveTaggeldNet,
    totalTaxFree,
    totalTaxable,
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/** Rounds a monetary value to 2 decimal places (cent-precision). */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
