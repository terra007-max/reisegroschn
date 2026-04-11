"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import AppLogo from "@/components/AppLogo";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "evodia_pwa_prompt_dismissed_until";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const { tr } = useLocale();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2",
        "w-[calc(100%-2rem)] max-w-sm z-50",
        "bg-card border border-border rounded-2xl shadow-xl shadow-black/10",
        "flex items-center gap-3 px-4 py-3",
        "animate-in slide-in-from-bottom-4 fade-in duration-300"
      )}
      role="banner"
    >
      <AppLogo size="sm" showWordmark={false} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {tr("pwa.title")}
        </p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
          {tr("pwa.description")}
        </p>
      </div>

      <button
        onClick={install}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
          "bg-primary text-primary-foreground text-xs font-semibold",
          "active:scale-95 transition-transform shrink-0"
        )}
        aria-label={tr("pwa.install")}
      >
        <Download className="w-3.5 h-3.5" />
        {tr("pwa.install")}
      </button>

      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mr-1"
        aria-label={tr("pwa.later")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
