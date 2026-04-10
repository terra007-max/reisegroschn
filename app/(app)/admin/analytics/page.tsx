import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAnalytics } from "@/actions/admin.actions";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "ADMIN") redirect("/dashboard");

  // Default: current year
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), 0, 1).toISOString();
  const toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

  const result = await getAnalytics({ fromDate, toDate });
  const initialData = result.success ? result.data : null;

  return <AnalyticsDashboard initialData={initialData} />;
}
