"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, LogOut, User, Languages, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/translations";

interface SettingsClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function SettingsClient({
  userName,
  userEmail,
  userRole,
}: SettingsClientProps) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, tr } = useLocale();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success(locale === "en" ? "Signed out" : "Abgemeldet");
    router.push("/login");
    router.refresh();
  }

  const themes: { value: string; label: string; icon: React.ElementType }[] = [
    { value: "light", label: tr("settings.themeLight"), icon: Sun },
    { value: "dark", label: tr("settings.themeDark"), icon: Moon },
    { value: "system", label: tr("settings.themeSystem"), icon: Monitor },
  ];

  const languages: { value: Locale; label: string; flag: string; native: string }[] = [
    { value: "de", label: "Deutsch", flag: "🇦🇹", native: "Deutsch" },
    { value: "en", label: "English", flag: "🇬🇧", native: "English" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{tr("settings.title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{tr("settings.subtitle")}</p>
      </div>

      {/* Appearance */}
      <SettingsSection
        icon={Palette}
        title={tr("settings.appearance")}
        description={tr("settings.appearanceHint")}
      >
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all",
                theme === value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Language */}
      <SettingsSection
        icon={Languages}
        title={tr("settings.language")}
        description={tr("settings.languageHint")}
      >
        <div className="grid grid-cols-2 gap-2">
          {languages.map(({ value, label, flag, native }) => (
            <button
              key={value}
              onClick={() => setLocale(value)}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all text-left",
                locale === value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <span className="text-xl leading-none flex-shrink-0">{flag}</span>
              <div>
                <p className="font-semibold leading-tight">{native}</p>
                <p className={cn("text-xs leading-tight mt-0.5", locale === value ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                  {label}
                </p>
              </div>
              {locale === value && (
                <div className="ml-auto w-4 h-4 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Account */}
      <SettingsSection
        icon={User}
        title={tr("settings.account")}
        description={tr("settings.accountHint")}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">{tr("settings.name")}</span>
            <span className="text-sm font-medium">{userName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">E-Mail</span>
            <span className="text-sm font-medium truncate max-w-[200px]">{userEmail}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{tr("settings.role")}</span>
            <span className="text-sm font-medium">
              {userRole === "ADMIN" ? tr("settings.roleAdmin") : tr("settings.roleUser")}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full mt-2 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          {tr("settings.signOut")}
        </Button>
      </SettingsSection>

      <p className="text-center text-xs text-muted-foreground/50 pb-4">
        Evodia · §26 EStG · BAO §131 · 2026
      </p>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl p-5 space-y-4 card-shadow">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
