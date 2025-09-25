"use client"

import AppShell from "@/components/common/AppShell"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { Resolver } from "react-hook-form"

/* ============ hooks genéricos ============ */
function useCatalogo<T>(key: string, url: string) {
  const qc = useQueryClient()
  const list = useQuery<T[]>({ queryKey: [key], queryFn: () => fetch(url).then(r => r.json()) })
  const add = useMutation({
    mutationFn: (value: T) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
  const del = useMutation({
    mutationFn: (value: T) => fetch(`${url}/${value}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
  return { list, add, del }
}

/* ============ sección BOXES ============ */
type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }

const boxSchema = z.object({
  id: z.coerce.number().int().positive({ message: "ID inválido" }),
  piso: z.coerce.number().int().positive({ message: "Piso inválido" }),
  especialidad: z.string().min(1, "Requerido"),
  estado: z.enum(["disponible", "bloqueado"]).default("disponible"),
})

function useBoxes() {
  const qc = useQueryClient()
  const list = useQuery<Box[]>({ queryKey: ["boxes-admin"], queryFn: () => fetch("/api/catalogos/boxes").then(r => r.json()) })
  const create = useMutation({
    mutationFn: (payload: z.infer<typeof boxSchema>) =>
      fetch("/api/catalogos/boxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(async r => {
          if (!r.ok) throw new Error((await r.json()).message || "Error")
          return r.json()
        }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boxes-admin"] }); toast.success("Box creado") },
    onError: (e: any) => toast.error(String(e.message || e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/catalogos/boxes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boxes-admin"] }); toast.success("Box eliminado") },
  })
  return { list, create, remove }
}

function BoxesSection() {
  const boxes = useBoxes()
  const esp = useCatalogo<string>("cat-especialidades", "/api/catalogos/especialidades")
  const pis = useCatalogo<number>("cat-pisos", "/api/catalogos/pisos")

  const { register, handleSubmit, reset, formState: { errors } } =
  useForm<z.infer<typeof boxSchema>>({
    resolver: zodResolver(boxSchema) as Resolver<z.infer<typeof boxSchema>>,
    defaultValues: { estado: "disponible" } as Partial<z.infer<typeof boxSchema>>,
  })
  const onSubmit = handleSubmit((data: z.infer<typeof boxSchema>) => {
    // validaciones cliente: colisión de ID, piso/especialidad existentes
    const current = boxes.list.data || []
    if (current.some(b => b.id === data.id)) {
      toast.error("El ID de box ya existe")
      return
    }
    if (!(pis.list.data || []).includes(data.piso)) {
      toast.error("Piso no existe en catálogo")
      return
    }
    if (!(esp.list.data || []).includes(data.especialidad)) {
      toast.error("Especialidad no existe en catálogo")
      return
    }
    boxes.create.mutate(data)
    reset({ estado: "disponible" })
  })

  return (
    <section className="border rounded p-4">
      <h2 className="font-medium mb-2">Boxes</h2>

      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5 mb-4">
        <div>
          <Label>ID</Label>
        <Input type="number" {...register("id", { valueAsNumber: true })} />          {errors.id && <p className="text-xs text-red-600">{errors.id.message}</p>}
        </div>
        <div>
          <Label>Piso</Label>
          <select className="border rounded h-10 px-2 w-full" {...register("piso", { valueAsNumber: true })}>
            <option value="">--</option>
            {(pis.list.data || []).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {errors.piso && <p className="text-xs text-red-600">{errors.piso.message}</p>}
        </div>
        <div className="md:col-span-2">
          <Label>Especialidad</Label>
          <select className="border rounded h-10 px-2 w-full" {...register("especialidad")}>
            <option value="">--</option>
            {(esp.list.data || []).map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {errors.especialidad && <p className="text-xs text-red-600">{errors.especialidad.message}</p>}
        </div>
        <div>
          <Label>Estado</Label>
          <select className="border rounded h-10 px-2 w-full" {...register("estado")}>
            <option value="disponible">disponible</option>
            <option value="bloqueado">bloqueado</option>
          </select>
        </div>
        <div className="md:col-span-5">
          <Button type="submit">Crear box</Button>
        </div>
      </form>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-2">ID</th>
              <th className="text-left py-2 pr-2">Piso</th>
              <th className="text-left py-2 pr-2">Especialidad</th>
              <th className="text-left py-2 pr-2">Estado</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(boxes.list.data || []).map(b => (
              <tr key={b.id} className="border-b">
                <td className="py-2 pr-2">{b.id}</td>
                <td className="py-2 pr-2">{b.piso}</td>
                <td className="py-2 pr-2">{b.especialidad}</td>
                <td className="py-2 pr-2">{b.estado}</td>
                <td className="py-2">
                  <Button variant="outline" size="sm" onClick={() => boxes.remove.mutate(b.id)}>Eliminar</Button>
                </td>
              </tr>
            ))}
            {!(boxes.list.data || []).length && (
              <tr><td colSpan={5} className="py-3 text-muted-foreground">Sin boxes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ============ chips reutilizables ============ */
function TagList<T extends string | number>({ items, onDelete }: { items: T[]; onDelete: (v: T) => void }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Sin datos</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(v => (
        <span key={String(v)} className="inline-flex items-center gap-2 border rounded px-2 py-1 text-sm">
          {String(v)}
          <button onClick={() => onDelete(v)} className="text-red-600 hover:underline">x</button>
        </span>
      ))}
    </div>
  )
}

/* ============ pantalla completa ============ */
export default function Page() {
  const esp = useCatalogo<string>("cat-especialidades", "/api/catalogos/especialidades")
  const pis = useCatalogo<number>("cat-pisos", "/api/catalogos/pisos")

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
              const v = String(new FormData(form).get("value") || "").trim()
              if (!v) return
              await esp.add.mutateAsync(v)
              toast.success("Agregado")
              form.reset()
            }}
          >
            <div className="flex-1">
              <Label className="sr-only">Nueva especialidad</Label>
              <Input name="value" placeholder="Ej. Neuro, Trauma, ..." />
            </div>
            <Button type="submit">Agregar</Button>
          </form>
          <TagList items={esp.list.data || []} onDelete={(v) => esp.del.mutate(v)} />
        </section>

        {/* Pisos */}
        <section className="border rounded p-4">
          <h2 className="font-medium mb-2">Pisos</h2>
          <form
            className="flex gap-2 mb-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget as HTMLFormElement
              const n = Number(new FormData(form).get("value"))
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
          <TagList items={pis.list.data || []} onDelete={(v) => pis.del.mutate(v)} />
        </section>
      </div>

      <div className="mt-4">
        <BoxesSection />
      </div>
    </AppShell>
  )
}
