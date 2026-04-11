"use client";

import { useState, useEffect } from "react";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import AppLogo from "@/components/AppLogo";
import { useLocale } from "@/contexts/LocaleContext";
import NewTripButton from "@/components/NewTripButton";

interface MobileNavProps {
  userName: string;
  userRole: string;
}

export default function MobileNav({ userName, userRole }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, tr } = useLocale();
  const isAdmin = userRole === "ADMIN";

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/trips/new") return pathname === "/trips/new";
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href) && !pathname.startsWith("/trips/new");
  }

  const navItemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors relative w-full text-left",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
    );

  const navIcon = (active: boolean) =>
    cn(
      "w-4 h-4 flex-shrink-0 transition-colors",
      active
        ? "text-sidebar-primary"
        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
    );

  function NavItemContent({
    href,
    active,
    icon: Icon,
    label,
  }: {
    href: string;
    active: boolean;
    icon: React.ElementType;
    label: string;
  }) {
    return (
      <>
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full" />
        )}
        <Icon className={navIcon(active)} />
        <span>{label}</span>
      </>
    );
  }

  return (
    <>
      {/* ── Mobile header bar ── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-sidebar/95 backdrop-blur-md border-b border-sidebar-border shrink-0">
        <AppLogo size="sm" />

        {/* Animated hamburger */}
        <button
          onClick={() => setIsOpen(true)}
          aria-label={tr("nav.openMenu")}
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
          className="relative flex flex-col justify-center items-end w-10 h-10 gap-[5px] rounded-xl hover:bg-sidebar-accent/40 active:bg-sidebar-accent/60 transition-colors"
        >
          <span className="w-5 h-[2px] bg-sidebar-foreground rounded-full block transition-all duration-300" />
          <span className="w-5 h-[2px] bg-sidebar-foreground rounded-full block transition-all duration-300" />
          <span className="w-3 h-[2px] bg-sidebar-foreground rounded-full block transition-all duration-300" />
        </button>
      </header>

      {/* ── Backdrop ── */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden
      />

      {/* ── Slide-in drawer ── */}
      <aside
        id="mobile-drawer"
        aria-label="Navigation"
        className={cn(
          "lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-sidebar flex flex-col",
          "shadow-2xl shadow-black/25 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-sidebar-border shrink-0">
          <div>
            <AppLogo size="sm" />
            <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5 ml-[38px]">
              {tr("nav.tagline")}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label={tr("nav.closeMenu")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const cls = navItemClass(active);
            const content = (
              <NavItemContent
                href={item.href}
                active={active}
                icon={item.icon}
                label={item.label}
              />
            );

            if (item.href === "/trips/new") {
              return (
                <NewTripButton key={item.href} className={cls}>
                  {content}
                </NewTripButton>
              );
            }
            return (
              <Link key={item.href} href={item.href} className={cls}>
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
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navItemClass(active)}
                  >
                    <NavItemContent
                      href={item.href}
                      active={active}
                      icon={item.icon}
                      label={item.label}
                    />
                  </Link>
                );
              })}
            </>
          )}

          <div className="pt-2">
            <Link
              href="/settings"
              className={navItemClass(pathname === "/settings")}
            >
              <NavItemContent
                href="/settings"
                active={pathname === "/settings"}
                icon={Settings}
                label={tr("nav.settings")}
              />
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-1 shrink-0">
          {/* Quick toggles */}
          <div className="flex items-center gap-1 px-1 pb-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? tr("settings.themeLight") : tr("settings.themeDark")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              title={locale === "de" ? "Switch to English" : "Zu Deutsch wechseln"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
            >
              <span className="font-mono font-bold text-[11px]">
                {locale === "de" ? "EN" : "DE"}
              </span>
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
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

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {tr("nav.signOut")}
          </button>
        </div>
      </aside>
    </>
  );
}
