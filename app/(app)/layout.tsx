import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale-server";
import { LocaleProvider } from "@/contexts/LocaleContext";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, locale] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single(),
    getLocale(),
  ]);

  const userName = profile?.full_name ?? user.email ?? "";
  const userRole = profile?.role ?? "USER";

  return (
    <LocaleProvider initialLocale={locale}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar userName={userName} userRole={userRole} />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-safe-nav lg:pb-8">
            {children}
          </div>
        </main>
        <BottomNav userRole={userRole} />
      </div>
      <PWAInstallPrompt />
    </LocaleProvider>
  );
}
