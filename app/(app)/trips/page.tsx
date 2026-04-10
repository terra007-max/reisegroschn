import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrips } from "@/actions/trip.actions";
import { LinkButton } from "@/components/ui/link-button";
import TripsClient from "@/components/TripsClient";
import { PlusCircle } from "lucide-react";

export const metadata = { title: "Reisen — Evodia" };

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getTrips();
  const trips = result.success ? result.data : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meine Reisen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {trips.length} {trips.length === 1 ? "Reise" : "Reisen"} erfasst
          </p>
        </div>
        <LinkButton href="/trips/new" className="shrink-0 gap-1.5">
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Neue Reise</span>
          <span className="sm:hidden">Neu</span>
        </LinkButton>
      </div>

      <TripsClient trips={trips} />
    </div>
  );
}
