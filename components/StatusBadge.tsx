import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/lib/schemas";

const config: Record<
  TripStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Entwurf",
    className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100",
  },
  PENDING: {
    label: "Ausstehend",
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
  },
  APPROVED: {
    label: "Genehmigt",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  },
  REJECTED: {
    label: "Abgelehnt",
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
  },
};

export function StatusBadge({ status }: { status: TripStatus }) {
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={cn("font-medium text-xs", className)}>
      {label}
    </Badge>
  );
}
