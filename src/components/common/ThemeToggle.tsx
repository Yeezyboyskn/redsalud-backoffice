"use client"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { MoonStar, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = theme === "dark"
  const toggle = () => setTheme(isDark ? "light" : "dark")

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="bg-white/10 text-primary-foreground hover:bg-white/20"
        aria-label="Cambiar tema"
        disabled
      >
        <MoonStar className="size-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="bg-white/10 text-primary-foreground hover:bg-white/20"
      onClick={toggle}
      aria-label="Cambiar tema"
    >
      {isDark ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
      <span className="hidden sm:inline-block text-xs font-semibold tracking-wide">
        {isDark ? "Modo claro" : "Modo oscuro"}
      </span>
    </Button>
  )
}


