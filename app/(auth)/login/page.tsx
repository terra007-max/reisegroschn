"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plane } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Plane className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">ReiseGroschn</h1>
            <p className="text-muted-foreground text-sm">
              Österreichische Reisekostenabrechnung
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Melden Sie sich mit Ihrer Firmen-E-Mail an
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="current-password"
                  placeholder="••••••••"
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
                Anmelden
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link
            href="/signup"
            className="text-primary font-medium hover:underline"
          >
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
