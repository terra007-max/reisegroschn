/**
 * Unit Tests: AustrianTaxCalculator.ts
 *
 * Covers all business rules per the PRD (§26 EStG, 2025/2026).
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  calculateTaggeld,
  calculateMileage,
  checkDestinationRule,
  calculateTrip,
  roundCents,
  TAGGELD_DAILY_RATE_EUR,
  TAGGELD_HOURLY_RATE_EUR,
  MILEAGE_ANNUAL_CAP_KM,
  MILEAGE_RATE_CAR_EUR_PER_KM,
} from "../lib/AustrianTaxCalculator";

// ─── Taggeld: 3-Hour Trigger ──────────────────────────────────────────────────

describe("calculateTaggeld — 3-hour trigger", () => {
  it("returns zero for exactly 3.0 hours (boundary: not strictly greater)", () => {
    const result = calculateTaggeld({ durationInHours: 3.0, mealsProvided: 0 });
    expect(result.triggersTaggeld).toBe(false);
    expect(result.net).toBe(0);
    expect(result.grossStatutory).toBe(0);
  });

  it("returns zero for 2.99 hours", () => {
    const result = calculateTaggeld({ durationInHours: 2.99, mealsProvided: 0 });
    expect(result.triggersTaggeld).toBe(false);
    expect(result.net).toBe(0);
  });

  it("returns zero for 0 hours", () => {
    const result = calculateTaggeld({ durationInHours: 0, mealsProvided: 0 });
    expect(result.triggersTaggeld).toBe(false);
    expect(result.net).toBe(0);
  });

  it("triggers Taggeld for 3.01 hours (strictly greater)", () => {
    const result = calculateTaggeld({ durationInHours: 3.01, mealsProvided: 0 });
    expect(result.triggersTaggeld).toBe(true);
    // ceil(3.01) = 4 → 4 * 2.50 = €10.00
    expect(result.grossStatutory).toBe(10.0);
    expect(result.net).toBe(10.0);
  });

  it("triggers Taggeld for 3.5 hours", () => {
    const result = calculateTaggeld({ durationInHours: 3.5, mealsProvided: 0 });
    expect(result.triggersTaggeld).toBe(true);
    // ceil(3.5) = 4 → 4 * 2.50 = €10.00
    expect(result.grossStatutory).toBe(10.0);
  });
});

// ─── Taggeld: Aliquot Calculation ─────────────────────────────────────────────

describe("calculateTaggeld — aliquot calculation", () => {
  it("calculates correctly for 4 hours", () => {
    // ceil(4) * (30/12) = 4 * 2.50 = €10.00
    const result = calculateTaggeld({ durationInHours: 4, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(10.0);
  });

  it("calculates correctly for 5 hours", () => {
    // ceil(5) * 2.50 = 5 * 2.50 = €12.50
    const result = calculateTaggeld({ durationInHours: 5, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(12.5);
  });

  it("calculates correctly for 7.5 hours (partial hour → ceil)", () => {
    // ceil(7.5) = 8 → 8 * 2.50 = €20.00
    const result = calculateTaggeld({ durationInHours: 7.5, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(20.0);
  });

  it("calculates correctly for 12 hours (exactly hits daily rate)", () => {
    // ceil(12) * 2.50 = 12 * 2.50 = €30.00
    const result = calculateTaggeld({ durationInHours: 12, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(30.0);
    expect(result.net).toBe(30.0);
  });

  it("caps at €30 for trips longer than 12 hours", () => {
    // ceil(13) * 2.50 = 13 * 2.50 = €32.50 → capped at €30.00
    const result = calculateTaggeld({ durationInHours: 13, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(30.0);
  });

  it("caps at €30 for a full 24-hour day", () => {
    const result = calculateTaggeld({ durationInHours: 24, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(30.0);
    expect(result.net).toBe(30.0);
  });

  it("caps at €30 for trips exceeding 24 hours", () => {
    const result = calculateTaggeld({ durationInHours: 30, mealsProvided: 0 });
    expect(result.grossStatutory).toBe(30.0);
  });

  it("uses ceil for fractional hours (e.g. 4h 1min = 4.0167h → ceil = 5)", () => {
    const durationInHours = 4 + 1 / 60; // 4h 1min
    const result = calculateTaggeld({ durationInHours, mealsProvided: 0 });
    // ceil(4.0167) = 5 → 5 * 2.50 = €12.50
    expect(result.grossStatutory).toBe(12.5);
  });
});

// ─── Taggeld: Meal Deductions (Kürzung) ───────────────────────────────────────

describe("calculateTaggeld — meal deductions", () => {
  it("deducts €15 for 1 meal from a €30 Taggeld", () => {
    const result = calculateTaggeld({ durationInHours: 24, mealsProvided: 1 });
    expect(result.grossStatutory).toBe(30.0);
    expect(result.mealDeduction).toBe(15.0);
    expect(result.net).toBe(15.0);
  });

  it("reduces Taggeld to €0 for 2 meals", () => {
    const result = calculateTaggeld({ durationInHours: 24, mealsProvided: 2 });
    expect(result.net).toBe(0);
    expect(result.mealDeduction).toBe(30.0);
  });

  it("floors at €0: meal deduction on a small Taggeld cannot go negative", () => {
    // 4-hour trip → gross = €10. One meal (-€15) → would be -€5 → floor to €0
    const result = calculateTaggeld({ durationInHours: 4, mealsProvided: 1 });
    expect(result.grossStatutory).toBe(10.0);
    expect(result.net).toBe(0);
    expect(result.net).toBeGreaterThanOrEqual(0);
  });

  it("meal deduction never exceeds the gross Taggeld", () => {
    // 4-hour trip → gross = €10. Deduction should be min(15, 10) = €10
    const result = calculateTaggeld({ durationInHours: 4, mealsProvided: 1 });
    expect(result.mealDeduction).toBe(10.0);
  });

  it("0 meals → no deduction", () => {
    const result = calculateTaggeld({ durationInHours: 8, mealsProvided: 0 });
    expect(result.mealDeduction).toBe(0);
    expect(result.net).toBe(result.grossStatutory);
  });

  it("2 meals on a trip that barely triggers Taggeld → net is €0", () => {
    const result = calculateTaggeld({ durationInHours: 3.5, mealsProvided: 2 });
    expect(result.triggersTaggeld).toBe(true);
    expect(result.net).toBe(0);
  });
});

// ─── Taggeld: KV Splitter ─────────────────────────────────────────────────────

describe("calculateTaggeld — KV Splitter (Kollektivvertrag)", () => {
  it("no taxable amount when KV rate equals statutory rate", () => {
    const result = calculateTaggeld({
      durationInHours: 24,
      mealsProvided: 0,
      kvDailyRate: 30,
    });
    expect(result.taxFreeAmount).toBe(30.0);
    expect(result.taxableAmount).toBe(0);
  });

  it("splits correctly for KV rate of €35 on a full day", () => {
    // KV gross: min(24/12 * 35, 35) = min(70, 35) = 35
    // Statutory gross: 30
    // taxableAmount = 35 - 30 = 5
    const result = calculateTaggeld({
      durationInHours: 24,
      mealsProvided: 0,
      kvDailyRate: 35,
    });
    expect(result.taxFreeAmount).toBe(30.0);
    expect(result.taxableAmount).toBe(5.0);
  });

  it("splits correctly for KV rate of €35 on a 4-hour trip", () => {
    // Statutory aliquot: ceil(4)/12 * 30 = 4/12 * 30 = 10
    // KV aliquot: ceil(4)/12 * 35 = 4/12 * 35 ≈ 11.67
    // taxableAmount = 11.67 - 10 = 1.67
    const result = calculateTaggeld({
      durationInHours: 4,
      mealsProvided: 0,
      kvDailyRate: 35,
    });
    expect(result.taxFreeAmount).toBe(10.0);
    expect(roundCents(result.taxableAmount)).toBeCloseTo(1.67, 2);
  });

  it("taxableAmount is 0 when 2+ meals are provided (Taggeld collapses)", () => {
    const result = calculateTaggeld({
      durationInHours: 24,
      mealsProvided: 2,
      kvDailyRate: 35,
    });
    expect(result.net).toBe(0);
    expect(result.taxableAmount).toBe(0);
  });

  it("no taxable amount when trip does not trigger Taggeld", () => {
    const result = calculateTaggeld({
      durationInHours: 3,
      mealsProvided: 0,
      kvDailyRate: 35,
    });
    expect(result.triggersTaggeld).toBe(false);
    expect(result.taxableAmount).toBe(0);
  });
});

// ─── Kilometergeld ────────────────────────────────────────────────────────────

describe("calculateMileage", () => {
  it("calculates correctly for a trip well within the annual cap", () => {
    const result = calculateMileage({ distanceKm: 100, ytdMileageKm: 0 });
    expect(result.taxFreeKm).toBe(100);
    expect(result.excessKm).toBe(0);
    expect(result.payout).toBe(50.0); // 100 * 0.50
    expect(result.newYtdMileageKm).toBe(100);
  });

  it("calculates the rate per km correctly", () => {
    const result = calculateMileage({ distanceKm: 1, ytdMileageKm: 0 });
    expect(result.payout).toBe(MILEAGE_RATE_CAR_EUR_PER_KM);
  });

  it("applies the 30,000 km annual cap: trip within remaining cap", () => {
    const result = calculateMileage({
      distanceKm: 1000,
      ytdMileageKm: 29_000,
    });
    expect(result.taxFreeKm).toBe(1000);
    expect(result.excessKm).toBe(0);
    expect(result.payout).toBe(500.0);
  });

  it("applies the 30,000 km cap: trip partially exceeds the cap", () => {
    const result = calculateMileage({
      distanceKm: 1000,
      ytdMileageKm: 29_500,
    });
    expect(result.taxFreeKm).toBe(500); // only 500 km remaining
    expect(result.excessKm).toBe(500); // 500 km excess → €0 reimbursement
    expect(result.payout).toBe(250.0);
    expect(result.newYtdMileageKm).toBe(30_500);
  });

  it("applies the 30,000 km cap: ytd already at cap → full trip is excess", () => {
    const result = calculateMileage({
      distanceKm: 500,
      ytdMileageKm: MILEAGE_ANNUAL_CAP_KM,
    });
    expect(result.taxFreeKm).toBe(0);
    expect(result.excessKm).toBe(500);
    expect(result.payout).toBe(0);
  });

  it("applies the 30,000 km cap: ytd exceeds cap (should not happen, but is safe)", () => {
    const result = calculateMileage({
      distanceKm: 100,
      ytdMileageKm: 31_000,
    });
    expect(result.taxFreeKm).toBe(0);
    expect(result.payout).toBe(0);
  });

  it("handles 0 km trip", () => {
    const result = calculateMileage({ distanceKm: 0, ytdMileageKm: 1000 });
    expect(result.payout).toBe(0);
    expect(result.newYtdMileageKm).toBe(1000);
  });

  it("exactly hits the annual cap", () => {
    const result = calculateMileage({
      distanceKm: 1000,
      ytdMileageKm: 29_000,
    });
    expect(result.newYtdMileageKm).toBe(MILEAGE_ANNUAL_CAP_KM);
    expect(result.excessKm).toBe(0);
  });
});

// ─── 5/15 Day Rule ────────────────────────────────────────────────────────────

describe("checkDestinationRule — 5/15-day rule", () => {
  it("returns false for destinations within both limits", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 3,
      totalDaysThisYearAtDestination: 10,
    });
    expect(result.isSecondaryWorkplace).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns false at exactly 5 consecutive days (boundary: must be strictly GREATER)", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 5,
      totalDaysThisYearAtDestination: 5,
    });
    expect(result.isSecondaryWorkplace).toBe(false);
  });

  it("returns true at 6 consecutive days (strictly > 5)", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 6,
      totalDaysThisYearAtDestination: 6,
    });
    expect(result.isSecondaryWorkplace).toBe(true);
    expect(result.reason).toContain("consecutive");
  });

  it("returns false at exactly 15 yearly days (boundary: must be strictly GREATER)", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 1,
      totalDaysThisYearAtDestination: 15,
    });
    expect(result.isSecondaryWorkplace).toBe(false);
  });

  it("returns true at 16 yearly days (strictly > 15)", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 1,
      totalDaysThisYearAtDestination: 16,
    });
    expect(result.isSecondaryWorkplace).toBe(true);
    expect(result.reason).toContain("calendar year");
  });

  it("consecutive-day rule takes precedence when both limits are exceeded", () => {
    const result = checkDestinationRule({
      consecutiveDaysAtDestination: 10,
      totalDaysThisYearAtDestination: 20,
    });
    expect(result.isSecondaryWorkplace).toBe(true);
    expect(result.reason).toContain("consecutive");
  });
});

// ─── Full Trip Integration ────────────────────────────────────────────────────

describe("calculateTrip — integration", () => {
  const baseTrip = {
    startTime: new Date("2025-06-01T08:00:00"),
    endTime: new Date("2025-06-01T20:00:00"), // 12 hours
    distanceKm: 200,
    mealsProvided: 0 as const,
    ytdMileageKm: 0,
    consecutiveDaysAtDestination: 1,
    totalDaysThisYearAtDestination: 1,
  };

  it("calculates duration correctly from Date objects", () => {
    const result = calculateTrip(baseTrip);
    expect(result.durationInHours).toBe(12);
  });

  it("computes correct total tax-free amount for a standard 12h trip", () => {
    // Taggeld: ceil(12) * 2.50 = €30.00
    // Mileage: 200 * 0.50 = €100.00
    // Total tax-free: €130.00
    const result = calculateTrip(baseTrip);
    expect(result.taggeld.net).toBe(30.0);
    expect(result.mileage.payout).toBe(100.0);
    expect(result.totalTaxFree).toBe(130.0);
    expect(result.totalTaxable).toBe(0);
  });

  it("suppresses Taggeld when destination is a secondary workplace", () => {
    const result = calculateTrip({
      ...baseTrip,
      consecutiveDaysAtDestination: 6, // > 5 → secondary workplace
    });
    expect(result.destinationRule.isSecondaryWorkplace).toBe(true);
    expect(result.effectiveTaggeldNet).toBe(0);
    expect(result.mileage.payout).toBe(100.0); // Kilometergeld is unaffected
    expect(result.totalTaxFree).toBe(100.0);
  });

  it("handles a trip under 3 hours (no Taggeld, only mileage)", () => {
    const result = calculateTrip({
      ...baseTrip,
      endTime: new Date("2025-06-01T10:00:00"), // 2 hours
    });
    expect(result.taggeld.triggersTaggeld).toBe(false);
    expect(result.taggeld.net).toBe(0);
    expect(result.mileage.payout).toBe(100.0);
    expect(result.totalTaxFree).toBe(100.0);
  });

  it("handles the mileage cap within a full trip", () => {
    const result = calculateTrip({
      ...baseTrip,
      distanceKm: 1000,
      ytdMileageKm: 29_800, // only 200 km remaining
    });
    expect(result.mileage.taxFreeKm).toBe(200);
    expect(result.mileage.excessKm).toBe(800);
    expect(result.mileage.payout).toBe(100.0);
  });

  it("correctly propagates KV split through total amounts", () => {
    const result = calculateTrip({
      ...baseTrip,
      kvDailyRate: 35,
    });
    expect(result.taggeld.taxFreeAmount).toBe(30.0);
    expect(result.taggeld.taxableAmount).toBe(5.0);
    expect(result.totalTaxable).toBe(5.0);
  });
});

// ─── Edge Cases & Precision ───────────────────────────────────────────────────

describe("roundCents", () => {
  it("rounds to 2 decimal places", () => {
    // Use non-halfway values to avoid IEEE 754 floating-point ambiguity
    expect(roundCents(2.506)).toBe(2.51);  // 250.6 → rounds up to 251
    expect(roundCents(2.504)).toBe(2.50);  // 250.4 → rounds down to 250
    expect(roundCents(10.123)).toBe(10.12); // 1012.3 → rounds down to 1012
  });

  it("handles whole numbers", () => {
    expect(roundCents(30)).toBe(30);
    expect(roundCents(0)).toBe(0);
  });
});

describe("constants sanity checks", () => {
  it("hourly rate is exactly 1/12th of daily rate", () => {
    expect(TAGGELD_HOURLY_RATE_EUR).toBeCloseTo(TAGGELD_DAILY_RATE_EUR / 12, 10);
  });

  it("12 hours of Taggeld equals the daily cap", () => {
    expect(12 * TAGGELD_HOURLY_RATE_EUR).toBe(TAGGELD_DAILY_RATE_EUR);
  });

  it("mileage cap is 30,000 km", () => {
    expect(MILEAGE_ANNUAL_CAP_KM).toBe(30_000);
  });
});
