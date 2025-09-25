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

type Box = { id:number; piso:number; especialidad:string; estado:string }

function TablaBoxes() {
  const [estado, setEstado] = useState("")
  const [esp, setEsp] = useState("")
  const [piso, setPiso] = useState("")

  const qs = new URLSearchParams()
  if (estado) qs.set("estado", estado)
  if (esp) qs.set("especialidad", esp)
  if (piso) qs.set("piso", piso)

  const { data = [] } = useQuery<Box[]>({
    queryKey:["boxes", estado, esp, piso],
    queryFn:()=>fetch(`/api/boxes${qs.toString() ? `?${qs}` : ""}`).then(r=>r.json()),
  })

  const columns: ColumnDef<Box, any>[] = [
    { header:"Box", accessorKey:"id" },
    { header:"Piso", accessorKey:"piso" },
    { header:"Especialidad", accessorKey:"especialidad" },
    { header:"Estado", accessorKey:"estado" },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="estado: disponible/bloqueado" value={estado} onChange={e=>setEstado(e.target.value)} className="max-w-xs"/>
        <Input placeholder="especialidad" value={esp} onChange={e=>setEsp(e.target.value)} className="max-w-xs"/>
        <Input placeholder="piso" value={piso} onChange={e=>setPiso(e.target.value)} className="max-w-[120px]"/>
        <Button variant="outline" onClick={()=>exportCsv("boxes_filtrados", data)}>Exportar CSV</Button>
      </div>
      <DataTable columns={columns} data={data}/>
    </div>
  )
}

function FormBloqueo() {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<{box:number; fecha:string; motivo:string}>()
  const mut = useMutation({
    mutationFn: (d:{box:number; fecha:string; motivo:string}) =>
      fetch("/api/bloqueos",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(d) }).then(r=>r.json()),
    onSuccess: () => { toast.success("Bloqueo creado"); qc.invalidateQueries({queryKey:["bloqueos"]}); reset() }
  })
  return (
    <form onSubmit={handleSubmit(d=>mut.mutate({...d, box:Number(d.box)}))} className="grid sm:grid-cols-3 gap-3">
      <div><Label>Box</Label><Input type="number" {...register("box",{valueAsNumber:true})}/></div>
      <div><Label>Fecha</Label><Input type="date" {...register("fecha")}/></div>
      <div><Label>Motivo</Label><Input {...register("motivo")}/></div>
      <div className="sm:col-span-3"><Button type="submit">Crear bloqueo</Button></div>
    </form>
  )
}

export default function Page(){
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
</div>


    </AppShell>
  )
}
