"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plane, PlusCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  userRole: string;
}

export default function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";

  const items = [
    { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
    { href: "/trips", label: "Reisen", icon: Plane },
    { href: "/trips/new", label: "Neue Reise", icon: PlusCircle },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const isNew = item.href === "/trips/new";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors",
                isNew
                  ? "text-primary"
                  : isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isNew && !isActive
                    ? "bg-primary/10"
                    : isActive
                    ? "bg-primary/10"
                    : ""
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isNew ? "text-primary" : isActive ? "text-primary" : ""
                  )}
                />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
