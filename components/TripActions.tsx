"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitTrip, deleteTrip } from "@/actions/trip.actions";
import type { Trip } from "@/lib/schemas";
import { useLocale } from "@/contexts/LocaleContext";

export default function TripActions({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { tr } = useLocale();
  const [isPending, startTransition] = useTransition();

  if (!["DRAFT", "PENDING"].includes(trip.status)) return null;

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitTrip(trip.id);
      if (result.success) {
        toast.success(tr("actions.submitted"), {
          description: tr("actions.submittedDesc"),
        });
        router.refresh();
      } else {
        toast.error(tr("actions.error"), { description: result.error });
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `${tr("actions.deleteConfirmPrefix")} "${trip.destination}" ${tr("actions.deleteConfirmSuffix")}`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteTrip(trip.id);
      if (result.success) {
        toast.success(tr("actions.tripDeleted"));
        router.push("/trips");
      } else {
        toast.error(tr("actions.error"), { description: result.error });
      }
    });
  }

  return (
    <div className="flex gap-2 flex-shrink-0">
      {trip.status === "DRAFT" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/trips/${trip.id}/edit`)}
            disabled={isPending}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            {tr("actions.edit")}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            {tr("actions.submit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
      {trip.status === "PENDING" && (
        <p className="text-sm text-muted-foreground italic self-center">
          {tr("actions.waitingApproval")}
        </p>
      )}
    </div>
  );
}
