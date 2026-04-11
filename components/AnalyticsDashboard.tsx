"use client";

import { useState, useTransition } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getAnalytics, type AnalyticsData } from "@/actions/admin.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Euro, TrendingUp, Car, CheckCircle2, Clock,
  Loader2, BarChart2, Download, Users, MapPin,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#7c3aed"];

type FilterKey = "WEEK" | "MONTH" | "LAST_MONTH" | "Q3M" | "YEAR" | "CUSTOM";

function getDateRange(key: FilterKey, customFrom?: string, customTo?: string): { fromDate: string; toDate: string } {
  const now = new Date();
  switch (key) {
    case "WEEK": {
      const from = new Date(now); from.setDate(now.getDate() - 7);
      return { fromDate: from.toISOString(), toDate: now.toISOString() };
    }
    case "MONTH":
      return {
        fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        toDate: now.toISOString(),
      };
    case "LAST_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { fromDate: start.toISOString(), toDate: end.toISOString() };
    }
    case "Q3M": {
      const from = new Date(now); from.setMonth(now.getMonth() - 3);
      return { fromDate: from.toISOString(), toDate: now.toISOString() };
    }
    case "YEAR":
      return {
        fromDate: new Date(now.getFullYear(), 0, 1).toISOString(),
        toDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString(),
      };
    case "CUSTOM":
      return {
        fromDate: customFrom ? new Date(customFrom).toISOString() : new Date(now.getFullYear(), 0, 1).toISOString(),
        toDate: customTo ? new Date(customTo + "T23:59:59").toISOString() : now.toISOString(),
      };
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatEur = (v: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const formatEurFull = (v: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(v);

function formatMonth(key: string, locale: string) {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-AT", {
    month: "short",
    year: "2-digit",
  }).format(new Date(parseInt(y), parseInt(m) - 1, 1));
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color, bg, border,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <Card className={cn("border-l-[3px] card-shadow", border)}>
      <CardContent className="pt-4 pb-4 px-4">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center mb-3", bg)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <p className={cn("text-xl sm:text-2xl font-bold tabular-nums tracking-tight", color)}>{value}</p>
        <p className="text-xs font-medium text-foreground mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function EurTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{formatEurFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[120px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ initialData }: { initialData: AnalyticsData | null }) {
  const { locale, tr } = useLocale();
  const [data, setData] = useState<AnalyticsData | null>(initialData);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("YEAR");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isPending, startTransition] = useTransition();

  const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: "WEEK",       label: tr("analytics.filterWeek") },
    { key: "MONTH",      label: tr("analytics.filterMonth") },
    { key: "LAST_MONTH", label: tr("analytics.filterLastMonth") },
    { key: "Q3M",        label: tr("analytics.filterQ3m") },
    { key: "YEAR",       label: tr("analytics.filterYear") },
    { key: "CUSTOM",     label: tr("analytics.filterCustom") },
  ];

  // Map raw cost-breakdown keys → translated display names
  const costNames: Record<string, string> = {
    TAGGELD:          tr("analytics.costTaggeld"),
    KILOMETERGELD:    tr("analytics.costMileage"),
    NAECHTIGUNGSGELD: tr("analytics.costOvernight"),
  };

  // Map raw status keys → translated labels + bar colors
  const statusMeta: Record<string, { label: string; color: string }> = {
    APPROVED: { label: tr("status.APPROVED"), color: "bg-emerald-500" },
    PENDING:  { label: tr("status.PENDING"),  color: "bg-amber-400" },
    REJECTED: { label: tr("status.REJECTED"), color: "bg-red-400" },
    DRAFT:    { label: tr("status.DRAFT"),    color: "bg-muted-foreground/30" },
  };

  function applyFilter(key: FilterKey, from?: string, to?: string) {
    setActiveFilter(key);
    const range = getDateRange(key, from ?? customFrom, to ?? customTo);
    startTransition(async () => {
      const result = await getAnalytics(range);
      if (result.success) setData(result.data);
    });
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      [tr("analytics.csvColMonth"), tr("analytics.csvColReimbursement"), tr("analytics.csvColTrips")],
      ...data.monthlyTrend.map((r) => [
        formatMonth(r.month, locale),
        r.taxFree.toFixed(2),
        String(r.trips),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "analytics.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = data?.kpis;

  const trendData = data?.monthlyTrend.map((d) => ({
    ...d,
    month: formatMonth(d.month, locale),
  }));

  const translatedCostBreakdown = data?.costBreakdown.map((c) => ({
    ...c,
    name: costNames[c.name] ?? c.name,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            {tr("analytics.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tr("analytics.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportCsv} disabled={!data}>
          <Download className="w-4 h-4" /> {tr("analytics.csvExport")}
        </Button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            onClick={() => applyFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
        {activeFilter === "CUSTOM" && (
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                if (customTo) applyFilter("CUSTOM", e.target.value, customTo);
              }}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              className="h-8 text-xs w-36"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                if (customFrom) applyFilter("CUSTOM", customFrom, e.target.value);
              }}
            />
          </div>
        )}
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-1" />}
      </div>

      {!data ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {tr("analytics.loading")}
        </div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={CheckCircle2}
              label={tr("analytics.kpiApproved")}
              value={String(kpis!.approvedTrips)}
              sub={tr("analytics.kpiApprovedSub").replace("{total}", String(kpis!.totalTrips))}
              color="text-emerald-600" bg="bg-emerald-50" border="border-l-emerald-500"
            />
            <KpiCard
              icon={Euro}
              label={tr("analytics.kpiTaxFree")}
              value={formatEur(kpis!.totalTaxFreeEur)}
              sub="§26 EStG"
              color="text-primary" bg="bg-primary/5" border="border-l-primary"
            />
            <KpiCard
              icon={Car}
              label={tr("analytics.kpiKm")}
              value={kpis!.totalKm.toLocaleString(locale === "en" ? "en-GB" : "de-AT")}
              sub={`€ ${kpis!.totalMileageEur.toFixed(0)} ${tr("analytics.kpiKmSub")}`}
              color="text-blue-600" bg="bg-blue-50" border="border-l-blue-500"
            />
            <KpiCard
              icon={Clock}
              label={tr("analytics.kpiPending")}
              value={String(kpis!.pendingTrips)}
              sub={kpis!.rejectedTrips > 0
                ? tr("analytics.kpiRejectedSub").replace("{count}", String(kpis!.rejectedTrips))
                : undefined}
              color="text-amber-600" bg="bg-amber-50" border="border-l-amber-500"
            />
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly trend */}
            <Card className="card-shadow lg:col-span-2">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {tr("analytics.chartMonthly")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="taxFreeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} width={55} />
                    <Tooltip content={<EurTooltip />} />
                    <Area type="monotone" dataKey="taxFree" name={tr("analytics.seriesReimbursement")} stroke="#16a34a" strokeWidth={2} fill="url(#taxFreeGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost breakdown donut */}
            <Card className="card-shadow">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Euro className="w-4 h-4 text-primary" />
                  {tr("analytics.chartCosts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {!translatedCostBreakdown?.length ? (
                  <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                    {tr("analytics.chartNoCosts")}
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={translatedCostBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {translatedCostBreakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => typeof v === "number" ? formatEurFull(v) : v} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1 px-3">
                      {translatedCostBreakdown.map((c, i) => (
                        <div key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {c.name}
                          </span>
                          <span className="font-medium tabular-nums">{formatEur(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Trips per month bar + status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="card-shadow lg:col-span-2">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  {tr("analytics.chartTripsPerMonth")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                    <Tooltip content={<CountTooltip />} />
                    <Bar dataKey="trips" name={tr("analytics.seriesTrips")} fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status distribution */}
            <Card className="card-shadow">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">{tr("analytics.chartStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                {data.statusDistribution.map((s) => {
                  const pct = kpis!.totalTrips > 0 ? (s.count / kpis!.totalTrips) * 100 : 0;
                  const meta = statusMeta[s.status] ?? { label: s.status, color: "bg-muted-foreground/30" };
                  return (
                    <div key={s.status} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{meta.label}</span>
                        <span className="font-medium tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", meta.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* ── Tables row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top destinations */}
            <Card className="card-shadow">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {tr("analytics.tableDestinations")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {data.topDestinations.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-5 py-4">{tr("analytics.noData")}</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colDestination")}</th>
                        <th className="text-right px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colTrips")}</th>
                        <th className="text-right px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topDestinations.map((d, i) => (
                        <tr key={d.destination} className={cn("hover:bg-muted/30", i < data.topDestinations.length - 1 && "border-b border-border/50")}>
                          <td className="px-5 py-2.5 font-medium">{d.destination}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{d.count}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums font-medium text-primary">{formatEur(d.totalEur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Top employees */}
            <Card className="card-shadow">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {tr("analytics.tableEmployees")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {data.topEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-5 py-4">{tr("analytics.noData")}</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colEmployee")}</th>
                        <th className="text-right px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colTrips")}</th>
                        <th className="text-right px-5 py-2 text-muted-foreground font-medium">{tr("analytics.colTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topEmployees.map((e, i) => (
                        <tr key={e.email} className={cn("hover:bg-muted/30", i < data.topEmployees.length - 1 && "border-b border-border/50")}>
                          <td className="px-5 py-2.5">
                            <p className="font-medium">{e.name}</p>
                            <p className="text-[10px] text-muted-foreground">{e.email}</p>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{e.trips}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums font-medium text-primary">{formatEur(e.totalEur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
