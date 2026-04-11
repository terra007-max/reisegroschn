import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminTrips } from "@/actions/admin.actions";
import AdminTripTable from "@/components/AdminTripTable";
import { Shield } from "lucide-react";
import { getLocale } from "@/lib/locale-server";
import { t } from "@/lib/translations";

export const metadata = { title: "Genehmigungen — Evodia" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify admin role server-side before rendering
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [result, locale] = await Promise.all([getAdminTrips(), getLocale()]);
  const trips = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "admin.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t(locale, "admin.subtitle")}
          </p>
        </div>
      </div>

      <AdminTripTable initialTrips={trips} />
    </div>
  );
}
