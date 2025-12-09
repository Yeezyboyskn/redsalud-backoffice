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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { es } from "date-fns/locale"

type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }
type Ticket = { id: string; tipo: "bloqueo" | "sistema"; detalle: string; estado: "abierto" | "cerrado"; creadoPor: string }
type BlockRq = { id: string; rut: string; fecha: string; inicio: string; fin: string; motivo: string; boxId?: number; estado: "pendiente" | "aprobado" | "rechazado"; doctorNombre?: string; especialidad?: string; createdAt?: string }
type Extra = { id: string; fecha: string; inicio: string; fin: string; boxId?: number | null; especialidad?: string | null; audience?: string | null }
type SpecialRq = { id: string; doctor_rut: string; doctorNombre?: string; especialidad?: string; tipo: string; detalle: string; estado: "pendiente" | "aprobado" | "rechazado"; fecha_solicitada?: string | null; horario_actual?: string | null; horario_solicitado?: string | null; boxId?: number | null; createdAt?: string; respuesta?: string | null }

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
      {isError && <p className="text-sm text-destructive">Ocurrió un problema al cargar los boxes.</p>}
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

function ObservacionRapida() {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (detalle: string) =>
      fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "bloqueo", detalle: `[Observación agendamiento] ${detalle}` }),
      }).then((r) => {
        if (!r.ok) throw new Error("No se pudo enviar la observación")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      toast.success("Observación enviada")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ventana de observación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-secondary/70">Envía solicitudes cuando no hay disponibilidad. Se alinea con el flujo de bloqueos y el panel del doctor.</p>
        <Textarea
          id="observacion-ag"
          placeholder="Ej: Solicitar desbloqueo puntual para Dr. Silva el 12/03 de 10:00 a 11:00 o reasignar box a otra especialidad."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              const value = (e.currentTarget as HTMLTextAreaElement).value
              if (!value.trim()) return
              mut.mutate(value)
              ;(e.currentTarget as HTMLTextAreaElement).value = ""
            }
          }}
        />
        <div className="flex items-center gap-2 text-[11px] text-secondary/70">
          <span>Tip: Ctrl/Cmd + Enter para enviar</span>
          {mut.isPending && <span className="text-secondary">Enviando...</span>}
        </div>
        <Button
          className="w-full"
          disabled={mut.isPending}
          onClick={() => {
            const el = document.querySelector<HTMLTextAreaElement>("#observacion-ag")
            const value = el?.value || ""
            if (!value.trim()) return
            mut.mutate(value)
            if (el) el.value = ""
          }}
        >
          Enviar observación
        </Button>
      </CardContent>
    </Card>
  )
}

function SolicitudesBloqueo() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, isError } = useQuery<BlockRq[]>({
    queryKey: ["agendamiento-block-requests"],
    queryFn: () => fetch("/api/agendamiento/block-requests").then((r) => r.json().then((d) => d.items ?? [])),
    refetchInterval: 10000,
  })

  const updateEstado = useMutation({
    mutationFn: (payload: { id: string; estado: "aprobado" | "rechazado" }) =>
      fetch("/api/agendamiento/block-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error("No se pudo actualizar")
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agendamiento-block-requests"] }),
  })

  const estadoBadge = (estado: BlockRq["estado"]) => {
    if (estado === "aprobado") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aprobado</Badge>
    if (estado === "rechazado") return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Rechazado</Badge>
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Solicitudes de bloqueo y horas extra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>}
        {isError && <p className="text-sm text-destructive">No pudimos cargar las solicitudes.</p>}
        {!isLoading && !isError && (
          <div className="space-y-2">
            {items.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm shadow-sm">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{b.doctorNombre || "Doctor"}</span>
                    <span className="text-xs text-secondary/70">{b.especialidad}</span>
                    {estadoBadge(b.estado)}
                  </div>
                  <div className="text-xs text-secondary/80">
                    {b.fecha} · {b.inicio} - {b.fin} · {b.motivo} · {b.boxId ? `Box ${b.boxId}` : "Box sin asignar"}
                  </div>
                  <div className="text-[11px] text-secondary/60">RUT {b.rut} · Creado {b.createdAt ? new Date(b.createdAt).toLocaleString() : ""}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={b.estado !== "pendiente" || updateEstado.isPending} onClick={() => updateEstado.mutate({ id: b.id, estado: "rechazado" })}>
                    Rechazar
                  </Button>
                  <Button size="sm" disabled={b.estado !== "pendiente" || updateEstado.isPending} onClick={() => updateEstado.mutate({ id: b.id, estado: "aprobado" })}>
                    Aprobar
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes registradas.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SolicitudesEspeciales() {
  const qc = useQueryClient()
  const [respuesta, setRespuesta] = useState<Record<string, string>>({})
  const { data: items = [], isLoading, isError } = useQuery<SpecialRq[]>({
    queryKey: ["agendamiento-special-requests"],
    queryFn: () => fetch("/api/agendamiento/special-requests").then((r) => r.json().then((d) => d.items ?? [])),
    refetchInterval: 10000,
  })

  const updateEstado = useMutation({
    mutationFn: (payload: { id: string; estado: "aprobado" | "rechazado"; respuesta?: string }) =>
      fetch("/api/doctor/special-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error("No se pudo actualizar")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamiento-special-requests"] })
      qc.invalidateQueries({ queryKey: ["doctor-special-requests"] })
      toast.success("Solicitud actualizada")
      setRespuesta({})
    },
    onError: () => toast.error("Error al actualizar"),
  })

  const estadoBadge = (estado: SpecialRq["estado"]) => {
    if (estado === "aprobado") return <Badge className="bg-emerald-100 text-emerald-800">Aprobado</Badge>
    if (estado === "rechazado") return <Badge className="bg-rose-100 text-rose-800">Rechazado</Badge>
    return <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Solicitudes especiales de reajuste de horario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>}
        {isError && <p className="text-sm text-destructive">No pudimos cargar las solicitudes.</p>}
        {!isLoading && !isError && (
          <div className="space-y-3">
            {items.map((req) => (
              <div key={req.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{req.doctorNombre || "Doctor"}</span>
                    <span className="text-xs text-secondary/70">{req.especialidad}</span>
                    <span className="text-xs text-secondary/70">({req.tipo.replace(/_/g, " ")})</span>
                    {estadoBadge(req.estado)}
                  </div>
                </div>
                <p className="text-secondary/80">{req.detalle}</p>
                {req.fecha_solicitada && <p className="text-xs text-secondary/70">Fecha solicitada: {req.fecha_solicitada}</p>}
                {req.horario_actual && <p className="text-xs text-secondary/70">Horario actual: {req.horario_actual}</p>}
                {req.horario_solicitado && <p className="text-xs text-secondary/70">Horario solicitado: {req.horario_solicitado}</p>}
                {req.respuesta && (
                  <div className="rounded-lg border border-border/60 bg-secondary/5 px-3 py-2 text-xs">
                    <span className="font-semibold text-secondary/70">Respuesta:</span>
                    <p className="mt-1 text-secondary/80">{req.respuesta}</p>
                  </div>
                )}
                {req.estado === "pendiente" && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Agregar respuesta o comentario (opcional)"
                      value={respuesta[req.id] || ""}
                      onChange={(e) => setRespuesta({ ...respuesta, [req.id]: e.target.value })}
                      rows={2}
                      className="resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateEstado.isPending}
                        onClick={() => updateEstado.mutate({ id: req.id, estado: "rechazado", respuesta: respuesta[req.id] || undefined })}
                      >
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        disabled={updateEstado.isPending}
                        onClick={() => updateEstado.mutate({ id: req.id, estado: "aprobado", respuesta: respuesta[req.id] || undefined })}
                      >
                        Aprobar
                      </Button>
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-secondary/60">RUT {req.doctor_rut} · Creado {req.createdAt ? new Date(req.createdAt).toLocaleString() : ""}</div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes especiales registradas.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const { data: solicitudes = [] } = useQuery<BlockRq[]>({
    queryKey: ["agendamiento-block-requests-mini"],
    queryFn: () => fetch("/api/agendamiento/block-requests").then((r) => r.json().then((d) => d.items ?? [])),
  })
  const [fechaCursor, setFechaCursor] = useState<string>(() => format(new Date(), "yyyy-MM-dd"))
  const boxes = useQuery<Box[]>({
    queryKey: ["boxes"],
    queryFn: () => fetch("/api/boxes").then((r) => r.json()),
  })
  const bloqueosDelDia = useQuery<BlockRq[]>({
    queryKey: ["agendamiento-block-requests", fechaCursor],
    queryFn: () => fetch(`/api/agendamiento/block-requests?fecha=${fechaCursor}`).then((r) => r.json().then((d) => d.items ?? [])),
  })
  const extrasDelDia = useQuery<Extra[]>({
    queryKey: ["extras-dia", fechaCursor],
    queryFn: () => fetch(`/api/doctor/extra-hours?from=${fechaCursor}&to=${fechaCursor}&includeSpecialty=true`).then((r) => r.json().then((d) => d.items ?? [])),
  })

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length
  const aprobadas = solicitudes.filter((s) => s.estado === "aprobado").length
  const rechazadas = solicitudes.filter((s) => s.estado === "rechazado").length

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Agendamiento</span>
            <h1 className="text-3xl font-semibold text-secondary">Control integral de boxes</h1>
            <p className="text-sm text-muted-foreground">
              Optimiza la ocupación y gestiona solicitudes en tiempo real para toda la red RedSalud, alineada con el panel del doctor.
            </p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary">Bloqueos pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-amber-600">{pendientes}</p>
              <p className="text-xs text-secondary/70">Solicitudes en espera de revisión</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary">Bloqueos aprobados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-emerald-700">{aprobadas}</p>
              <p className="text-xs text-secondary/70">Liberan horas hacia médicos de la especialidad</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-secondary">Bloqueos rechazados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-rose-700">{rechazadas}</p>
              <p className="text-xs text-secondary/70">Con feedback para el médico</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-secondary">Radar de disponibilidad</h2>
                <p className="text-sm text-secondary/70">Todo se gestiona vía solicitudes. Visualiza bloqueados, libres y liberados para el día.</p>
              </div>
              <Input type="date" value={fechaCursor} onChange={(e) => setFechaCursor(e.target.value)} className="w-[180px]" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-secondary">Boxes libres</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-emerald-700">
                    {boxes.data && bloqueosDelDia.data ? boxes.data.filter((b) => !(bloqueosDelDia.data ?? []).some((bk) => bk.boxId === b.id && bk.estado !== "rechazado")).length : "..."}
                  </p>
                  <p className="text-xs text-secondary/70">Disponible para asignar vía solicitud</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-secondary">Boxes bloqueados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-amber-700">{(bloqueosDelDia.data ?? []).length}</p>
                  <p className="text-xs text-secondary/70">Solicitudes en el día</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-secondary">Horas liberadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-primary">{(extrasDelDia.data ?? []).length}</p>
                  <p className="text-xs text-secondary/70">Horas extra/recuperativas disponibles</p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-secondary">Detalle de bloqueos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(bloqueosDelDia.data ?? []).map((b) => (
                    <div key={b.id} className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-secondary">{b.inicio} - {b.fin}</span>
                        <Badge className={b.estado === "aprobado" ? "bg-emerald-100 text-emerald-800" : b.estado === "rechazado" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>
                          {b.estado}
                        </Badge>
                      </div>
                      <div className="text-xs text-secondary/70">
                        Box {b.boxId ?? "N/A"} · {b.motivo} · {b.doctorNombre || b.rut}
                      </div>
                    </div>
                  ))}
                  {(bloqueosDelDia.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin bloqueos en la fecha.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-secondary">Liberadas (horas extra)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(extrasDelDia.data ?? []).map((e) => (
                    <div key={e.id} className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-secondary">{e.inicio} - {e.fin}</span>
                        <span className="text-[11px] text-secondary/70">{e.especialidad || "Especialidad"}</span>
                      </div>
                      <div className="text-xs text-secondary/70">Box {e.boxId ?? "N/A"} · {e.audience === "especialidad" ? "Compartida por especialidad" : "Propia"}</div>
                    </div>
                  ))}
                  {(extrasDelDia.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin horas liberadas para esta fecha.</p>}
                </CardContent>
              </Card>
            </div>
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

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Alineación con médicos</h2>
            <p className="text-sm text-secondary/70 mb-3">Historial y observaciones sincronizadas con el panel del doctor.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <ObservacionRapida />
              <SolicitudesBloqueo />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-secondary mb-3">Solicitudes especiales de reajuste</h2>
            <SolicitudesEspeciales />
          </section>
        </div>
      </div>
    </AppShell>
  )
}





