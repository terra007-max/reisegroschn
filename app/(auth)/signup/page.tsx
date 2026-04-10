"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import AppLogo from "@/components/AppLogo";

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
        setError("Invalid invite code.");
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
            <h2 className="text-xl font-bold">Confirm your e-mail</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              We sent you a confirmation e-mail. Click the link to complete registration.
            </p>
          </div>
          <Link href="/login" className="text-sm text-primary font-medium hover:underline block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <AppLogo size="xl" showWordmark={false} />
        <h1 className="text-2xl font-bold tracking-tight">Evodia</h1>
        <p className="text-sm text-muted-foreground">Travel expenses. Simplified.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Create account</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Invite code required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite_code">Invite code</Label>
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
            <Label htmlFor="full_name">Full name</Label>
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
            <Label htmlFor="email">E-Mail address</Label>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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
                Creating…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/50">§26 EStG · BAO §131 · 2026</p>
    </div>
  );
}
