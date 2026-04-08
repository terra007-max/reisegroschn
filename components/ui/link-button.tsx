/**
 * LinkButton — a Next.js Link styled as a Button.
 * Use this wherever you need a button that navigates (replaces asChild pattern).
 */
import Link from "next/link";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
