"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery } from "@tanstack/react-query"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type KPI = { piso: number; ocupacion: number }
type Overview = { resumen: { totalBloqueos: number; pendientes: number; aprobados: number; rechazados: number; horasExtra: number; horasExtraCompartidas: number; tramosContrato: number }; recientes: { id: string; fecha: string; inicio: string; fin: string; estado: string; motivo: string; rut: string; boxId?: number }[] }

const toPercent = (v: number) => `${v}%`

export default function Page() {
  const { data, isLoading, isError } = useQuery<KPI[]>({
    queryKey: ["kpi-ocupacion"],
    queryFn: () => fetch("/api/kpis/ocupacion").then((r) => r.json()),
  })
  const overview = useQuery<Overview>({
    queryKey: ["jefatura-overview"],
    queryFn: () => fetch("/api/jefatura/overview").then((r) => r.json()),
  })

  const rows = (data ?? []).slice().sort((a, b) => a.piso - b.piso)

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Jefatura</span>
            <h1 className="text-3xl font-semibold text-secondary">Visión ejecutiva de ocupación</h1>
            <p className="text-sm text-muted-foreground">
              Monitorea cómo se distribuye la ocupación por piso para anticipar decisiones operativas.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm" aria-label="KPI de ocupación por piso">
          <h2 className="mb-4 text-lg font-semibold text-secondary">Ocupación por piso (%)</h2>

          {isLoading && <p className="text-sm text-muted-foreground">Cargando indicadores...</p>}
          {isError && <p className="text-sm text-destructive">No pudimos cargar los KPIs.</p>}
          {!isLoading && !isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(18, 67, 71, 0.12)" />
                  <XAxis dataKey="piso" stroke="rgba(18,67,71,0.6)" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="rgba(18,67,71,0.6)" tickFormatter={toPercent} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(0, 162, 154, 0.08)" }}
                    formatter={(v: number) => [toPercent(v), "Ocupación"]}
                    labelFormatter={(label) => `Piso ${label}`}
                  />
                  <Bar dataKey="ocupacion" radius={[8, 8, 0, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Panel ejecutivo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-secondary/70">Pendientes</p>
                <p className="text-3xl font-semibold text-amber-600">{overview.data?.resumen?.pendientes ?? 0}</p>
                <p className="text-xs text-secondary/60">Solicitudes en espera (bloqueo/extra)</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-secondary/70">Aprobados</p>
                <p className="text-3xl font-semibold text-emerald-700">{overview.data?.resumen?.aprobados ?? 0}</p>
                <p className="text-xs text-secondary/60">Se liberan como horas extras compartidas</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
                <p className="text-sm text-secondary/70">Horas extra publicadas</p>
                <p className="text-3xl font-semibold text-primary">{overview.data?.resumen?.horasExtra ?? 0}</p>
                <p className="text-xs text-secondary/60">Compartidas: {overview.data?.resumen?.horasExtraCompartidas ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Check de solicitudes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(overview.data?.recientes ?? []).map((r) => (
                <div key={r.id} className="flex flex-col rounded-xl border border-border/60 bg-white/80 px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-secondary">{r.fecha}</span>
                    <Badge variant="outline" className={r.estado === "aprobado" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : r.estado === "rechazado" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
                      {r.estado}
                    </Badge>
                  </div>
                  <span className="text-xs text-secondary/70">{r.inicio} - {r.fin} · {r.motivo} · {r.boxId ? `Box ${r.boxId}` : "Box sin asignar"}</span>
                  <span className="text-[11px] text-secondary/60">RUT {r.rut}</span>
                </div>
              ))}
              {(overview.data?.recientes?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Sin movimientos recientes.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  )
}




