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

type Doctor = { id:number; rut:string; nombre:string; especialidad:string; piso:number; boxes:number[] }
type Box = { id:number; piso:number; especialidad:string; estado:"disponible"|"bloqueado" }
type Bloqueo = { id:string; box:number; fecha:string; motivo:string; creadoPor:string }
type KPIDoc = { semana:{dia:string; ocupacion:number}[]; proximos:{fecha:string; box:number}[] }

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
    queryFn: () => fetch(`/api/doctors?rut=${encodeURIComponent(rut)}`).then(r => r.json()),
    enabled: !!rut,
  })

  const { data: allBoxes = [] } = useQuery<Box[]>({
    queryKey: ["boxes"],
    queryFn: () => fetch("/api/boxes").then(r => r.json()),
  })

  const { data: bloqueos = [] } = useQuery<Bloqueo[]>({
    queryKey: ["bloqueos"],
    queryFn: () => fetch("/api/bloqueos").then(r => r.json()),
  })

  const { data: kpi = { semana:[], proximos:[] } } = useQuery<KPIDoc>({
    queryKey:["kpi-doc", rut],
    queryFn:()=>fetch(`/api/kpis/doctor?rut=${encodeURIComponent(rut)}`).then(r=>r.json()),
    enabled: !!rut,
  })

  const misBoxes = useMemo(
    () => allBoxes.filter(b => me?.boxes.includes(b.id)),
    [allBoxes, me]
  )

  const columns: ColumnDef<Box, any>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Especialidad", accessorKey: "especialidad" },
    { header: "Estado", accessorKey: "estado" },
  ]

  if (!rut) {
    return (
      <AppShell>
        <h1 className="text-xl font-semibold mb-3">Doctor</h1>
        <p className="text-red-600">No se encontró el doctor. Regrese al login y verifique el RUT.</p>
      </AppShell>
    )
  }

  const misBloqueos = bloqueos.filter(b => me?.boxes.includes(b.box))

  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Doctor</h1>

      {me && (
        <section className="border rounded p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium mb-1">{me.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                {me.especialidad} · Piso {me.piso} · Boxes: {me.boxes.join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => exportCsv(`mis_boxes_${me.rut}`, misBoxes)}
              >
                Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportCsv(`mis_bloqueos_${me.rut}`, misBloqueos)}
              >
                Exportar bloqueos
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="border rounded p-3 mb-4">
        <h2 className="font-medium mb-2">Uso semanal (%)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpi.semana}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis domain={[0,100]} />
              <Tooltip />
              <Bar dataKey="ocupacion" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="border rounded p-3 mb-4">
        <h2 className="font-medium mb-2">Próximas disponibilidades</h2>
        <ul className="text-sm space-y-1">
          {kpi.proximos.map((p,i)=>(
            <li key={i} className="border rounded px-3 py-2 flex justify-between">
              <span>{p.fecha}</span>
              <span className="text-muted-foreground">Box {p.box}</span>
            </li>
          ))}
          {kpi.proximos.length===0 && <li className="text-muted-foreground">Sin datos</li>}
        </ul>
      </section>

      <section className="border rounded p-3">
        <h2 className="font-medium mb-2">Solicitar bloqueo rápido</h2>
        <FormBloqueo boxesIds={me?.boxes ?? []} onOk={() => qc.invalidateQueries({ queryKey: ["bloqueos"] })} />
        <h3 className="font-medium mt-4 mb-2 text-sm">Bloqueos vigentes</h3>
        <ul className="text-sm space-y-1">
          {misBloqueos.map(b => (
            <li key={b.id} className="flex justify-between border rounded px-3 py-2">
              <span>Box {b.box} · {b.fecha} · {b.motivo}</span>
              <span className="text-muted-foreground">{b.creadoPor}</span>
            </li>
          ))}
          {misBloqueos.length === 0 && <li className="text-muted-foreground">Sin bloqueos</li>}
        </ul>
      </section>
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
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success("Solicitud enviada")
      reset()
      onOk()
    },
  })

  return (
    <form
      onSubmit={handleSubmit(d => {
        if (!d.box || !d.fecha || !d.motivo?.trim()) return toast.error("Complete los campos")
        mut.mutate({ ...d, box: Number(d.box) })
      })}
      className="grid sm:grid-cols-3 gap-3"
    >
      <div>
        <Label>Box</Label>
        <select className="border rounded h-10 px-2 w-full" {...register("box", { valueAsNumber: true })}>
          <option value="">Seleccione</option>
          {boxesIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Fecha</Label>
        <Input type="date" {...register("fecha")} />
      </div>
      <div>
        <Label>Motivo</Label>
        <Input {...register("motivo")} placeholder="Ej. congreso, reposo, mantención" />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? "Enviando…" : "Solicitar bloqueo"}
        </Button>
      </div>
    </form>
  )
}
