"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plane, Plus, Shield, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  userRole: string;
}

export default function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";

  const leftItems = [
    { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
    { href: "/trips", label: "Reisen", icon: Plane },
  ];

  const rightItems = isAdmin
    ? [
        { href: "/admin", label: "Admin", icon: Shield },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
      ]
    : [
        { href: "/admin", label: "Admin", icon: Shield, hidden: true }, // placeholder symmetry
        { href: "/admin/analytics", label: "Analytics", icon: BarChart2, hidden: true },
      ];

  const visibleRight = isAdmin
    ? rightItems
    : [
        { href: "/trips", label: "Reisen", icon: Plane, hidden: true }, // keep symmetry for non-admin
      ];

  // For non-admin: just left items + FAB + 2 placeholder-less items → use a simpler layout
  // Non-admin: Dashboard | Trips | [FAB] | (empty) | (empty) → but that looks bad
  // Better: non-admin has 2 items left, 0 right → center FAB with 1 item each side

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/admin" && !href.includes("analytics")) return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border pb-safe"
      aria-label="Navigation"
    >
      <div className="flex items-center justify-around px-2">
        {/* Left items */}
        {leftItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <NavItem key={item.href} href={item.href} label={item.label} active={active}>
              <Icon className="w-[22px] h-[22px]" />
            </NavItem>
          );
        })}

        {/* Center FAB */}
        <Link
          href="/trips/new"
          className={cn(
            "flex flex-col items-center justify-center -mt-5 mb-1",
            "w-14 h-14 rounded-2xl hero-gradient shadow-lg shadow-primary/30",
            "ring-4 ring-card",
            "active:scale-95 transition-transform duration-100"
          )}
          aria-label="Neue Reise erfassen"
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </Link>

        {/* Right items */}
        {isAdmin ? (
          rightItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <NavItem key={item.href} href={item.href} label={item.label} active={active}>
                <Icon className="w-[22px] h-[22px]" />
              </NavItem>
            );
          })
        ) : (
          // Non-admin: fill right side with empty slots for symmetry
          <>
            <div className="flex-1" />
            <div className="flex-1" />
          </>
        )}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px]",
        "text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <div
        className={cn(
          "p-1.5 rounded-xl transition-all duration-150",
          active ? "bg-primary/10 scale-110" : ""
        )}
      >
        {children}
      </div>
      <span className={cn("leading-none", active ? "text-primary" : "")}>{label}</span>
    </Link>
  );
}
