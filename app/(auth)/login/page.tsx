"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";
import AppLogo from "@/components/AppLogo";

const features = [
  "§ 26 EStG konforme Taggeld-Berechnung",
  "Automatisches Kilometergeld à €0,50/km",
  "Digitale Belegerfassung mit OCR",
  "Genehmigungsworkflow für HR & Buchhaltung",
];

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("E-Mail oder Passwort falsch.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left: Brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col hero-gradient text-white p-10 relative overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Logo */}
        <div className="relative">
          <AppLogo size="md" light />
        </div>

        {/* Hero text */}
        <div className="relative flex-1 flex flex-col justify-center gap-8 mt-12">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Reisekostenabrechnung
              <br />
              für Österreich.
            </h1>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Automatisch, gesetzeskonform und papierlos.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
                <span className="text-white/90 text-sm leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-8">
          <p className="text-white/40 text-xs">§26 EStG · BAO §131 · BGBL 2026</p>
        </div>
      </div>

      {/* ── Right: Login form ──────────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-12 bg-background">
        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center gap-4 mb-10">
          <AppLogo size="xl" showWordmark={false} />
          <p className="font-bold text-2xl tracking-tight">ReiseGroschn</p>
          <p className="text-sm text-muted-foreground -mt-2">
            Reisekostenabrechnung für Österreich
          </p>
        </div>

        <div className="w-full max-w-sm space-y-7">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Willkommen zurück</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Melden Sie sich mit Ihrer Firmen-E-Mail an
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="max.mustermann@firma.at"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Anmelden…
                </>
              ) : (
                "Anmelden"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Noch kein Konto?{" "}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
