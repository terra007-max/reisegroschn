import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        userName={profile?.full_name ?? user.email ?? ""}
        userRole={profile?.role ?? "USER"}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
