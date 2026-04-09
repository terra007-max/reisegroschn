"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Plane, Mail } from "lucide-react";
import GroschenCoin from "@/components/GroschenCoin";

const features = [
  "§ 26 EStG konforme Taggeld-Berechnung",
  "Automatisches Kilometergeld à €0,50/km",
  "Digitale Belegerfassung mit OCR",
  "Genehmigungsworkflow für HR & Buchhaltung",
];

export default function SignupPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = form.get("full_name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const inviteCode = form.get("invite_code") as string;

    startTransition(async () => {
      setError(null);

      if (inviteCode.trim().toUpperCase() !== "BREF26") {
        setError("Ungültiger Einladungscode.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">E-Mail bestätigen</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Wir haben Ihnen eine Bestätigungs-E-Mail gesendet. Bitte klicken
              Sie auf den Link, um die Registrierung abzuschließen.
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm text-primary font-medium hover:underline block"
          >
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left: Brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col hero-gradient text-white p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/20">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">ReiseGroschn</span>
        </div>

        <div className="relative flex-1 flex flex-col justify-center gap-8 mt-12">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Starten Sie heute
              <br />
              mit ReiseGroschn.
            </h1>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Einladungscode erhalten? Erstellen Sie Ihr Konto.
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

        <div className="relative flex items-center gap-3 mt-8">
          <GroschenCoin size={36} />
          <p className="text-white/50 text-xs">§26 EStG · BAO §131 · BGBL 2024</p>
        </div>
      </div>

      {/* ── Right: Signup form ─────────────────────────────── */}
      <div className="flex flex-col items-center justify-center p-8 lg:p-12 bg-background">
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">ReiseGroschn</span>
        </div>

        <div className="w-full max-w-sm space-y-7">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Konto erstellen</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Einladungscode erforderlich
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite_code">Einladungscode</Label>
              <Input
                id="invite_code"
                name="invite_code"
                type="text"
                required
                placeholder="XXXXXX"
                autoCapitalize="characters"
                autoFocus
                className="h-10 font-mono tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Vollständiger Name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                placeholder="Max Mustermann"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
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
                minLength={8}
                autoComplete="new-password"
                placeholder="Mindestens 8 Zeichen"
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
                  <GroschenCoin size={18} className="mr-2 shrink-0" />
                  Erstellen…
                </>
              ) : (
                "Konto erstellen"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Bereits registriert?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
