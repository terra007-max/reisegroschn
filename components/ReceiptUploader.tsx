"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Scan,
  CheckCircle2,
  Trash2,
  Eye,
  AlertTriangle,
  FileImage,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  saveReceipt,
  deleteReceipt,
  getReceiptSignedUrl,
} from "@/actions/receipt.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OcrResult {
  rawText: string;
  amount: number | null;
  date: string | null;
  amountCandidates: number[];
}

interface SavedReceipt {
  id: string;
  storage_path: string;
  original_amount: number | null;
  ocr_extracted_amount: number | null;
  ocr_extracted_date: string | null;
  created_at: string;
  expense_lines: {
    id: string;
    amount: number;
    vat_rate: string;
    description: string | null;
  };
}

interface ReceiptUploaderProps {
  tripId: string;
  userId: string;
  initialReceipts?: SavedReceipt[];
  disabled?: boolean;
}

// ─── State machine for a single upload ───────────────────────────────────────

type UploadStep =
  | { type: "idle" }
  | { type: "uploading"; progress: number }
  | { type: "ocr"; fileName: string }
  | { type: "review"; fileName: string; storagePath: string; ocr: OcrResult }
  | { type: "saving" }
  | { type: "error"; message: string };

// ─── Receipt card (saved) ─────────────────────────────────────────────────────

function ReceiptCard({
  receipt,
  tripId,
  onDeleted,
}: {
  receipt: SavedReceipt;
  tripId: string;
  onDeleted: (id: string) => void;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [isFetchingUrl, startFetch] = useTransition();

  function handleView() {
    startFetch(async () => {
      const result = await getReceiptSignedUrl(receipt.storage_path);
      if (result.success) {
        window.open(result.data.url, "_blank", "noopener");
      } else {
        toast.error("Fehler", { description: result.error });
      }
    });
  }

  function handleDelete() {
    if (!confirm("Beleg wirklich löschen?")) return;
    startDelete(async () => {
      const result = await deleteReceipt(receipt.id, tripId);
      if (result.success) {
        toast.success("Beleg gelöscht");
        onDeleted(receipt.id);
      } else {
        toast.error("Fehler", { description: result.error });
      }
    });
  }

  const vatLabel =
    receipt.expense_lines.vat_rate === "0"
      ? "MwSt. 0%"
      : `MwSt. ${receipt.expense_lines.vat_rate}%`;

  const dateStr = receipt.ocr_extracted_date
    ? new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(
        new Date(receipt.ocr_extracted_date)
      )
    : new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(
        new Date(receipt.created_at)
      );

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-lg">
      <div className="flex items-center gap-3 min-w-0">
        <FileImage className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {new Intl.NumberFormat("de-AT", {
              style: "currency",
              currency: "EUR",
            }).format(receipt.expense_lines.amount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {dateStr} · {vatLabel}
            {receipt.expense_lines.description && (
              <> · {receipt.expense_lines.description}</>
            )}
          </p>
          {receipt.ocr_extracted_amount !== null &&
            receipt.ocr_extracted_amount !== receipt.expense_lines.amount && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                OCR: {receipt.ocr_extracted_amount} — manuell korrigiert
              </p>
            )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0 ml-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleView}
          disabled={isFetchingUrl}
          className="h-8 w-8 p-0"
          title="Beleg anzeigen"
        >
          {isFetchingUrl ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Beleg löschen"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReceiptUploader({
  tripId,
  userId,
  initialReceipts = [],
  disabled = false,
}: ReceiptUploaderProps) {
  const [step, setStep] = useState<UploadStep>({ type: "idle" });
  const [receipts, setReceipts] = useState<SavedReceipt[]>(initialReceipts);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startSave] = useTransition();

  // Review form state
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [vatRate, setVatRate] = useState<"0" | "10" | "13" | "20">("20");
  const [description, setDescription] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload + OCR pipeline ──────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      // 1. Validate
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"];
      if (!allowed.includes(file.type)) {
        toast.error("Nicht unterstütztes Format", {
          description: "Bitte JPEG, PNG, WEBP oder TIFF verwenden.",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Datei zu groß (max. 10 MB)");
        return;
      }

      setStep({ type: "uploading", progress: 0 });

      // 2. Upload to Supabase Storage
      const ext = file.name.split(".").pop() ?? "jpg";
      const storagePath = `${userId}/${tripId}/${Date.now()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, file, { upsert: false, cacheControl: "3600" });

      if (uploadError) {
        setStep({
          type: "error",
          message: `Upload fehlgeschlagen: ${uploadError.message}`,
        });
        return;
      }

      setStep({ type: "ocr", fileName: file.name });

      // 3. Run OCR via API route
      const formData = new FormData();
      formData.append("file", file);

      let ocr: OcrResult = { rawText: "", amount: null, date: null, amountCandidates: [] };

      try {
        const res = await fetch("/api/ocr", { method: "POST", body: formData });
        if (res.ok) {
          const json = await res.json();
          ocr = {
            rawText: json.rawText ?? "",
            amount: json.amount ?? null,
            date: json.date ?? null,
            amountCandidates: json.amountCandidates ?? [],
          };
        }
        // If OCR fails we continue with empty data — user can fill in manually
      } catch {
        // OCR is best-effort; network error is non-fatal
      }

      // Pre-fill review form with OCR results
      setConfirmedAmount(ocr.amount !== null ? String(ocr.amount) : "");
      setVatRate("20");
      setDescription("");

      setStep({
        type: "review",
        fileName: file.name,
        storagePath,
        ocr,
      });
    },
    [tripId, userId]
  );

  // ── Drop zone handlers ─────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [processFile]
  );

  // ── Save confirmed receipt ─────────────────────────────────────────────────

  function handleSave() {
    if (step.type !== "review") return;

    const amount = parseFloat(confirmedAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }

    startSave(async () => {
      setStep({ type: "saving" });

      const result = await saveReceipt({
        tripId,
        storagePath: step.storagePath,
        confirmedAmount: amount,
        ocrExtractedAmount: step.ocr.amount,
        ocrExtractedDate: step.ocr.date,
        ocrRawText: step.ocr.rawText || null,
        vatRate,
        description: description.trim() || undefined,
      });

      if (result.success) {
        toast.success("Beleg gespeichert", {
          description: `${new Intl.NumberFormat("de-AT", {
            style: "currency",
            currency: "EUR",
          }).format(amount)} erfasst`,
        });
        // We can't reconstruct the full ReceiptWithExpenseLine shape here,
        // so refresh will show it. In a real app you'd return it from the action.
        setStep({ type: "idle" });
        // Trigger a page refresh to show the new receipt
        window.location.reload();
      } else {
        toast.error("Fehler beim Speichern", { description: result.error });
        setStep({
          type: "error",
          message: result.error,
        });
      }
    });
  }

  // ─ Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Saved receipts list */}
      {receipts.length > 0 && (
        <div className="space-y-2">
          {receipts.map((r) => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              tripId={tripId}
              onDeleted={(id) =>
                setReceipts((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
          <Separator />
        </div>
      )}

      {/* Upload area — hidden when reviewing */}
      {step.type === "idle" && !disabled && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Beleg hochladen"
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) =>
            e.key === "Enter" && fileInputRef.current?.click()
          }
        >
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Beleg hier ablegen oder klicken
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPEG, PNG, WEBP, TIFF · max. 10 MB
          </p>
          <p className="text-xs text-primary mt-2 font-medium">
            OCR erkennt Betrag und Datum automatisch
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Uploading */}
      {step.type === "uploading" && (
        <Card className="border-primary/20">
          <CardContent className="flex items-center gap-3 py-5">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Wird hochgeladen…</p>
              <p className="text-xs text-muted-foreground">
                Bitte warten
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OCR in progress */}
      {step.type === "ocr" && (
        <Card className="border-primary/20">
          <CardContent className="flex items-center gap-3 py-5">
            <Scan className="w-5 h-5 text-primary animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">OCR läuft…</p>
              <p className="text-xs text-muted-foreground">
                Texterkennung auf {step.fileName}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review / confirm */}
      {step.type === "review" && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm font-semibold">OCR abgeschlossen — Bitte prüfen</p>
            </div>

            {step.ocr.rawText && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Erkannter Rohtext anzeigen
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                  {step.ocr.rawText}
                </pre>
              </details>
            )}

            {!step.ocr.amount && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-md p-2.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Kein Betrag erkannt — bitte manuell eingeben
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="receipt-amount">Betrag (€)</Label>
                <Input
                  id="receipt-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  className={cn(
                    step.ocr.amount !== null && "border-primary/40"
                  )}
                />
                {step.ocr.amountCandidates.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Weitere:{" "}
                    {step.ocr.amountCandidates
                      .slice(1, 4)
                      .map((a) => `€${a}`)
                      .join(", ")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>MwSt.-Satz</Label>
                <Select
                  value={vatRate}
                  onValueChange={(v) =>
                    v !== null && setVatRate(v as typeof vatRate)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20% (Standard)</SelectItem>
                    <SelectItem value="10">10% (Lebensmittel)</SelectItem>
                    <SelectItem value="13">13% (Kultur)</SelectItem>
                    <SelectItem value="0">0% (befreit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="receipt-desc">
                Beschreibung{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="receipt-desc"
                placeholder="z.B. Tankquittung, Hotelrechnung…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isPending || !confirmedAmount}
                className="flex-1"
              >
                {isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Speichern
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep({ type: "idle" })}
                disabled={isPending}
              >
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saving */}
      {step.type === "saving" && (
        <Card className="border-primary/20">
          <CardContent className="flex items-center gap-3 py-5">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <p className="text-sm font-medium">Wird gespeichert…</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {step.type === "error" && (
        <Card className="border-destructive/40">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {step.message}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep({ type: "idle" })}
            >
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      )}

      {disabled && receipts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Belege können nach Genehmigung nicht mehr verändert werden
        </p>
      )}
    </div>
  );
}
