"use client"

import AppShell from "@/components/common/AppShell"
import DataTable from "@/components/common/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ColumnDef } from "@tanstack/react-table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  MENSAJES_ERROR,
  VENTANA_MINIMA_HORAS,
  type DisponibilidadResponse,
  type DisponibilidadSlot,
  type SolicitudInscripcion,
  ESTADO_CONFIG,
  buildResumenSolicitud,
  isSlotPast,
  sortSolicitudesByPrioridad,
} from "@/lib/inscripciones"
import { exportCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"

type DoctorProfile = {
  id: number
  rut: string
  nombre: string
  especialidadId: string
  especialidadIds?: string[]
  especialidades: string[]
  asignaciones: { piso?: { id?: string; sedeId?: string; numero?: number; nombre?: string }; boxIds: number[] }[]
}

type PisoCatalog = { id: string; sedeId: string; numero: number; nombre: string; capacidadConcurrente: number }
type SedeCatalog = { id: string; nombre: string }
type BoxRow = { id: number; piso: number; pisoId: string; sedeId?: string; especialidades: string; estado: "disponible" | "bloqueado" }
type BloqueoItem = { id: string; box: number | null; doctorId: number | null; fecha: string; fechaInicio: string; fechaFin: string; motivo: string; creadoPor: string }
type KPIDoc = { semana: { dia: string; ocupacion: number }[]; proximos: { fecha: string; box: number }[] }

type DisponibilidadSelection = {
  fecha: string
  boxId: number
  slot: DisponibilidadSlot
  boxLabel: string
  requiereAprobacion: boolean
}

const fmtFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" })
const fmtFechaHora = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" })

const semanaLabel = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"]

const toISODate = (date: Date) => date.toISOString().slice(0, 10)

const startOfWeek = (date: Date) => {
  const clone = new Date(date)
  const day = clone.getDay()
  const diff = (day + 6) % 7
  clone.setDate(clone.getDate() - diff)
  clone.setHours(0, 0, 0, 0)
  return clone
}

const addDays = (date: Date, days: number) => {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + days)
  return clone
}

const formatTimestamp = (value?: string) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return fmtFechaHora.format(date)
}

const formatFechaHumana = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return `${semanaLabel[date.getUTCDay()]} ${fmtFecha.format(date)}`
}

const formatRut = (rut: string) => rut.toUpperCase()

function getCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : ""
}
export default function Page() {
  const [rut, setRut] = useState<string | undefined>(undefined)
  useEffect(() => {
    const value = getCookie("rut")
    setRut(value || "")
  }, [])
  const qc = useQueryClient()

  const doctorQuery = useQuery<DoctorProfile | null>({
    queryKey: ["doctor", rut ?? ""],
    queryFn: async () => {
      const rutValue = rut
      if (!rutValue) return null
      const response = await fetch(`/api/doctors?rut=${encodeURIComponent(rutValue)}`)
      return response.json()
    },
    enabled: Boolean(rut),
  })

  const especialidadesCatalog = useQuery<{ id: string; nombre: string }[]>({
    queryKey: ["catalogo", "especialidades"],
    queryFn: () => fetch("/api/catalogos/especialidades?detalle=1").then((r) => r.json()),
  })

  const pisosCatalog = useQuery<PisoCatalog[]>({
    queryKey: ["catalogo", "pisos"],
    queryFn: () => fetch("/api/catalogos/pisos?detalle=1").then((r) => r.json()),
  })

  const sedesCatalog = useQuery<SedeCatalog[]>({
    queryKey: ["catalogo", "sedes"],
    queryFn: () => fetch("/api/catalogos/sedes").then((r) => r.json()),
  })

  const boxesQuery = useQuery<BoxRow[]>({
    queryKey: ["boxes"],
    queryFn: () => fetch("/api/boxes").then((r) => r.json()),
  })

  const bloqueosQuery = useQuery<{ items: BloqueoItem[]; updatedAt: string }>({
    queryKey: ["bloqueos"],
    queryFn: () => fetch("/api/bloqueos").then((r) => r.json()),
  })

  const kpiDocQuery = useQuery<KPIDoc>({
    queryKey: ["kpi-doctor", rut ?? ""],
    queryFn: () => fetch(`/api/kpis/doctor?rut=${encodeURIComponent(rut ?? "")}`).then((r) => r.json()),
    enabled: Boolean(rut),
  })

  const doctor = doctorQuery.data

  const solicitudesQuery = useQuery<{ items: SolicitudInscripcion[] }>({
    queryKey: ["inscripciones", doctor?.id],
    queryFn: () => fetch(`/api/inscripciones?doctor=${doctor?.id}`).then((r) => r.json()),
    enabled: Boolean(doctor?.id),
  })

  const especialidadesDetalle = especialidadesCatalog.data ?? []
  const pisos = pisosCatalog.data ?? []
  const sedes = sedesCatalog.data ?? []
  const allBoxes = boxesQuery.data ?? []
  const bloqueos = bloqueosQuery.data?.items ?? []
  const bloqueosUpdatedAt = bloqueosQuery.data?.updatedAt
  const kpiDoc = kpiDocQuery.data ?? { semana: [], proximos: [] }
  const solicitudes = solicitudesQuery.data?.items ?? []

  if (rut === undefined) {
    return (
      <AppShell>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">Cargando tu informacion...</p>
          </section>
        </div>
      </AppShell>
    )
  }

  if (!rut) {
    return (
      <AppShell>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-secondary">Panel clinico</h1>
          <section className="rounded-2xl border border-border/60 bg-white/90 p-6 text-secondary shadow-lg shadow-primary/10 backdrop-blur-sm">
            <p className="font-medium text-destructive">
              No pudimos identificar tu sesion. Inicia nuevamente con tu RUT corporativo.
            </p>
          </section>
        </div>
      </AppShell>
    )
  }

  if (doctorQuery.isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">Cargando tu informacion...</p>
          </section>
        </div>
      </AppShell>
    )
  }

  if (!doctor) {
    return (
      <AppShell>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-secondary">Panel clinico</h1>
          <section className="rounded-2xl border border-border/60 bg-white/90 p-6 text-secondary shadow-lg shadow-primary/10 backdrop-blur-sm">
            <p className="font-medium text-destructive">
              No encontramos tu perfil clinico. Contacta a soporte corporativo para habilitar tu acceso.
            </p>
          </section>
        </div>
      </AppShell>
    )
  }

  const boxIdsAsignados = new Set<number>(doctor.asignaciones.flatMap((a) => a.boxIds))
  const misBoxes = allBoxes.filter((b) => boxIdsAsignados.has(b.id))
  const misBloqueos = bloqueos.filter((b) => (b.box ? boxIdsAsignados.has(b.box) : b.doctorId === doctor.id))

  const solicitudesOrdenadas = sortSolicitudesByPrioridad(solicitudes)

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Panel clinico</span>
              <h1 className="text-3xl font-semibold text-secondary">
                Hola, {doctor.nombre.split(" ")[0]}
              </h1>
              <p className="text-sm text-muted-foreground">
                Solicita nuevas inscripciones en boxes habilitados y revisa tu disponibilidad estructural en RedSalud.
              </p>
              <p className="text-sm font-medium text-secondary/80">
                {doctor.especialidades.join(" ? ")} ? {formatRut(doctor.rut)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportCsv(`mis_boxes_${doctor.id}`, misBoxes)} disabled={!misBoxes.length}>
                Exportar boxes
              </Button>
              <Button variant="outline" onClick={() => exportCsv(`mis_bloqueos_${doctor.id}`, misBloqueos)} disabled={!misBloqueos.length}>
                Exportar bloqueos
              </Button>
            </div>
          </div>
        </section>

        <InscripcionSection
          doctor={doctor}
          pisos={pisos}
          sedes={sedes}
          especialidades={especialidadesDetalle}
          queryClient={qc}
          solicitudesPending={solicitudesOrdenadas.filter((s) => s.estado === "pendiente" || s.estado === "devuelta").length}
        />

        <SolicitudesRecientes solicitudes={solicitudesOrdenadas} />

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Uso semanal (%)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiDoc.semana}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(18, 67, 71, 0.1)" />
                <XAxis dataKey="dia" stroke="rgba(18,67,71,0.6)" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="rgba(18,67,71,0.6)" tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "rgba(0, 162, 154, 0.1)" }} />
                <Bar dataKey="ocupacion" radius={[8, 8, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Proximas disponibilidades</h2>
          <ul className="space-y-2 text-sm">
            {kpiDoc.proximos.map((p, i) => (
              <li
                key={`${p.box}-${p.fecha}-${i}`}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-secondary/90 shadow-sm shadow-primary/5"
              >
                <span className="font-semibold text-secondary">{formatFechaHumana(p.fecha)}</span>
                <span className="text-muted-foreground">Box {p.box}</span>
              </li>
            ))}
            {kpiDoc.proximos.length === 0 && (
              <li className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-muted-foreground">
                Sin datos disponibles por ahora.
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm space-y-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-secondary">Solicitar bloqueo rapido</h2>
            <p className="text-sm text-muted-foreground">Genera un bloqueo operativo para tus boxes asignados.</p>
            <span className="text-xs text-muted-foreground">ultima sincronizacion: {formatTimestamp(bloqueosUpdatedAt)}</span>
          </div>
          <FormBloqueo
            boxesIds={[...boxIdsAsignados]}
            onOk={() => {
              qc.invalidateQueries({ queryKey: ["bloqueos"] })
            }}
          />
          <div>
            <h3 className="mt-2 mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-secondary/70">Bloqueos vigentes</h3>
            <ul className="space-y-2 text-sm">
              {misBloqueos.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-white/80 px-4 py-3 text-secondary/90 shadow-sm shadow-primary/5"
                >
                  <span>
                    {b.box ? `Box ${b.box}` : "Bloqueo personal"} ? {formatFechaHumana(b.fecha)} - {b.motivo}
                  </span>
                  <span className="text-muted-foreground">{b.creadoPor}</span>
                </li>
              ))}
              {misBloqueos.length === 0 && (
                <li className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-muted-foreground">
                  No hay bloqueos activos.
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-secondary mb-3">Mis boxes</h2>
          <DataTable
            columns={[
              { header: "Box", accessorKey: "id" },
              { header: "Piso", accessorKey: "piso" },
              { header: "Especialidades", accessorKey: "especialidades" },
              { header: "Estado", accessorKey: "estado" },
            ] as ColumnDef<BoxRow, unknown>[]}
            data={misBoxes}
          />
        </section>
      </div>
    </AppShell>
  )
}
type InscripcionProps = {
  doctor: DoctorProfile
  pisos: PisoCatalog[]
  sedes: SedeCatalog[]
  especialidades: { id: string; nombre: string }[]
  queryClient: QueryClient
  solicitudesPending: number
}

function InscripcionSection({ doctor, pisos, sedes, especialidades, queryClient, solicitudesPending }: InscripcionProps) {
  const especialidadIds = doctor.especialidadIds?.length ? doctor.especialidadIds : doctor.especialidadId ? [doctor.especialidadId] : []
  const especialidadOptions = especialidadIds.map((id, idx) => {
    const found = especialidades.find((e) => e.id === id)
    const fallbackNombre = doctor.especialidades[idx] ?? doctor.especialidades[0] ?? id
    return { id, nombre: found?.nombre ?? fallbackNombre }
  })

  const [especialidadId, setEspecialidadId] = useState<string>(especialidadOptions[0]?.id ?? doctor.especialidadId)

  const pisoAsignado = doctor.asignaciones.find((a) => a.piso?.id)?.piso?.id
  const pisoInicial = pisoAsignado && pisos.some((p) => p.id === pisoAsignado) ? pisoAsignado : pisos[0]?.id ?? ""
  const sedeInicial = pisoInicial ? pisos.find((p) => p.id === pisoInicial)?.sedeId : sedes[0]?.id ?? ""

  const [sedeId, setSedeId] = useState<string>(sedeInicial ?? "")
  const [pisoId, setPisoId] = useState<string>(pisoInicial)
  const [weekStart, setWeekStart] = useState<string>(() => toISODate(startOfWeek(new Date())))
  const [selectedDia, setSelectedDia] = useState<string | null>(null)
  const [selection, setSelection] = useState<DisponibilidadSelection | null>(null)
  const [motivo, setMotivo] = useState("")

  useEffect(() => {
    const pisoActual = pisos.find((p) => p.id === pisoId)
    if (pisoActual?.sedeId !== sedeId) {
      const first = pisos.find((p) => p.sedeId === sedeId)
      setPisoId(first?.id ?? "")
      setSelectedDia(null)
      setSelection(null)
    }
  }, [sedeId, pisoId, pisos])

  useEffect(() => {
    setSelectedDia(null)
    setSelection(null)
  }, [especialidadId])

  const disponibilidadQuery = useQuery<DisponibilidadResponse>({
    queryKey: ["disponibilidad", doctor.id, especialidadId, pisoId, weekStart],
    queryFn: async () => {
      const params = new URLSearchParams({
        especialidad_id: especialidadId,
        piso_id: pisoId,
        doctor_id: String(doctor.id),
        fecha: weekStart,
      })
      const res = await fetch(`/api/disponibilidad?${params.toString()}`)
      if (!res.ok) {
        throw new Error("No pudimos cargar la disponibilidad")
      }
      return res.json()
    },
    enabled: Boolean(especialidadId && pisoId),
  })

  const disponibilidad = disponibilidadQuery.data

  useEffect(() => {
    if (!disponibilidad?.dias?.length) {
      setSelectedDia(null)
      setSelection(null)
      return
    }
    const keep = disponibilidad.dias.find((d) => d.fecha === selectedDia)
    if (keep) return
    const firstWithSlots = disponibilidad.dias.find((d) => d.boxesLibres > 0) ?? disponibilidad.dias[0]
    setSelectedDia(firstWithSlots?.fecha ?? null)
    setSelection(null)
  }, [disponibilidad, selectedDia])

  const selectedDay = disponibilidad?.dias.find((d) => d.fecha === selectedDia) ?? null

  const mutation = useMutation({
    mutationFn: async (payload: DisponibilidadSelection) => {
      const res = await fetch("/api/inscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctor.id,
          especialidad_id: especialidadId,
          piso_id: pisoId,
          box_id: payload.boxId,
          fecha: payload.fecha,
          tramo: { inicio: payload.slot.inicio, fin: payload.slot.fin },
          motivo: motivo.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || MENSAJES_ERROR.desactualizado)
      }
      return { status: res.status, data }
    },
    onSuccess: (result) => {
      if (result.status === 201) {
        toast.success(result.data?.mensaje ?? "Inscripcion confirmada")
      } else {
        toast.success("Solicitud enviada al equipo de agendamiento")
        if (Array.isArray(result.data?.metadata?.conflictos) && result.data.metadata.conflictos.length) {
          toast.info(result.data.metadata.conflictos.join(" ? "))
        }
      }
      setMotivo("")
      setSelection(null)
      queryClient.invalidateQueries({ queryKey: ["disponibilidad", doctor.id] })
      queryClient.invalidateQueries({ queryKey: ["inscripciones", doctor.id] })
      disponibilidadQuery.refetch()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error ?? "")
      toast.error(message || "No pudimos registrar la solicitud")
    },
  })

  const pisosPorSede = pisos.filter((p) => !sedeId || p.sedeId === sedeId)

  const weekStartDate = disponibilidad?.rango?.inicio ?? weekStart
  const weekEndDate = disponibilidad?.rango?.fin ?? toISODate(addDays(new Date(weekStart), 6))

  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-secondary">Inscripcion de pisos y boxes</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona piso y tramo disponible. La ventana minima es de {VENTANA_MINIMA_HORAS} horas.
          </p>
          {solicitudesPending > 0 && (
            <p className="text-xs text-amber-600 font-medium">Tienes {solicitudesPending} solicitud(es) pendiente(s) de revision.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const prev = toISODate(addDays(new Date(weekStart), -7))
              setWeekStart(prev)
              setSelectedDia(null)
              setSelection(null)
            }}
          >
            Semana anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = toISODate(addDays(new Date(weekStart), 7))
              setWeekStart(next)
              setSelectedDia(null)
              setSelection(null)
            }}
          >
            Semana siguiente
          </Button>
          <Button variant="outline" size="sm" onClick={() => disponibilidadQuery.refetch()} disabled={disponibilidadQuery.isFetching}>
            {disponibilidadQuery.isFetching ? "Actualizando..." : "Refrescar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Especialidad</Label>
          {especialidadOptions.length <= 1 ? (
            <div className="h-11 flex items-center rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90">
              {especialidadOptions[0]?.nombre ?? doctor.especialidades[0]}
            </div>
          ) : (
            <select
              value={especialidadId}
              onChange={(event) => setEspecialidadId(event.target.value)}
              className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {especialidadOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Sede</Label>
          <select
            value={sedeId}
            onChange={(event) => setSedeId(event.target.value)}
            className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {sedes.map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Piso compatible</Label>
          <select
            value={pisoId}
            onChange={(event) => setPisoId(event.target.value)}
            className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {pisosPorSede.map((piso) => (
              <option key={piso.id} value={piso.id}>
                Piso {piso.numero} ? {piso.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {disponibilidad && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            Semana del {formatFechaHumana(weekStartDate)} al {formatFechaHumana(weekEndDate)}
          </span>
          <span>Bloqueos: {formatTimestamp(disponibilidad.metadata?.bloqueosActualizados)}</span>
          <span>Feriados: {formatTimestamp(disponibilidad.metadata?.feriadosActualizados)}</span>
          <span>Actualiza cada {disponibilidad.metadata?.refreshSugeridoMinutos ?? 15} min</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        {disponibilidad?.dias?.map((dia) => {
          const isSelected = selectedDia === dia.fecha
          const disabled = dia.boxesLibres === 0
          return (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => {
                setSelectedDia(dia.fecha)
                setSelection(null)
              }}
              disabled={disabled}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition focus:outline-none",
                isSelected ? "border-primary bg-primary/5 shadow" : "border-border/60 bg-white/80",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-secondary/60">{dia.etiqueta}</div>
              <div className="text-lg font-semibold text-secondary">
                {dia.boxesLibres > 0 ? `${dia.boxesLibres} boxes libres` : "Sin cupos"}
              </div>
              {dia.conflictos.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-amber-600">
                  {dia.conflictos.map((conf, idx) => (
                    <div key={idx}>{conf}</div>
                  ))}
                </div>
              )}
            </button>
          )
        })}
        {!disponibilidad?.dias?.length && (
          <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
            No hay disponibilidad publicada para la combinacion seleccionada.
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Boxes y tramos</h3>
          <div className="space-y-3">
            {selectedDay?.boxes.map((box) => (
              <div key={`${selectedDay.fecha}-${box.id}`} className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm shadow-primary/5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-secondary">{box.etiqueta}</p>
                    {box.motivos?.length ? (
                      <p className="text-xs text-muted-foreground">{box.motivos.join(" ? ")}</p>
                    ) : null}
                  </div>
                  {box.requiereAprobacion && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Requiere aprobacion
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {box.tramos.map((slot) => {
                    const isDisabled = isSlotPast(selectedDay.fecha, slot)
                    const isSelected = selection?.fecha === selectedDay.fecha && selection.boxId === box.id && selection.slot.inicio === slot.inicio && selection.slot.fin === slot.fin
                    const requiereAprobacion = Boolean(slot.requiereAprobacion || box.requiereAprobacion)
                    return (
                      <button
                        key={`${box.id}-${slot.inicio}-${slot.fin}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() =>
                          setSelection({
                            fecha: selectedDay.fecha,
                            boxId: box.id,
                            slot,
                            boxLabel: box.etiqueta,
                            requiereAprobacion,
                          })
                        }
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition",
                          isSelected ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-white",
                          requiereAprobacion && !isSelected ? "border-amber-300 text-amber-700" : "text-secondary/80",
                          isDisabled && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {`${slot.inicio} - ${slot.fin}`}
                        {slot.motivo && <span className="block text-[11px] font-normal text-muted-foreground">{slot.motivo}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {!selectedDay && (
              <p className="text-sm text-muted-foreground">Selecciona un dia para ver los boxes disponibles.</p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm shadow-primary/5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Resumen y envio</h3>
          <div className="space-y-2 text-sm">
            <p className="text-secondary/80">
              {selection ? (
                <>
                  {formatFechaHumana(selection.fecha)} ? {selection.boxLabel} ? {selection.slot.inicio} - {selection.slot.fin}
                </>
              ) : (
                "Selecciona un tramo para continuar"
              )}
            </p>
            {selection?.requiereAprobacion && (
              <p className="text-xs text-amber-600">
                {MENSAJES_ERROR.requiereAprobacion} Se registrara una solicitud para agendamiento.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej. Extender jornada vespertina" />
          </div>
          <Button
            onClick={() => selection && mutation.mutate(selection)}
            disabled={!selection || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Enviando..." : selection?.requiereAprobacion ? "Enviar solicitud" : "Confirmar inscripcion"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Ventana minima: {VENTANA_MINIMA_HORAS} horas ? Las solicitudes se atienden dentro de 24 h habiles.
          </p>
        </div>
      </div>
    </section>
  )
}
const toneStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-100 text-amber-700",
  positive: "border-emerald-200 bg-emerald-100 text-emerald-700",
  negative: "border-red-200 bg-red-100 text-red-700",
  warning: "border-sky-200 bg-sky-100 text-sky-700",
}

function SolicitudesRecientes({ solicitudes }: { solicitudes: SolicitudInscripcion[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-secondary">Solicitudes recientes</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/60">
          {solicitudes.length} registro(s)
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {solicitudes.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
            Aun no registras solicitudes de inscripcion.
          </div>
        )}
        {solicitudes.slice(0, 6).map((sol) => {
          const estadoCfg = ESTADO_CONFIG[sol.estado]
          const resume = buildResumenSolicitud(sol)
          return (
            <div
              key={sol.id}
              className="rounded-xl border border-border/60 bg-white/80 px-4 py-4 text-sm text-secondary/90 shadow-sm shadow-primary/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{sol.id}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]",
                        toneStyles[estadoCfg.tone],
                      )}
                    >
                      {estadoCfg.label}
                    </span>
                  </div>
                  <span className="text-sm text-secondary/80">{resume}</span>
                  <span className="text-xs text-muted-foreground">
                    Creada el {formatTimestamp(sol.createdAt)} - ultima actualizacion {formatTimestamp(sol.updatedAt)}
                  </span>
                  {sol.metadata.conflictos?.length ? (
                    <span className="text-xs text-amber-600">{sol.metadata.conflictos.join(", ")}</span>
                  ) : null}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {typeof sol.metadata.slaVenceEnHoras === "number" && sol.estado === "pendiente" ? (
                    <span>Vence en {Math.max(0, sol.metadata.slaVenceEnHoras)} h</span>
                  ) : null}
                  <div>{sol.especialidad?.nombre}</div>
                  {sol.box?.etiqueta && <div>{sol.box.etiqueta}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
function FormBloqueo({ boxesIds, onOk }: { boxesIds: number[]; onOk: () => void }) {
  const { register, handleSubmit, reset } = useForm<{ box: number; fecha: string; motivo: string }>()
  const mut = useMutation({
    mutationFn: (payload: { box: number; fecha: string; motivo: string }) =>
      fetch("/api/bloqueos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.message || "No pudimos crear el bloqueo")
        }
        return res.json()
      }),
    onSuccess: () => {
      toast.success("Bloqueo registrado")
      reset()
      onOk()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error ?? "")
      toast.error(message || "Error al registrar el bloqueo")
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!data.box || !data.fecha || !data.motivo?.trim()) {
          toast.error("Completa todos los campos")
          return
        }
        mut.mutate({ ...data, box: Number(data.box) })
      })}
      className="grid gap-4 sm:grid-cols-3"
    >
      <div className="space-y-2">
        <Label>Box</Label>
        <select
          className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-secondary/90 shadow-sm shadow-primary/10 outline-none transition focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/60"
          {...register("box", { valueAsNumber: true })}
        >
          <option value="">Selecciona</option>
          {boxesIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input type="date" {...register("fecha")} />
      </div>
      <div className="space-y-2">
        <Label>Motivo</Label>
        <Input {...register("motivo")} placeholder="Ej. congreso, mantencion" />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
          {mut.isPending ? "Registrando..." : "Solicitar bloqueo"}
        </Button>
      </div>
    </form>
  )
}


















