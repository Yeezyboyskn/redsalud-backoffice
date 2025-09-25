"use client"
import { Button } from "@/components/ui/button"
export default function Topbar() {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4">
      <div className="text-sm text-muted-foreground">Backoffice</div>
      <form action="/login" method="get">
        <Button variant="outline" size="sm">Cambiar rol</Button>
      </form>
    </header>
  )
}
