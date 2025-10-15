"use client"

import AppShell from "@/components/common/AppShell"
import DataTable from "@/components/common/DataTable"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useState } from "react"
import { exportCsv } from "@/lib/csv"
import BoxesBoard from "@/components/agendamiento/BoxesBoard"

type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }
type Ticket = { id: string; tipo: "bloqueo" | "sistema"; detalle: string; estado: "abierto" | "cerrado"; creadoPor: string }

function TablaBoxes() {
  const [estado, setEstado] = useState("")
  const [esp, setEsp] = useState("")
  const [piso, setPiso] = useState("")

  const qs = new URLSearchParams()
  if (estado) qs.set("estado", estado)
  if (esp) qs.set("especialidad", esp)
  if (piso) qs.set("piso", piso)

  const { data = [], isLoading, isError } = useQuery<Box[]>({
    queryKey: ["boxes", estado, esp, piso],
    queryFn: () => fetch(`/api/boxes${qs.toString() ? `?${qs}` : ""}`).then((r) => r.json()),
  })

  const columns: ColumnDef<Box, unknown>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Especialidad", accessorKey: "especialidad" },
    { header: "Estado", accessorKey: "estado" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Estado (disponible/bloqueado)" value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full max-w-xs" />
        <Input placeholder="Especialidad" value={esp} onChange={(e) => setEsp(e.target.value)} className="w-full max-w-xs" />
        <Input placeholder="Piso" value={piso} onChange={(e) => setPiso(e.target.value)} className="w-full max-w-[120px]" />
        <Button variant="outline" onClick={() => exportCsv("boxes_filtrados", data)} disabled={!data.length}>
          Exportar CSV
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando datos de boxes...</p>}
      {isError && <p className="text-sm text-destructive">Ocurrio un problema al cargar los boxes.</p>}
      {!isLoading && !isError && <DataTable columns={columns} data={data} />}
    </div>
  )
}

function Formbloqueo() {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<{ box: number; fecha: string; motivo: string }>()
  const mut = useMutation({
    mutationFn: (d: { box: number; fecha: string; motivo: string }) =>
      fetch("/api/bloqueos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("bloqueo creado")
      qc.invalidateQueries({ queryKey: ["bloqueos"] })
      reset()
    },
  })
  return (
    <form
      onSubmit={handleSubmit((d) => {
        if (!d.box || !d.fecha || !d.motivo?.trim()) {
          toast.error("Completa todos los campos")
          return
        }
        mut.mutate({ ...d, box: Number(d.box) })
      })}
      className="grid gap-4 sm:grid-cols-3"
    >
      <div className="space-y-2">
        <Label>Box</Label>
        <Input type="number" {...register("box", { valueAsNumber: true })} placeholder="Ej. 301" />
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input type="date" {...register("fecha")} />
      </div>
      <div className="space-y-2">
        <Label>Motivo</Label>
        <Input {...register("motivo")} placeholder="Describe la solicitud" />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
          {mut.isPending ? "Creando..." : "Crear bloqueo"}
        </Button>
      </div>
    </form>
  )
}

function Tickets() {
  const { data: items = [], isLoading, isError } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: () => fetch("/api/tickets").then((r) => r.json()),
  })
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: (d: { tipo: "bloqueo" | "sistema"; detalle: string }) =>
      fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  })

  const close = useMutation({
    mutationFn: (id: string) => fetch(`/api/tickets/${id}/cerrar`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  })

  return (
    <div className="space-y-4">
      <form
        className="flex w-full flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget as HTMLFormElement)
          const tipo = (fd.get("tipo") as "bloqueo" | "sistema") ?? "bloqueo"
          const detalle = String(fd.get("detalle") || "")
          if (!detalle.trim()) return
          create.mutate({ tipo, detalle })
          ;(e.currentTarget as HTMLFormElement).reset()
        }}
      >
        <select
          name="tipo"
          className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60 md:w-auto"
        >
          <option value="bloqueo">bloqueo</option>
          <option value="sistema">Sistema</option>
        </select>
        <Input name="detalle" placeholder="Detalle del ticket" className="flex-1" />
        <Button type="submit" disabled={create.isPending} className="md:w-auto">
          {create.isPending ? "Enviando..." : "Levantar ticket"}
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando tickets...</p>}
      {isError && <p className="text-sm text-destructive">No pudimos cargar los tickets.</p>}

      {!isLoading && !isError && (
        <ul className="space-y-2">
          {items.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-secondary/90 shadow-sm shadow-primary/5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-secondary">#{t.id}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/70">
                  {t.tipo}
                </span>
                <span>{t.detalle}</span>
                <span className={t.estado === "abierto" ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
                  {t.estado}
                </span>
              </div>
              {t.estado === "abierto" && (
                <Button size="sm" variant="outline" onClick={() => close.mutate(t.id)} disabled={close.isPending}>
                  Cerrar
                </Button>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
              Sin tickets registrados.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Agendamiento</span>
            <h1 className="text-3xl font-semibold text-secondary">Control integral de boxes</h1>
            <p className="text-sm text-muted-foreground">
              Optimiza la ocupacion y gestiona solicitudes en tiempo real para toda la red RedSalud.
            </p>
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Reasignacion rapida de boxes</h2>
            <BoxesBoard />
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Boxes</h2>
            <TablaBoxes />
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Nuevo bloqueo</h2>
            <Formbloqueo />
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Tickets</h2>
            <Tickets />
          </section>
        </div>
      </div>
    </AppShell>
  )
}





