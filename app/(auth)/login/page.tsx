"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AppLogo from "@/components/AppLogo";

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("E-Mail oder Passwort falsch.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo + wordmark */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <AppLogo size="xl" showWordmark={false} />
        <h1 className="text-2xl font-bold tracking-tight">Evodia</h1>
        <p className="text-sm text-muted-foreground">
          Travel expenses. Simplified.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Sign in to your account</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail address</Label>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Have an invite code?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create account
          </Link>
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/50">
        §26 EStG · BAO §131 · 2026
      </p>
    </div>
  );
}
