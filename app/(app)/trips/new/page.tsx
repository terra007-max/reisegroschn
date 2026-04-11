import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripForm from "@/components/TripForm";
import { getLocale } from "@/lib/locale-server";
import { t } from "@/lib/translations";

export const metadata = { title: "Neue Reise — Evodia" };

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const locale = await getLocale();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {t(locale, "page.newTripTitle")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {t(locale, "page.newTripSubtitle")}
        </p>
      </div>
      <TripForm />
    </div>
  );
}
