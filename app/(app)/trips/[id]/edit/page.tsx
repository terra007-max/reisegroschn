import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTripById } from "@/actions/trip.actions";
import TripEditForm from "@/components/TripEditForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function TripEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getTripById(id);
  if (!result.success) notFound();

  const trip = result.data;

  // Only DRAFT trips can be edited
  if (trip.status !== "DRAFT") redirect(`/trips/${id}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/trips/${id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </Link>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Reise bearbeiten</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{trip.destination}</p>
      </div>

      <TripEditForm trip={trip} />
    </div>
  );
}
