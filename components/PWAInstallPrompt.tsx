"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import AppLogo from "@/components/AppLogo";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "evodia_pwa_prompt_dismissed_until";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PromptMode = "android" | "ios" | null;

export default function PWAInstallPrompt() {
  const { tr } = useLocale();
  const [mode, setMode] = useState<PromptMode>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed as PWA — do nothing
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Dismissed recently — do nothing
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    // Register service worker (required for Android install criteria)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }

    // iOS Safari: no beforeinstallprompt — show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    if (isIOS) {
      setMode("ios");
      return;
    }

    // Android / Chrome / Edge: listen for native prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setMode(null);
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 864e5));
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setMode(null);
    } else {
      dismiss();
    }
  }

  if (!mode) return null;

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
        {mode === "ios" ? (
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {tr("pwa.iosHint")}{" "}
            <Share className="w-3 h-3 inline-block align-[-1px] mx-0.5" />
            {" "}{tr("pwa.iosThen")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {tr("pwa.description")}
          </p>
        )}
      </div>

      {mode === "android" && (
        <button
          onClick={install}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0",
            "bg-primary text-primary-foreground text-xs font-semibold",
            "active:scale-95 transition-transform"
          )}
          aria-label={tr("pwa.install")}
        >
          <Download className="w-3.5 h-3.5" />
          {tr("pwa.install")}
        </button>
      )}

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
