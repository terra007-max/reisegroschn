"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Plane,
  PlusCircle,
  LogOut,
  Shield,
  User,
  BarChart2,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import AppLogo from "@/components/AppLogo";
import { useLocale } from "@/contexts/LocaleContext";
import type { Locale } from "@/lib/translations";
import NewTripButton from "@/components/NewTripButton";

interface SidebarProps {
  userName: string;
  userRole: string;
}

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, tr } = useLocale();
  const isAdmin = userRole === "ADMIN";

  const navItems = [
    { href: "/dashboard", label: tr("nav.overview"), icon: LayoutDashboard },
    { href: "/trips", label: tr("nav.trips"), icon: Plane },
    { href: "/trips/new", label: tr("nav.newTrip"), icon: PlusCircle },
  ];

  const adminItems = [
    { href: "/admin", label: tr("nav.admin"), icon: Shield },
    { href: "/admin/analytics", label: tr("nav.analytics"), icon: BarChart2 },
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success(tr("settings.signOut"));
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  function toggleLocale() {
    setLocale(locale === "de" ? "en" : "de");
  }

  return (
    <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 py-4">
        <AppLogo size="sm" />
        <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-1 ml-10">
          {tr("nav.tagline")}
        </p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/trips/new"
              ? pathname === "/trips/new"
              : pathname.startsWith(item.href) && !pathname.startsWith("/trips/new");

          const itemClass = cn(
            "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative w-full text-left",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          );

          const content = (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full" />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
              />
              {item.label}
            </>
          );

          if (item.href === "/trips/new") {
            return (
              <NewTripButton key={item.href} className={itemClass}>
                {content}
              </NewTripButton>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={itemClass}>
              {content}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest">
                {tr("nav.administration")}
              </p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full" />
                  )}
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}

        {/* Settings link */}
        <div className="pt-2">
          <Link
            href="/settings"
            className={cn(
              "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
              pathname === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            )}
          >
            {pathname === "/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full" />
            )}
            <Settings
              className={cn(
                "w-4 h-4 flex-shrink-0",
                pathname === "/settings"
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
              )}
            />
            {tr("nav.settings")}
          </Link>
        </div>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User footer with quick toggles */}
      <div className="px-3 py-3 space-y-2">
        {/* Quick toggles row */}
        <div className="flex items-center gap-1 px-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? tr("settings.themeLight") : tr("settings.themeDark")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            title={locale === "de" ? "Switch to English" : "Zu Deutsch wechseln"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
          >
            <span className="font-mono font-bold text-[11px]">
              {locale === "de" ? "EN" : "DE"}
            </span>
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
              {userName}
            </p>
            <p className="text-[10px] text-sidebar-foreground/45 leading-tight mt-0.5">
              {isAdmin ? tr("settings.roleAdmin") : tr("settings.roleUser")}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 h-8"
          onClick={handleSignOut}
        >
          <LogOut className="w-3.5 h-3.5" />
          {tr("nav.signOut")}
        </Button>
      </div>
    </aside>
  );
}
