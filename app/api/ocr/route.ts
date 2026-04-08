/**
 * POST /api/ocr
 *
 * Accepts a receipt image (multipart/form-data, field "file"),
 * runs tesseract.js OCR server-side, and returns extracted text + parsed data.
 *
 * This is an API route (not a Server Action) because tesseract.js spawns
 * a worker process and benefits from the full Node.js runtime without
 * Server Action timeout constraints.
 *
 * Security: requires a valid Supabase session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseOcrText } from "@/lib/ocr-parser";

export const runtime = "nodejs";
// OCR can take up to 30s on a large image
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  // Parse multipart body
  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage — multipart/form-data erwartet" },
      { status: 400 }
    );
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Keine Datei erhalten" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Nicht unterstütztes Format. Bitte JPEG, PNG oder TIFF verwenden." },
      { status: 415 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Datei zu groß (max. 10 MB)" },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import — tesseract.js is large; don't load it on cold start
    const Tesseract = (await import("tesseract.js")).default;

    const {
      data: { text },
    } = await Tesseract.recognize(buffer, "deu+eng", {
      logger: () => {}, // suppress progress logs in production
    });

    const extraction = parseOcrText(text);

    return NextResponse.json({
      success: true,
      rawText: text.trim(),
      amount: extraction.amount,
      date: extraction.date,
      amountCandidates: extraction.amountCandidates,
    });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: "OCR-Verarbeitung fehlgeschlagen. Bitte manuell eingeben." },
      { status: 500 }
    );
  }
}
