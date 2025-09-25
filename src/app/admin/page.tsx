"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

function useCatalogo<T>(key:string, url:string) {
  const qc = useQueryClient()
  const list = useQuery<T[]>({ queryKey:[key], queryFn:()=>fetch(url).then(r=>r.json()) })
  const add = useMutation({
    mutationFn:(value:T)=>fetch(url,{method:"POST",headers:{ "Content-Type":"application/json"},body:JSON.stringify({value})}),
    onSuccess:()=>qc.invalidateQueries({queryKey:[key]}),
  })
  const del = useMutation({
    mutationFn:(value:T)=>fetch(`${url}/${value}`,{method:"DELETE"}),
    onSuccess:()=>qc.invalidateQueries({queryKey:[key]}),
  })
  return { list, add, del }
}

function TagList<T extends string|number>({ items, onDelete }:{items:T[]; onDelete:(v:T)=>void}) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Sin datos</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(v=>(
        <span key={String(v)} className="inline-flex items-center gap-2 border rounded px-2 py-1 text-sm">
          {String(v)}
          <button onClick={()=>onDelete(v)} className="text-red-600 hover:underline">x</button>
        </span>
      ))}
    </div>
  )
}

export default function Page(){
  const esp = useCatalogo<string>("cat-especialidades","/api/catalogos/especialidades")
  const pis = useCatalogo<number>("cat-pisos","/api/catalogos/pisos")

  return (
    <AppShell>
      <h1 className="text-xl font-semibold mb-4">Administrador de catálogos</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Especialidades */}
        <section className="border rounded p-4">
          <h2 className="font-medium mb-2">Especialidades</h2>
          <form
  className="flex gap-2 mb-3"
  onSubmit={async (e) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const v = String(fd.get("value") || "").trim()
    if (!v) return
    await esp.add.mutateAsync(v)
    toast.success("Agregado")
    form.reset()
  }}
>
            <div className="flex-1">
              <Label className="sr-only">Nueva especialidad</Label>
              <Input name="value" placeholder="Ej. Neuro, Trauma,..." />
            </div>
            <Button type="submit">Agregar</Button>
          </form>
          <TagList items={esp.list.data||[]} onDelete={(v)=>esp.del.mutate(v)} />
        </section>

        {/* Pisos */}
        <section className="border rounded p-4">
          <h2 className="font-medium mb-2">Pisos</h2>
          <form
  className="flex gap-2 mb-3"
  onSubmit={async (e) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const n = Number(fd.get("value"))
    if (!Number.isFinite(n)) return
    await pis.add.mutateAsync(n)
    toast.success("Agregado")
    form.reset()
  }}
>
            <div className="flex-1">
              <Label className="sr-only">Nuevo piso</Label>
              <Input name="value" type="number" placeholder="Ej. 3" />
            </div>
            <Button type="submit">Agregar</Button>
          </form>
          <TagList items={pis.list.data||[]} onDelete={(v)=>pis.del.mutate(v)} />
        </section>
      </div>
    </AppShell>
  )
}
