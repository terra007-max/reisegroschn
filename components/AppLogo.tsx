import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";

interface AppLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
  /** Force light text (for dark/hero backgrounds) */
  light?: boolean;
}

const iconSizes: Record<LogoSize, { icon: number; text: string }> = {
  sm: { icon: 28, text: "text-base" },
  md: { icon: 36, text: "text-lg" },
  lg: { icon: 48, text: "text-xl" },
  xl: { icon: 72, text: "text-3xl" },
};

export default function AppLogo({
  size = "md",
  showWordmark = true,
  className,
  light = false,
}: AppLogoProps) {
  const { icon, text } = iconSizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo-icon.svg"
        alt="Evodia"
        width={icon}
        height={icon}
        className="flex-shrink-0 drop-shadow-sm"
        priority
      />
      {showWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight leading-none select-none",
            text,
            light ? "text-white" : "text-foreground"
          )}
        >
          Evodia
        </span>
      )}
    </div>
  );
}
