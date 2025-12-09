"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Block = { id: string; fecha: string; inicio: string; fin: string; motivo: string; estado: string }
type Extra = { id: string; fecha: string; inicio: string; fin: string; boxId?: number | null }

type Combined = { id: string; fecha: string; inicio: string; fin: string; motivo: string; estado: string; tipo: "bloqueo" | "extra" }

const fmt = (iso: string) => format(new Date(`${iso}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })

export default function PendingRequests() {
  const year = new Date().getFullYear()

  const blocks = useQuery<{ items: Block[] }>({
    queryKey: ["doctor-block-requests-pending", year],
    queryFn: async () => (await fetch(`/api/doctor/block-requests?from=${year}-01-01&to=${year}-12-31`)).json(),
  })

  const extras = useQuery<{ items: Extra[] }>({
    queryKey: ["doctor-extra-hours-pending", year],
    queryFn: async () => (await fetch(`/api/doctor/extra-hours?from=${year}-01-01&to=${year}-12-31`)).json(),
  })

  const items: Combined[] = [
    ...(blocks.data?.items ?? [])
      .filter((b) => b.estado === "pendiente")
      .map((b) => ({ ...b, tipo: "bloqueo" as const })),
    ...(extras.data?.items ?? []).map((e) => ({
      id: e.id,
      fecha: e.fecha,
      inicio: e.inicio,
      fin: e.fin,
      motivo: e.boxId ? `Hora extra ? Box ${e.boxId}` : "Hora extra / recuperativa",
      estado: "pendiente",
      tipo: "extra" as const,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const isLoading = blocks.isLoading || extras.isLoading

  return (
    <Card className="rounded-2xl border border-border/60 bg-white/95 shadow-lg shadow-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-secondary">Solicitudes pendientes</CardTitle>
        <p className="text-sm text-secondary/70">Bloqueos y horas extra en revisi?n</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No tienes solicitudes pendientes.</p>}
        {items.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/5 px-3 py-2">
            <div className="flex flex-col">
              <span className="font-semibold text-secondary">{fmt(b.fecha)}</span>
              <span className="text-xs text-secondary/70">
                {b.inicio} - {b.fin} ? {b.motivo}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Pendiente</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-secondary/60">{b.tipo === "extra" ? "Hora extra" : "Bloqueo"}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
