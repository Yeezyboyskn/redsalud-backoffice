"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery } from "@tanstack/react-query"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

type KPI = { piso: number; ocupacion: number }

const toPercent = (v: number) => `${v}%`

export default function Page() {
  const { data, isLoading, isError } = useQuery<KPI[]>({
    queryKey: ["kpi-ocupacion"],
    queryFn: () => fetch("/api/kpis/ocupacion").then((r) => r.json()),
  })

  const rows = (data ?? []).slice().sort((a, b) => a.piso - b.piso)

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Jefatura</span>
            <h1 className="text-3xl font-semibold text-secondary">Vision ejecutiva de ocupacion</h1>
            <p className="text-sm text-muted-foreground">
              Monitorea como se distribuye la ocupacion por piso para anticipar decisiones operativas.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm" aria-label="KPI de ocupacion por piso">
          <h2 className="mb-4 text-lg font-semibold text-secondary">Ocupacion por piso (%)</h2>

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
                    formatter={(v: number) => [toPercent(v), "Ocupacion"]}
                    labelFormatter={(label) => `Piso ${label}`}
                  />
                  <Bar dataKey="ocupacion" radius={[8, 8, 0, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}




