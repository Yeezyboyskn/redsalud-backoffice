"use client"
import AppShell from "@/components/common/AppShell"
import DataTable from "@/components/common/DataTable"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { exportCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"

type Doctor = { id:number; rut:string; nombre:string; especialidad:string; piso:number; boxes:number[] }
type KPI = { piso:number; ocupacion:number }

function TablaMedicos() {
  const [esp, setEsp] = useState("")
  const { data = [] } = useQuery<Doctor[]>({
    queryKey:["doctors", esp],
    queryFn:()=>fetch(`/api/doctors${esp ? `?especialidad=${encodeURIComponent(esp)}`:""}`).then(r=>r.json())
  })
  const columns: ColumnDef<Doctor, any>[] = [
    { header:"Nombre", accessorKey:"nombre" },
    { header:"RUT", accessorKey:"rut" },
    { header:"Especialidad", accessorKey:"especialidad" },
    { header:"Piso", accessorKey:"piso" },
    { header:"Boxes", cell: ({ row }) => row.original.boxes.join(", ") },
  ]
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Input placeholder="Filtrar por especialidad" value={esp} onChange={e=>setEsp(e.target.value)} className="max-w-xs"/>
        <Button variant="outline" onClick={()=>exportCsv("medicos", data)}>Exportar CSV</Button>
      </div>
      <DataTable columns={columns} data={data}/>
    </div>
  )
}

function GraficoOcupacion() {
  const { data = [] } = useQuery<KPI[]>({ queryKey:["kpi","ocupacion"], queryFn:()=>fetch("/api/kpis/ocupacion").then(r=>r.json()) })
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="piso" />
          <YAxis domain={[0,100]} />
          <Tooltip />
          <Bar dataKey="ocupacion" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Page(){
  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Jefatura</h1>
      <section className="border rounded p-3 mb-4">
        <h2 className="font-medium mb-2">Ocupación por piso (%)</h2>
        <GraficoOcupacion/>
      </section>
      <section className="border rounded p-3">
        <h2 className="font-medium mb-2">Médicos</h2>
        <TablaMedicos/>
      </section>
    </AppShell>
  )
}
