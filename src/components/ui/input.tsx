import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border border-border/60 bg-white/80 px-4 py-2 text-base shadow-sm shadow-primary/10 transition-[color,box-shadow,border-color] outline-none rounded-xl backdrop-blur",
        "focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }

