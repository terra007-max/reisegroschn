/**
 * ocr-parser.ts
 *
 * Extracts structured data from raw OCR text output of Austrian receipts.
 * Handles German number formatting (comma as decimal separator).
 */

export interface OcrExtraction {
  /** Best-guess monetary amount in EUR (e.g. 12.50) */
  amount: number | null;
  /** Best-guess date as ISO string (YYYY-MM-DD) */
  date: string | null;
  /** All candidate amounts found, sorted descending — for UI fallback */
  amountCandidates: number[];
}

/**
 * Parses raw OCR text and extracts the most likely total amount and date.
 *
 * Strategy:
 *  1. Find all monetary values (€ prefix/suffix, or bare decimal numbers).
 *  2. Prefer the LARGEST value as the receipt total.
 *  3. Find the first plausible date in Austrian / ISO format.
 */
export function parseOcrText(rawText: string): OcrExtraction {
  const amounts = extractAmounts(rawText);
  const date = extractDate(rawText);

  // The receipt total is almost always the largest amount on the slip
  const sorted = [...amounts].sort((a, b) => b - a);

  return {
    amount: sorted[0] ?? null,
    date,
    amountCandidates: sorted,
  };
}

// ─── Amount extraction ────────────────────────────────────────────────────────

/**
 * Patterns that match common Austrian/German receipt amount formats:
 *   €12,50   12,50€   12.50   GESAMT 12,50   SUMME 12.50
 */
const AMOUNT_PATTERNS: RegExp[] = [
  // €12,50 or € 12,50
  /€\s*(\d{1,6}[.,]\d{2})/g,
  // 12,50€ or 12.50 €
  /(\d{1,6}[.,]\d{2})\s*€/g,
  // After keywords: GESAMT, SUMME, TOTAL, BETRAG, ZAHLUNG
  /(?:GESAMT|SUMME|TOTAL|BETRAG|ZAHLUNG|ENDBETRAG|ZU ZAHLEN)[^\d]*(\d{1,6}[.,]\d{2})/gi,
  // Bare decimal numbers at end of line (fallback)
  /^\s*(\d{1,4}[.,]\d{2})\s*$/gm,
];

function parseGermanNumber(raw: string): number {
  // German: 1.234,56 → 1234.56 | or simple 12,50 → 12.50
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  return parseFloat(normalized);
}

function extractAmounts(text: string): number[] {
  const found = new Set<number>();

  for (const pattern of AMOUNT_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const value = parseGermanNumber(raw);
      // Sanity check: receipts realistically between €0.01 and €9999.99
      if (!isNaN(value) && value >= 0.01 && value <= 9999.99) {
        found.add(Math.round(value * 100) / 100);
      }
    }
  }

  return Array.from(found);
}

// ─── Date extraction ──────────────────────────────────────────────────────────

/**
 * Tries multiple date formats common on Austrian receipts.
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
function extractDate(text: string): string | null {
  // DD.MM.YYYY or DD.MM.YY (most common on Austrian receipts)
  const ddmmyyyy = /\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/g;
  let match: RegExpExecArray | null;

  while ((match = ddmmyyyy.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    if (match[3].length === 2) {
      year += year >= 50 ? 1900 : 2000;
    }

    if (
      day >= 1 && day <= 31 &&
      month >= 1 && month <= 12 &&
      year >= 2000 && year <= 2099
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // ISO format YYYY-MM-DD (fallback)
  const iso = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;
  const isoMatch = iso.exec(text);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}
