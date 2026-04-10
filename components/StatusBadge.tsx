"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/lib/schemas";
import { useLocale } from "@/contexts/LocaleContext";

const styleConfig: Record<TripStatus, { className: string }> = {
  DRAFT: {
    className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
  PENDING: {
    className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  APPROVED: {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  REJECTED: {
    className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
};

export function StatusBadge({ status }: { status: TripStatus }) {
  const { tr } = useLocale();
  const { className } = styleConfig[status];
  const label = tr(`status.${status}`);
  return (
    <Badge variant="outline" className={cn("font-medium text-xs", className)}>
      {label}
    </Badge>
  );
}
