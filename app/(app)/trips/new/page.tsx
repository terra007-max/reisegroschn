import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TripForm from "@/components/TripForm";

export const metadata = { title: "Neue Reise — ReiseGroschn" };

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Neue Reise erfassen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Alle Felder werden gemäß §26 Z 4 EStG berechnet.
        </p>
      </div>
      <TripForm />
    </div>
  );
}
