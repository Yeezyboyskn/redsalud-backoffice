"use client"

import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
        variant === "outline"
          ? "border border-border/70 bg-white text-secondary"
          : "bg-primary/10 text-primary",
        className,
      )}
      {...props}
    />
  )
}
