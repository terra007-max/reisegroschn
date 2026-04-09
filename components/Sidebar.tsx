"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  PlusCircle,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", icon: Plane },
  { href: "/trips/new", label: "Neue Reise", icon: PlusCircle },
];

const adminItems = [{ href: "/admin", label: "Genehmigungen", icon: Shield }];

interface SidebarProps {
  userName: string;
  userRole: string;
}

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 hero-gradient rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sidebar-foreground text-base leading-none tracking-tight">
              ReiseGroschn
            </span>
            <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">
              Reisekostenabrechnung
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
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
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full" />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest">
                Administration
              </p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
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
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User footer */}
      <div className="px-3 py-4 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
              {userName}
            </p>
            <p className="text-[10px] text-sidebar-foreground/45 leading-tight mt-0.5">
              {isAdmin ? "Administrator" : "Mitarbeiter"}
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
          Abmelden
        </Button>
      </div>
    </aside>
  );
}
