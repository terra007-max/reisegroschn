"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plane, Plus, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

interface BottomNavProps {
  userRole: string;
}

export default function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const { tr } = useLocale();
  const isAdmin = userRole === "ADMIN";

  // Left: Dashboard + Trips
  // Center: FAB (New Trip)
  // Right: Admin/Settings (2 items)
  const leftItems = [
    { href: "/dashboard", label: tr("nav.overview"), icon: LayoutDashboard },
    { href: "/trips", label: tr("nav.trips"), icon: Plane },
  ];

  const rightItems = isAdmin
    ? [
        { href: "/admin", label: tr("nav.admin"), icon: Shield },
        { href: "/settings", label: tr("nav.settings"), icon: Settings },
      ]
    : [
        { href: "/settings", label: tr("nav.settings"), icon: Settings },
      ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border pb-safe"
      aria-label="Navigation"
    >
      <div className="flex items-center justify-around px-2">
        {/* Left */}
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
          aria-label={tr("nav.newTrip")}
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </Link>

        {/* Right */}
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
          <>
            <div className="flex-1" />
            {rightItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <NavItem key={item.href} href={item.href} label={item.label} active={active}>
                  <Icon className="w-[22px] h-[22px]" />
                </NavItem>
              );
            })}
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
