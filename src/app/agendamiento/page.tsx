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

  const columns: ColumnDef<Box, any>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Especialidad", accessorKey: "especialidad" },
    { header: "Estado", accessorKey: "estado" },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="estado: disponible/bloqueado" value={estado} onChange={(e) => setEstado(e.target.value)} className="max-w-xs" />
        <Input placeholder="especialidad" value={esp} onChange={(e) => setEsp(e.target.value)} className="max-w-xs" />
        <Input placeholder="piso" value={piso} onChange={(e) => setPiso(e.target.value)} className="max-w-[120px]" />
        <Button variant="outline" onClick={() => exportCsv("boxes_filtrados", data)} disabled={!data.length}>
          Exportar CSV
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-red-600">Error al cargar boxes.</p>}
      {!isLoading && !isError && <DataTable columns={columns} data={data} />}
    </div>
  )
}

function FormBloqueo() {
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
      toast.success("Bloqueo creado")
      qc.invalidateQueries({ queryKey: ["bloqueos"] })
      reset()
    },
  })
  return (
    <form
      onSubmit={handleSubmit((d) => {
        if (!d.box || !d.fecha || !d.motivo?.trim()) {
          toast.error("Complete todos los campos")
          return
        }
        mut.mutate({ ...d, box: Number(d.box) })
      })}
      className="grid sm:grid-cols-3 gap-3"
    >
      <div>
        <Label>Box</Label>
        <Input type="number" {...register("box", { valueAsNumber: true })} />
      </div>
      <div>
        <Label>Fecha</Label>
        <Input type="date" {...register("fecha")} />
      </div>
      <div>
        <Label>Motivo</Label>
        <Input {...register("motivo")} />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? "Creando…" : "Crear bloqueo"}
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
    <div className="space-y-3">
      <form
        className="flex gap-2"
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
        <select name="tipo" className="border rounded h-10 px-2">
          <option value="bloqueo">Bloqueo</option>
          <option value="sistema">Sistema</option>
        </select>
        <Input name="detalle" placeholder="Detalle del ticket" className="max-w-xl" />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Enviando…" : "Levantar ticket"}
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-red-600">Error al cargar tickets.</p>}

      {!isLoading && !isError && (
        <ul className="divide-y">
          {items.map((t) => (
            <li key={t.id} className="py-2 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium mr-2">#{t.id}</span>
                <span className="mr-2">[{t.tipo}]</span>
                <span className="mr-2">{t.detalle}</span>
                <span className={t.estado === "abierto" ? "text-amber-600" : "text-green-600"}>{t.estado}</span>
              </div>
              {t.estado === "abierto" && (
                <Button size="sm" variant="outline" onClick={() => close.mutate(t.id)} disabled={close.isPending}>
                  Cerrar
                </Button>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground py-2">Sin tickets</li>}
        </ul>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Agendamiento</h1>

      <div className="grid gap-4">
        <section className="border rounded p-3">
          <h2 className="font-medium mb-2">Reasignación rápida de boxes</h2>
          <BoxesBoard />
        </section>

        <section className="border rounded p-3">
          <h2 className="font-medium mb-2">Boxes</h2>
          <TablaBoxes />
        </section>

        <section className="border rounded p-3">
          <h2 className="font-medium mb-2">Nuevo bloqueo</h2>
          <FormBloqueo />
        </section>

        <section className="border rounded p-3">
          <h2 className="font-medium mb-2">Tickets</h2>
          <Tickets />
        </section>
      </div>
    </AppShell>
  )
}
