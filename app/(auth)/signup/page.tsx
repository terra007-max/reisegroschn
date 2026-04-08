"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Plane } from "lucide-react";

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
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Plane className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">E-Mail bestätigen</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Wir haben Ihnen eine Bestätigungs-E-Mail gesendet. Bitte
                klicken Sie auf den Link, um die Registrierung abzuschließen.
              </p>
            </div>
            <Link
              href="/login"
              className="text-sm text-primary font-medium hover:underline block"
            >
              Zurück zur Anmeldung
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Plane className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">ReiseGroschn</h1>
            <p className="text-muted-foreground text-sm">
              Konto erstellen
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Registrieren</CardTitle>
            <CardDescription>
              Einladungscode erforderlich
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite_code">Einladungscode</Label>
                <Input
                  id="invite_code"
                  name="invite_code"
                  type="text"
                  required
                  placeholder="XXXXXX"
                  autoCapitalize="characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Vollständiger Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="max.mustermann@firma.at"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/5 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Konto erstellen
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Bereits registriert?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
