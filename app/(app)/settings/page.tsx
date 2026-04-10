import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import SettingsClient from "@/components/SettingsClient";

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: locale === "en" ? "Settings — Evodia" : "Einstellungen — Evodia",
  };
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <SettingsClient
      userName={profile?.full_name ?? user.email ?? ""}
      userEmail={user.email ?? ""}
      userRole={profile?.role ?? "USER"}
    />
  );
}
