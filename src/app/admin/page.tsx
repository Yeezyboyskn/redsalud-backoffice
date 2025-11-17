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

/* ============ hooks genericos ============ */
function useCatalogo<T>(key: string, url: string) {
  const qc = useQueryClient()
  const list = useQuery<T[]>({ queryKey: [key], queryFn: () => fetch(url).then((r) => r.json()) })
  const add = useMutation({
    mutationFn: (value: T) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
  const del = useMutation({
    mutationFn: (value: T) => fetch(`${url}/${value}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
  })
  return { list, add, del }
}

/* ============ seccion BOXES ============ */
type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }

const boxSchema = z.object({
  id: z.coerce.number().int().positive({ message: "ID invalido" }),
  piso: z.coerce.number().int().positive({ message: "Piso invalido" }),
  especialidad: z.string().min(1, "Requerido"),
  estado: z.enum(["disponible", "bloqueado"]).default("disponible"),
})

function useBoxes() {
  const qc = useQueryClient()
  const list = useQuery<Box[]>({ queryKey: ["boxes-admin"], queryFn: () => fetch("/api/catalogos/boxes").then((r) => r.json()) })
  const create = useMutation({
    mutationFn: (payload: z.infer<typeof boxSchema>) =>
      fetch("/api/catalogos/boxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message || "Error")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxes-admin"] })
      toast.success("Box creado")
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error ?? "")
      toast.error(message)
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/catalogos/boxes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxes-admin"] })
      toast.success("Box eliminado")
    },
  })
  return { list, create, remove }
}

function BoxesSection() {
  const boxes = useBoxes()
  const esp = useCatalogo<string>("cat-especialidades", "/api/catalogos/especialidades")
  const pis = useCatalogo<number>("cat-pisos", "/api/catalogos/pisos")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof boxSchema>>({
    resolver: zodResolver(boxSchema) as Resolver<z.infer<typeof boxSchema>>,
    defaultValues: { estado: "disponible" } as Partial<z.infer<typeof boxSchema>>,
  })

  const onSubmit = handleSubmit((data: z.infer<typeof boxSchema>) => {
    const current = boxes.list.data || []
    if (current.some((b) => b.id === data.id)) {
      toast.error("El ID de box ya existe")
      return
    }
    if (!(pis.list.data || []).includes(data.piso)) {
      toast.error("El piso no existe en el catalogo")
      return
    }
    if (!(esp.list.data || []).includes(data.especialidad)) {
      toast.error("La especialidad no existe en el catalogo")
      return
    }
    boxes.create.mutate(data)
    reset({ estado: "disponible" })
  })

  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-secondary">Boxes</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/60">
          {(boxes.list.data || []).length} registros
        </span>
      </div>

      <form onSubmit={onSubmit} className="mb-5 grid gap-4 rounded-xl border border-border/60 bg-white/80 p-4 shadow-inner shadow-primary/5 md:grid-cols-5">
        <div className="space-y-2">
          <Label>ID</Label>
          <Input type="number" {...register("id", { valueAsNumber: true })} placeholder="Ej. 301" />
          {errors.id && <p className="text-xs text-destructive">{errors.id.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Piso</Label>
          <select
            className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
            {...register("piso", { valueAsNumber: true })}
          >
            <option value="">Selecciona</option>
            {(pis.list.data || []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.piso && <p className="text-xs text-destructive">{errors.piso.message}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Especialidad</Label>
          <select
            className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
            {...register("especialidad")}
          >
            <option value="">Selecciona</option>
            {(esp.list.data || []).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          {errors.especialidad && <p className="text-xs text-destructive">{errors.especialidad.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <select
            className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
            {...register("estado")}
          >
            <option value="disponible">disponible</option>
            <option value="bloqueado">bloqueado</option>
          </select>
        </div>
        <div className="md:col-span-5">
          <Button type="submit" className="w-full md:w-auto">
            Crear box
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/80 shadow-sm shadow-primary/5">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-secondary/80">
            <tr className="border-b border-border/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Piso</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Especialidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(boxes.list.data || []).map((b) => (
              <tr key={b.id} className="border-b border-border/40 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-secondary">{b.id}</td>
                <td className="px-4 py-3 text-secondary/80">{b.piso}</td>
                <td className="px-4 py-3 text-secondary/80">{b.especialidad}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    {b.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => boxes.remove.mutate(b.id)}>
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
            {!(boxes.list.data || []).length && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted-foreground">
                  Aun no hay boxes registrados.
                </td>
              </tr>
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
      {items.map((v) => (
        <span
          key={String(v)}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-1 text-xs font-semibold text-secondary/80 shadow-sm shadow-primary/5"
        >
          {String(v)}
          <button
            onClick={() => onDelete(v)}
            className="text-destructive transition hover:scale-105"
            type="button"
          >
            x?
          </button>
        </span>
      ))}
    </div>
  )
}

function SpecialtyFloorsSection() {
  const { data = [], isLoading } = useQuery<{ especialidad: string; pisos: (number|string)[] }[]>({
    queryKey: ['specialty-floors'],
    queryFn: () => fetch('/api/catalogos/specialty-floors').then(r => r.json()),
  })
  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-secondary">Pisos por especialidad</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/60">{isLoading ? '...' : data.length + ' registros'}</span>
      </div>
      <div className="overflow-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-secondary/80">
            <tr className="border-b border-border/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Especialidad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Pisos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.especialidad} className="border-b border-border/40 last:border-b-0">
                <td className="px-4 py-3 font-semibold text-secondary">{row.especialidad}</td>
                <td className="px-4 py-3 text-secondary/80">{row.pisos.join(', ')}</td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-sm text-muted-foreground">Sin datos cargados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
/* ============ pantalla completa ============ */
export default function Page() {
  const esp = useCatalogo<string>("cat-especialidades", "/api/catalogos/especialidades")
  const pis = useCatalogo<number>("cat-pisos", "/api/catalogos/pisos")

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Administrador</span>
            <h1 className="text-3xl font-semibold text-secondary">Catalogos maestros RedSalud</h1>
            <p className="text-sm text-muted-foreground">
              Manten actualizados los catalogos base para asegurar una experiencia consistente en toda la red.
            </p>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Especialidades</h2>
            <form
              className="mb-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget as HTMLFormElement
                const v = String(new FormData(form).get("value") || "").trim()
                if (!v) return
                await esp.add.mutateAsync(v)
                toast.success("Especialidad agregada")
                form.reset()
              }}
            >
              <div className="flex-1">
                <Label className="sr-only">Nueva especialidad</Label>
                <Input name="value" placeholder="Ej. Neurocirugia, Traumatologia" />
              </div>
              <Button type="submit">Agregar</Button>
            </form>
            <TagList items={esp.list.data || []} onDelete={(v) => esp.del.mutate(v)} />
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Pisos</h2>
            <form
              className="mb-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget as HTMLFormElement
                const n = Number(new FormData(form).get("value"))
                if (!Number.isFinite(n)) return
                await pis.add.mutateAsync(n)
                toast.success("Piso agregado")
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

        <SpecialtyFloorsSection />
        <BoxesSection />
      </div>
    </AppShell>
  )
}





