import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { h: 32, w: 32 },
  md: { h: 44, w: 44 },
  lg: { h: 64, w: 64 },
} as const;

export interface LogoProps {
  size?: keyof typeof SIZES;
  /** Show the "Ayyan Motors" wordmark beside the mark. */
  withWordmark?: boolean;
  /** Force a variant instead of following the theme. */
  variant?: "auto" | "light" | "dark";
  className?: string;
}

/**
 * Both logo files are rendered and toggled with CSS rather than swapped in JS,
 * so the correct one is present on first paint with no hydration flash.
 * `variant="dark"` means "for use on a dark surface".
 */
export function Logo({
  size = "md",
  withWordmark = false,
  variant = "auto",
  className,
}: LogoProps) {
  const { h, w } = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative shrink-0" style={{ height: h, width: w }}>
        <Image
          src="/brand/ayyan-logo.png"
          alt="Ayyan Motors Ltd"
          width={w}
          height={h}
          priority
          className={cn(
            "object-contain",
            variant === "auto" && "dark:hidden",
            variant === "dark" && "hidden",
          )}
        />
        <Image
          src="/brand/ayyan-logo-inverse.png"
          alt=""
          aria-hidden
          width={w}
          height={h}
          className={cn(
            "absolute inset-0 object-contain",
            variant === "auto" && "hidden dark:block",
            variant === "light" && "hidden",
            variant === "dark" && "block",
          )}
        />
      </span>

      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-base font-extrabold tracking-tight">
            AYYAN MOTORS
          </span>
          <span className="eyebrow mt-1 text-text-subtle">Car Import &amp; Export</span>
        </span>
      )}
    </span>
  );
}
