"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : "dark"
  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(next)}>
      {next === "dark" ? "Modo oscuro" : "Modo claro"}
    </Button>
  )
}
