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

const adminItems = [
  { href: "/admin", label: "Genehmigungen", icon: Shield },
];

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
    <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-sidebar-foreground text-lg leading-none">
              ReiseGroschn
            </span>
            <p className="text-xs text-sidebar-foreground/60 leading-none mt-0.5">
              Reisekosten
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <Separator className="bg-sidebar-border my-2" />
            <p className="px-3 py-1 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User footer */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {userName}
            </p>
            <p className="text-xs text-sidebar-foreground/50">
              {isAdmin ? "Administrator" : "Mitarbeiter"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </Button>
      </div>
    </aside>
  );
}
