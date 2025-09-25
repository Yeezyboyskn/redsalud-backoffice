"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"

export default function Page(){
  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-3">Admin</h1>
      <div className="grid gap-4">
        <Especialidades />
        <Pisos />
        <BoxesCat />
      </div>
    </AppShell>
  )
}

function Especialidades(){
  const qc = useQueryClient()
  const { data: items = [] } = useQuery<string[]>({
    queryKey:["especialidades"],
    queryFn:()=>fetch("/api/catalogos/especialidades").then(r=>r.json()),
  })
  const add = useMutation({
    mutationFn: (nombre:string) =>
      fetch("/api/catalogos/especialidades",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ nombre }) }),
    onSuccess: () => { toast.success("Agregada"); qc.invalidateQueries({ queryKey:["especialidades"] }) }
  })
  const del = useMutation({
    mutationFn: (nombre:string) => fetch(`/api/catalogos/especialidades/${encodeURIComponent(nombre)}`,{ method:"DELETE" }),
    onSuccess: () => { toast.success("Eliminada"); qc.invalidateQueries({ queryKey:["especialidades"] }) }
  })
  const [nombre,setNombre] = useState("")
  return (
    <section className="border rounded p-3">
      <h2 className="font-medium mb-2">Especialidades</h2>
      <form className="flex gap-2 mb-3" onSubmit={e=>{e.preventDefault(); if(nombre.trim()) add.mutate(nombre.trim()); setNombre("")}}>
        <Input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nueva especialidad" className="max-w-xs"/>
        <Button type="submit">Agregar</Button>
      </form>
      <ul className="space-y-2">
        {items.map(e=>(
          <li key={e} className="flex items-center justify-between border rounded px-3 py-2">
            <span>{e}</span>
            <Button variant="outline" size="sm" onClick={()=>del.mutate(e)}>Eliminar</Button>
          </li>
        ))}
        {items.length===0 && <li className="text-sm text-muted-foreground">Sin datos</li>}
      </ul>
    </section>
  )
}

function Pisos(){
  const qc = useQueryClient()
  const { data: items = [] } = useQuery<number[]>({
    queryKey:["pisos"],
    queryFn:()=>fetch("/api/catalogos/pisos").then(r=>r.json()),
  })
  const [piso,setPiso]=useState<string>("")
  const add = useMutation({
    mutationFn:(n:number)=>fetch("/api/catalogos/pisos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({piso:n})}),
    onSuccess:()=>{ toast.success("Piso agregado"); qc.invalidateQueries({queryKey:["pisos"]}) }
  })
  const del = useMutation({
    mutationFn:(n:number)=>fetch(`/api/catalogos/pisos/${n}`,{method:"DELETE"}),
    onSuccess:()=>{ toast.success("Piso eliminado"); qc.invalidateQueries({queryKey:["pisos"]}) }
  })
  return (
    <section className="border rounded p-3">
      <h2 className="font-medium mb-2">Pisos</h2>
      <form className="flex gap-2 mb-3" onSubmit={e=>{e.preventDefault(); const n=Number(piso); if(n>0) add.mutate(n); setPiso("")}}>
        <Input value={piso} onChange={e=>setPiso(e.target.value)} placeholder="Nuevo piso (número)" className="max-w-xs"/>
        <Button type="submit">Agregar</Button>
      </form>
      <ul className="space-y-2">
        {items.map(p=>(
          <li key={p} className="flex items-center justify-between border rounded px-3 py-2">
            <span>Piso {p}</span>
            <Button variant="outline" size="sm" onClick={()=>del.mutate(p)}>Eliminar</Button>
          </li>
        ))}
        {items.length===0 && <li className="text-sm text-muted-foreground">Sin datos</li>}
      </ul>
    </section>
  )
}

type BoxRow = { id:number; piso:number; especialidad:string; estado:"disponible"|"bloqueado" }

function BoxesCat(){
  const qc = useQueryClient()
  const { data: items = [] } = useQuery<BoxRow[]>({
    queryKey:["boxes-cat"],
    queryFn:()=>fetch("/api/catalogos/boxes").then(r=>r.json()),
  })
  const [id,setId]=useState(""); const [piso,setPiso]=useState(""); const [esp,setEsp]=useState(""); const [estado,setEstado]=useState<"disponible"|"bloqueado">("disponible")
  const add = useMutation({
    mutationFn:(row:BoxRow)=>fetch("/api/catalogos/boxes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(row)}),
    onSuccess:()=>{ toast.success("Box agregado"); qc.invalidateQueries({queryKey:["boxes-cat"]}); setId(""); setPiso(""); setEsp(""); setEstado("disponible") }
  })
  const del = useMutation({
    mutationFn:(id:number)=>fetch(`/api/catalogos/boxes/${id}`,{method:"DELETE"}),
    onSuccess:()=>{ toast.success("Box eliminado"); qc.invalidateQueries({queryKey:["boxes-cat"]}) }
  })
  return (
    <section className="border rounded p-3">
      <h2 className="font-medium mb-2">Boxes</h2>
      <form className="grid sm:grid-cols-5 gap-2 mb-3" onSubmit={e=>{e.preventDefault()
        const row:BoxRow={ id:Number(id), piso:Number(piso), especialidad:esp.trim(), estado }
        if(!row.id || !row.piso || !row.especialidad) return
        add.mutate(row)
      }}>
        <Input placeholder="ID" value={id} onChange={e=>setId(e.target.value)}/>
        <Input placeholder="Piso" value={piso} onChange={e=>setPiso(e.target.value)}/>
        <Input placeholder="Especialidad" value={esp} onChange={e=>setEsp(e.target.value)}/>
        <select className="border rounded h-10 px-2" value={estado} onChange={e=>setEstado(e.target.value as any)}>
          <option value="disponible">disponible</option>
          <option value="bloqueado">bloqueado</option>
        </select>
        <Button type="submit">Agregar</Button>
      </form>
      <ul className="space-y-2">
        {items.map(b=>(
          <li key={b.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
            <span>Box {b.id} · Piso {b.piso} · {b.especialidad} · {b.estado}</span>
            <Button variant="outline" size="sm" onClick={()=>del.mutate(b.id)}>Eliminar</Button>
          </li>
        ))}
        {items.length===0 && <li className="text-sm text-muted-foreground">Sin datos</li>}
      </ul>
    </section>
  )
}
