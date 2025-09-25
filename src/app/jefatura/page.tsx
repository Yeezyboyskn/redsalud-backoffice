"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery } from "@tanstack/react-query"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

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
      <h1 className="text-xl font-semibold mb-3">Jefatura</h1>

      <section className="border rounded p-3" aria-label="KPI de ocupación por piso">
        <h2 className="font-medium mb-2">Ocupación por piso (%)</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-red-600">Error al cargar KPIs.</p>}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin datos</p>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="piso" />
                <YAxis domain={[0, 100]} tickFormatter={toPercent} />
                <Tooltip
                  formatter={(v: number) => [toPercent(v), "Ocupación"]}
                  labelFormatter={(label) => `Piso ${label}`}
                />
                <Bar dataKey="ocupacion" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </AppShell>
  )
}
