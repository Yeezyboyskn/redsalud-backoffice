"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm text-secondary shadow-sm shadow-primary/5 outline-none transition placeholder:text-secondary/50 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20",
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
