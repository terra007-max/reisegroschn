"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * A button that always navigates to /trips/new and forces a full page refresh,
 * so clicking it while already on /trips/new resets the form.
 * Next.js Link is a no-op when href === current URL — this avoids that.
 */
export default function NewTripButton({
  className,
  children,
  asNavItem = false,
}: {
  className?: string;
  children: React.ReactNode;
  asNavItem?: boolean;
}) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push("/trips/new");
    router.refresh();
  }, [router]);

  return (
    <button type="button" onClick={handleClick} className={cn(className)}>
      {children}
    </button>
  );
}
