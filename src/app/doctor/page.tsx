"use client"

import AppShell from "@/components/common/AppShell"
import DataTable from "@/components/common/DataTable"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { getCookie } from "@/lib/cookies"

type Doctor = { id:number; rut:string; nombre:string; especialidad:string; piso:number; boxes:number[] }
type Box = { id:number; piso:number; especialidad:string; estado:string }
type Bloqueo = { id:string; box:number; fecha:string; motivo:string; creadoPor:string }

function FichaDoctor({ d }: { d: Doctor }) {
  return (
    <div className="border rounded p-3 mb-4">
      <div className="font-medium">{d.nombre}</div>
      <div className="text-sm text-muted-foreground">RUT {d.rut} • Esp. {d.especialidad} • Piso {d.piso} • Boxes {d.boxes.join(", ")}</div>
    </div>
  )
}

function BoxesPorEspecialidad({ esp }: { esp: string }) {
  const { data = [] } = useQuery<Box[]>({
    queryKey: ["boxes", "esp", esp],
    queryFn: () => fetch(`/api/boxes?especialidad=${encodeURIComponent(esp)}`).then(r=>r.json()),
  })
  const columns: ColumnDef<Box, any>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Estado", accessorKey: "estado" },
  ]
  return <DataTable columns={columns} data={data} />
}

function BoxesDisponibles() {
  const { data = [] } = useQuery<Box[]>({
    queryKey: ["boxes", "disponible"],
    queryFn: () => fetch("/api/boxes?estado=disponible").then((r) => r.json()),
  })
  const columns: ColumnDef<Box, any>[] = [
    { header: "Box", accessorKey: "id" },
    { header: "Piso", accessorKey: "piso" },
    { header: "Especialidad", accessorKey: "especialidad" },
  ]
  return <DataTable columns={columns} data={data} />
}

function Bloqueos() {
  const { data = [] } = useQuery<Bloqueo[]>({
    queryKey: ["bloqueos"],
    queryFn: () => fetch("/api/bloqueos").then((r) => r.json()),
  })
  const columns: ColumnDef<Bloqueo, any>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "Box", accessorKey: "box" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Motivo", accessorKey: "motivo" },
  ]
  return <DataTable columns={columns} data={data} />
}

export default function Page() {
  const rut = getCookie("rut")
  const { data: doctor } = useQuery<Doctor | null>({
    enabled: !!rut,
    queryKey: ["doctor", rut],
    queryFn: () => fetch(`/api/doctors?rut=${rut}`).then(r=>r.json()),
  })

  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Doctor</h1>
      {!doctor ? (
        <div className="text-sm text-red-600">No se encontró el doctor. Regrese al login y verifique el RUT.</div>
      ) : (
        <>
          <FichaDoctor d={doctor} />
          <div className="grid md:grid-cols-3 gap-4">
            <section className="border rounded p-3">
              <h2 className="font-medium mb-2">Boxes por especialidad ({doctor.especialidad})</h2>
              <BoxesPorEspecialidad esp={doctor.especialidad} />
            </section>
            <section className="border rounded p-3 md:col-span-1">
              <h2 className="font-medium mb-2">Boxes disponibles</h2>
              <BoxesDisponibles />
            </section>
            <section className="border rounded p-3 md:col-span-1">
              <h2 className="font-medium mb-2">Bloqueos de box</h2>
              <Bloqueos />
            </section>
          </div>
        </>
      )}
    </AppShell>
  )
}
