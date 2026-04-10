/**
 * AustrianTaxCalculator.ts
 *
 * Implements Austrian travel expense (Reisekosten) law for 2026.
 * Sources: §26 Z 4 EStG (Taggeld + Nächtigungsgeld), §26 Z 4b EStG
 * (Kilometergeld), §3 Abs 1 Z 16b EStG (Auslandsreisen), BAO §131.
 *
 * This module is pure (no side effects) and fully unit-testable.
 */

// ─── Domestic Constants ────────────────────────────────────────────────────────

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

/** Additional supplement per passenger (Beifahrerzuschlag) per §26 Z 4b EStG */
export const MILEAGE_PASSENGER_SUPPLEMENT_EUR_PER_KM = 0.05;

/** Annual mileage cap for tax-free Kilometergeld */
export const MILEAGE_ANNUAL_CAP_KM = 30_000;

/** Nächtigungsgeld flat-rate per §26 Z 4 EStG — no receipts needed */
export const NAECHTIGUNGSGELD_RATE_EUR = 17.0;

/** Consecutive-day threshold before a destination becomes a secondary workplace */
export const DESTINATION_CONSECUTIVE_DAY_LIMIT = 5;

/** Annual-day threshold before a destination becomes a secondary workplace */
export const DESTINATION_ANNUAL_DAY_LIMIT = 15;

// ─── International Per Diem Rates (BMF Erlass 2026) ──────────────────────────
// Source: BMF-010222/0055-IV/4/2023 and annual BMF updates.
// Rates are the statutory 24h tax-free maximum in EUR.

export const INTERNATIONAL_PER_DIEM_RATES: Record<string, { name: string; rate24h: number }> = {
  DE: { name: "Deutschland",      rate24h: 30 },
  CH: { name: "Schweiz",          rate24h: 75 },
  IT: { name: "Italien",          rate24h: 35 },
  FR: { name: "Frankreich",       rate24h: 45 },
  GB: { name: "Großbritannien",   rate24h: 55 },
  US: { name: "USA",              rate24h: 58 },
  ES: { name: "Spanien",          rate24h: 35 },
  NL: { name: "Niederlande",      rate24h: 40 },
  BE: { name: "Belgien",          rate24h: 37 },
  PL: { name: "Polen",            rate24h: 20 },
  CZ: { name: "Tschechien",       rate24h: 25 },
  HU: { name: "Ungarn",           rate24h: 20 },
  SK: { name: "Slowakei",         rate24h: 20 },
  SI: { name: "Slowenien",        rate24h: 26 },
  HR: { name: "Kroatien",         rate24h: 26 },
  SE: { name: "Schweden",         rate24h: 46 },
  NO: { name: "Norwegen",         rate24h: 55 },
  DK: { name: "Dänemark",         rate24h: 51 },
  FI: { name: "Finnland",         rate24h: 46 },
  PT: { name: "Portugal",         rate24h: 35 },
  GR: { name: "Griechenland",     rate24h: 32 },
  RO: { name: "Rumänien",         rate24h: 20 },
  BG: { name: "Bulgarien",        rate24h: 20 },
  TR: { name: "Türkei",           rate24h: 30 },
  JP: { name: "Japan",            rate24h: 60 },
  CN: { name: "China",            rate24h: 47 },
  AU: { name: "Australien",       rate24h: 55 },
  CA: { name: "Kanada",           rate24h: 50 },
  AE: { name: "Vereinigte Arab.", rate24h: 55 },
  SG: { name: "Singapur",         rate24h: 60 },
};

/** Fallback rate for countries not in the table */
export const INTERNATIONAL_FALLBACK_RATE_EUR = 37.5;

// ─── Shared Types ──────────────────────────────────────────────────────────────

export type VatRate = 0 | 10 | 13 | 20;

// ─── Nächtigungsgeld ──────────────────────────────────────────────────────────

export interface NaechtigungsgeldInput {
  /** Number of overnight stays during the trip */
  overnightStays: number;
}

export interface NaechtigungsgeldResult {
  /** Tax-free Nächtigungsgeld in EUR (§26 Z 4 EStG) */
  taxFreeAmount: number;
  /** Number of nights that qualified */
  qualifyingNights: number;
}

/**
 * Calculates the statutory Nächtigungsgeld (overnight allowance).
 * €17/night, flat-rate, no receipts needed (§26 Z 4 EStG).
 * Capped at 6 months (180 nights) continuously at same destination.
 */
export function calculateNaechtigungsgeld(
  input: NaechtigungsgeldInput
): NaechtigungsgeldResult {
  const qualifyingNights = Math.max(0, Math.min(input.overnightStays, 180));
  return {
    taxFreeAmount: roundCents(qualifyingNights * NAECHTIGUNGSGELD_RATE_EUR),
    qualifyingNights,
  };
}

/**
 * Derives overnight stays from trip start/end times.
 * Counts how many calendar-day midnight boundaries are crossed.
 */
export function deriveOvernightStays(startTime: Date, endTime: Date): number {
  const startDay = new Date(
    startTime.getFullYear(),
    startTime.getMonth(),
    startTime.getDate()
  );
  const endDay = new Date(
    endTime.getFullYear(),
    endTime.getMonth(),
    endTime.getDate()
  );
  const daysDiff = Math.floor(
    (endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, daysDiff);
}

// ─── International Taggeld ────────────────────────────────────────────────────

export interface InternationalTaggeldInput {
  /** ISO 3166-1 alpha-2 country code (e.g. "DE", "FR") */
  countryCode: string;
  durationInHours: number;
  mealsProvided: 0 | 1 | 2;
}

export interface InternationalTaggeldResult {
  grossStatutory: number;
  net: number;
  mealDeduction: number;
  countryRate24h: number;
  triggersTaggeld: boolean;
}

/**
 * Calculates international Taggeld using BMF country-specific rates.
 * The aliquot calculation mirrors domestic rules (per started hour, capped at 24h rate).
 */
export function calculateInternationalTaggeld(
  input: InternationalTaggeldInput
): InternationalTaggeldResult {
  const { countryCode, durationInHours, mealsProvided } = input;
  const countryRate24h =
    INTERNATIONAL_PER_DIEM_RATES[countryCode.toUpperCase()]?.rate24h ??
    INTERNATIONAL_FALLBACK_RATE_EUR;

  // Must exceed 3 hours to trigger any allowance
  if (durationInHours <= TAGGELD_MIN_HOURS) {
    return {
      grossStatutory: 0,
      net: 0,
      mealDeduction: 0,
      countryRate24h,
      triggersTaggeld: false,
    };
  }

  // Aliquot: per started hour, capped at full day rate
  const hourlyRate = countryRate24h / 24;
  const startedHours = Math.ceil(durationInHours);
  const grossStatutory = Math.min(
    startedHours * hourlyRate,
    countryRate24h
  );

  // International meal deduction: 1/3 of daily rate per meal (BMF practice)
  const mealDeductionRate = countryRate24h / 3;
  let mealDeduction = 0;
  let net = grossStatutory;

  if (mealsProvided >= 2) {
    mealDeduction = grossStatutory;
    net = 0;
  } else if (mealsProvided === 1) {
    mealDeduction = Math.min(mealDeductionRate, grossStatutory);
    net = Math.max(0, grossStatutory - mealDeductionRate);
  }

  return {
    grossStatutory: roundCents(grossStatutory),
    net: roundCents(net),
    mealDeduction: roundCents(mealDeduction),
    countryRate24h,
    triggersTaggeld: true,
  };
}

// ─── Taggeld (Domestic) ───────────────────────────────────────────────────────

export interface TaggeldInput {
  durationInHours: number;
  mealsProvided: 0 | 1 | 2;
  kvDailyRate?: number;
}

export interface TaggeldResult {
  grossStatutory: number;
  net: number;
  taxFreeAmount: number;
  taxableAmount: number;
  mealDeduction: number;
  triggersTaggeld: boolean;
}

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

  if (durationInHours <= TAGGELD_MIN_HOURS) return ZERO_RESULT;

  const startedHours = Math.ceil(durationInHours);
  const grossStatutory = Math.min(
    startedHours * TAGGELD_HOURLY_RATE_EUR,
    TAGGELD_DAILY_RATE_EUR
  );

  let mealDeduction = 0;
  let netStatutory: number;

  if (mealsProvided >= 2) {
    mealDeduction = grossStatutory;
    netStatutory = 0;
  } else if (mealsProvided === 1) {
    mealDeduction = Math.min(MEAL_DEDUCTION_SINGLE_EUR, grossStatutory);
    netStatutory = Math.max(0, grossStatutory - MEAL_DEDUCTION_SINGLE_EUR);
  } else {
    netStatutory = grossStatutory;
  }

  const aliquotFactor = startedHours / 12;
  const kvGross = Math.min(aliquotFactor * kvDailyRate, kvDailyRate);
  const kvStatutoryGross = Math.min(
    aliquotFactor * TAGGELD_DAILY_RATE_EUR,
    TAGGELD_DAILY_RATE_EUR
  );
  const kvExcessGross = Math.max(0, kvGross - kvStatutoryGross);
  const taxableAmount = mealsProvided >= 2 ? 0 : kvExcessGross;

  return {
    grossStatutory,
    net: netStatutory,
    taxFreeAmount: netStatutory,
    taxableAmount,
    mealDeduction,
    triggersTaggeld: true,
  };
}

// ─── Kilometergeld ────────────────────────────────────────────────────────────

export interface MileageInput {
  distanceKm: number;
  ytdMileageKm: number;
  /** Number of passengers in the car — each adds €0.05/km (Beifahrerzuschlag §26 Z 4b EStG) */
  passengerCount?: number;
}

export interface MileageResult {
  taxFreeKm: number;
  excessKm: number;
  payout: number;
  newYtdMileageKm: number;
  effectiveRatePerKm: number;
}

export function calculateMileage(input: MileageInput): MileageResult {
  const { distanceKm, ytdMileageKm, passengerCount = 0 } = input;
  const passengers = Math.min(Math.max(0, passengerCount), 4);
  const effectiveRatePerKm = roundCents(
    MILEAGE_RATE_CAR_EUR_PER_KM + passengers * MILEAGE_PASSENGER_SUPPLEMENT_EUR_PER_KM
  );
  const remainingCap = Math.max(0, MILEAGE_ANNUAL_CAP_KM - ytdMileageKm);
  const taxFreeKm = Math.min(distanceKm, remainingCap);
  const excessKm = distanceKm - taxFreeKm;
  const payout = roundCents(taxFreeKm * effectiveRatePerKm);
  return { taxFreeKm, excessKm, payout, newYtdMileageKm: ytdMileageKm + distanceKm, effectiveRatePerKm };
}

// ─── 5/15 Day Rule ────────────────────────────────────────────────────────────

export interface DestinationRuleInput {
  consecutiveDaysAtDestination: number;
  totalDaysThisYearAtDestination: number;
}

export interface DestinationRuleResult {
  isSecondaryWorkplace: boolean;
  reason: string | null;
}

export function checkDestinationRule(
  input: DestinationRuleInput
): DestinationRuleResult {
  const { consecutiveDaysAtDestination, totalDaysThisYearAtDestination } = input;

  if (consecutiveDaysAtDestination > DESTINATION_CONSECUTIVE_DAY_LIMIT) {
    return {
      isSecondaryWorkplace: true,
      reason: `Exceeded ${DESTINATION_CONSECUTIVE_DAY_LIMIT} consecutive days (actual: ${consecutiveDaysAtDestination})`,
    };
  }
  if (totalDaysThisYearAtDestination > DESTINATION_ANNUAL_DAY_LIMIT) {
    return {
      isSecondaryWorkplace: true,
      reason: `Exceeded ${DESTINATION_ANNUAL_DAY_LIMIT} days in calendar year (actual: ${totalDaysThisYearAtDestination})`,
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
  /** ISO 3166-1 alpha-2 country code for international trips. Omit for domestic. */
  countryCode?: string;
}

export interface TripResult {
  durationInHours: number;
  taggeld: TaggeldResult;
  naechtigungsgeld: NaechtigungsgeldResult;
  mileage: MileageResult;
  destinationRule: DestinationRuleResult;
  effectiveTaggeldNet: number;
  totalTaxFree: number;
  totalTaxable: number;
  overnightStays: number;
}

export function calculateTrip(input: TripInput): TripResult {
  const durationMs = input.endTime.getTime() - input.startTime.getTime();
  const durationInHours = durationMs / (1000 * 60 * 60);

  const destinationRule = checkDestinationRule({
    consecutiveDaysAtDestination: input.consecutiveDaysAtDestination,
    totalDaysThisYearAtDestination: input.totalDaysThisYearAtDestination,
  });

  const taggeld = destinationRule.isSecondaryWorkplace
    ? ({
        grossStatutory: 0, net: 0, taxFreeAmount: 0,
        taxableAmount: 0, mealDeduction: 0, triggersTaggeld: false,
      } satisfies TaggeldResult)
    : calculateTaggeld({
        durationInHours,
        mealsProvided: input.mealsProvided,
        kvDailyRate: input.kvDailyRate,
      });

  const overnightStays = deriveOvernightStays(input.startTime, input.endTime);
  const naechtigungsgeld = destinationRule.isSecondaryWorkplace
    ? { taxFreeAmount: 0, qualifyingNights: 0 }
    : calculateNaechtigungsgeld({ overnightStays });

  const mileage = calculateMileage({
    distanceKm: input.distanceKm,
    ytdMileageKm: input.ytdMileageKm,
  });

  const effectiveTaggeldNet = taggeld.net;
  const totalTaxFree = roundCents(
    effectiveTaggeldNet + naechtigungsgeld.taxFreeAmount + mileage.payout
  );
  const totalTaxable = roundCents(taggeld.taxableAmount);

  return {
    durationInHours,
    taggeld,
    naechtigungsgeld,
    mileage,
    destinationRule,
    effectiveTaggeldNet,
    totalTaxFree,
    totalTaxable,
    overnightStays,
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
