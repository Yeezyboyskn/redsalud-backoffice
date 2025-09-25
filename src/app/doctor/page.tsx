"use client"

import AppShell from "@/components/common/AppShell"
import DataTable from "@/components/common/DataTable"
import type { ColumnDef } from "@tanstack/react-table"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { exportCsv } from "@/lib/csv"

type Doctor = { id: number; rut: string; nombre: string; especialidad: string; piso: number; boxes: number[] }
type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }
type Bloqueo = { id: string; box: number; fecha: string; motivo: string; creadoPor: string }
type KPIDoc = { semana: { dia: string; ocupacion: number }[]; proximos: { fecha: string; box: number }[] }

function getCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : ""
}

export default function Page() {
  const rut = useMemo(() => getCookie("rut"), [])
  const qc = useQueryClient()

  const { data: me } = useQuery<Doctor | null>({
    queryKey: ["me", rut],
    queryFn: () => fetch(`/api/doctors?rut=${encodeURIComponent(rut)}`).then((r) => r.json()),
    enabled: !!rut,
  })

  const { data: allBoxes = [] } = useQuery<Box[]>({
    queryKey: ["boxes"],
    queryFn: () => fetch("/api/boxes").then((r) => r.json()),
  })

  const { data: bloqueos = [] } = useQuery<Bloqueo[]>({
    queryKey: ["bloqueos"],
    queryFn: () => fetch("/api/bloqueos").then((r) => r.json()),
  })

  const { data: kpi = { semana: [], proximos: [] } } = useQuery<KPIDoc>({
    queryKey: ["kpi-doc", rut],
    queryFn: () => fetch(`/api/kpis/doctor?rut=${encodeURIComponent(rut)}`).then((r) => r.json()),
    enabled: !!rut,
  })

  const misBoxes = useMemo(() => allBoxes.filter((b) => me?.boxes.includes(b.id)), [allBoxes, me])
  const columns: ColumnDef<Box, any>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Especialidad", accessorKey: "especialidad" },
    { header: "Estado", accessorKey: "estado" },
  ]

  if (!rut) {
    return (
      <AppShell>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-secondary">Panel m\édico</h1>
          <section className="rounded-2xl border border-border/60 bg-white/90 p-6 text-secondary shadow-lg shadow-primary/10 backdrop-blur-sm">
            <p className="font-medium text-destructive">
              No se encontró el doctor. Regresa al inicio de sesión y verifica tu RUT.
            </p>
          </section>
        </div>
      </AppShell>
    )
  }

  const misBloqueos = bloqueos.filter((b) => me?.boxes.includes(b.box))

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">
                Panel m\édico
              </span>
              <h1 className="text-3xl font-semibold text-secondary">
                {me ? `Hola, ${me.nombre.split(" ")[0]}` : "Gesti\ón cl\ínica"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Visualiza el desempe\ño de tus boxes y administra bloqueos con la identidad RedSalud.
              </p>
              {me && (
                <p className="text-sm font-medium text-secondary/80">
                  {me.especialidad} · Piso {me.piso} · Boxes {me.boxes.join(", ")}
                </p>
              )}
            </div>
            {me && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => exportCsv(`mis_boxes_${me.rut}`, misBoxes)}>
                  Exportar boxes
                </Button>
                <Button variant="outline" onClick={() => exportCsv(`mis_bloqueos_${me.rut}`, misBloqueos)}>
                  Exportar bloqueos
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Uso semanal (%)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpi.semana}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(18, 67, 71, 0.1)" />
                <XAxis dataKey="dia" stroke="rgba(18,67,71,0.6)" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="rgba(18,67,71,0.6)" tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(0, 162, 154, 0.1)" }} />
                <Bar dataKey="ocupacion" radius={[8, 8, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Pr\óximas disponibilidades</h2>
          <ul className="space-y-2 text-sm">
            {kpi.proximos.map((p, i) => (
              <li
                key={`${p.box}-${p.fecha}-${i}`}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-secondary/90 shadow-sm shadow-primary/5"
              >
                <span className="font-semibold text-secondary">{p.fecha}</span>
                <span className="text-muted-foreground">Box {p.box}</span>
              </li>
            ))}
            {kpi.proximos.length === 0 && (
              <li className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-muted-foreground">
                Sin datos disponibles por ahora.
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm space-y-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-secondary">Solicitar bloqueo r\ápido</h2>
            <p className="text-sm text-muted-foreground">
              Enviar\ás una solicitud inmediata al equipo de agendamiento.
            </p>
          </div>
          <FormBloqueo boxesIds={me?.boxes ?? []} onOk={() => qc.invalidateQueries({ queryKey: ["bloqueos"] })} />
          <div>
            <h3 className="mt-2 mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-secondary/70">
              Bloqueos vigentes
            </h3>
            <ul className="space-y-2 text-sm">
              {misBloqueos.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-secondary/90 shadow-sm shadow-primary/5"
                >
                  <span>
                    Box {b.box} · {b.fecha} · {b.motivo}
                  </span>
                  <span className="text-muted-foreground">{b.creadoPor}</span>
                </li>
              ))}
              {misBloqueos.length === 0 && (
                <li className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-muted-foreground">
                  No hay bloqueos activos.
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Mis boxes</h2>
          <DataTable columns={columns} data={misBoxes} />
        </section>
      </div>
    </AppShell>
  )
}

/* -------- Formulario de bloqueo -------- */
function FormBloqueo({ boxesIds, onOk }: { boxesIds: number[]; onOk: () => void }) {
  const { register, handleSubmit, reset } = useForm<{ box: number; fecha: string; motivo: string }>()
  const mut = useMutation({
    mutationFn: (d: { box: number; fecha: string; motivo: string }) =>
      fetch("/api/bloqueos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("Solicitud enviada")
      reset()
      onOk()
    },
  })

  return (
    <form
      onSubmit={handleSubmit((d) => {
        if (!d.box || !d.fecha || !d.motivo?.trim()) return toast.error("Completa todos los campos")
        mut.mutate({ ...d, box: Number(d.box) })
      })}
      className="grid gap-4 sm:grid-cols-3"
    >
      <div className="space-y-2">
        <Label>Box</Label>
        <select
          className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
          {...register("box", { valueAsNumber: true })}
        >
          <option value="">Seleccione</option>
          {boxesIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input type="date" {...register("fecha")} />
      </div>
      <div className="space-y-2">
        <Label>Motivo</Label>
        <Input {...register("motivo")} placeholder="Ej. congreso, reposo, mantenci\ón" />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
          {mut.isPending ? "Enviando..." : "Solicitar bloqueo"}
        </Button>
      </div>
    </form>
  )
}







