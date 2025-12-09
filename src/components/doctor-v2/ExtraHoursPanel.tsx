"use client"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CalendarDays, Check, Clock3, Filter, MapPin, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DoctorProfile = { nombre: string; rut: string; especialidad?: string | null }
type ExtraHour = { id: string; fecha: string; inicio: string; fin: string; boxId?: number; audience?: string | null; especialidad?: string | null; ownerRut?: string | null; piso?: number | null }
type AvailabilityItem = { fecha: string; inicio: string; fin: string; boxId?: number | null; piso?: number | null; especialidad?: string | null }
type ListResponse = { items: ExtraHour[] }
type WeeklyItem = { dia_semana: number; inicio: string; fin: string; box?: number | null; frecuencia_min?: number | null; piso?: number | null }
type WeeklyResponse = { items: WeeklyItem[] }
type EnrichedBlock = ExtraHour & { piso?: number | null; duracionMin: number; boxLabel: string; compartidoEspecialidad: boolean }

const START_YEAR = 2025
const END_YEAR = 2026
const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const fmtMesAnio = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
const fmtDia = new Intl.DateTimeFormat("es-CL", { weekday: "long", month: "long", day: "numeric" })

const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() + m, 1)
const startOfCalendarMonth = (d: Date) => {
  const first = startOfMonth(d)
  const dow = first.getDay()
  const diff = (dow + 6) % 7
  const res = new Date(first)
  res.setDate(first.getDate() - diff)
  return res
}
const minutesBetween = (inicio: string, fin: string) => {
  const [hi, mi] = inicio.split(":").map(Number)
  const [hf, mf] = fin.split(":").map(Number)
  return hf * 60 + mf - (hi * 60 + mi)
}
const formatMinutes = (min: number) => {
  if (min <= 0) return "0 min"
  const hours = Math.floor(min / 60)
  const rest = min % 60
  if (hours && rest) return `${hours}h ${rest}m`
  if (hours) return `${hours}h`
  return `${rest}m`
}
const parseISODate = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00`) : null)

export default function ExtraHoursPanel() {
  const today = new Date()
  const clampToRange = (d: Date) => {
    const min = new Date(START_YEAR, 0, 1)
    const max = new Date(END_YEAR, 11, 1)
    if (d < min) return min
    if (d > max) return max
    return d
  }
  const initialMonth = clampToRange(today.getFullYear() >= START_YEAR && today.getFullYear() <= END_YEAR ? startOfMonth(today) : new Date(START_YEAR, 0, 1))
  const [monthCursor, setMonthCursor] = useState<Date>(initialMonth)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set())
  const [customDurations, setCustomDurations] = useState<Record<string, number>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ box: string; tipo: "all" | "propio" | "compartido" }>({ box: "all", tipo: "all" })

  const profile = useQuery<DoctorProfile>({
    queryKey: ["doctor-profile"],
    queryFn: async () => (await fetch("/api/doctor/profile")).json(),
  })

  const list = useQuery<ListResponse>({
    queryKey: ["extra-hours", START_YEAR, END_YEAR],
    queryFn: async () => (await fetch(`/api/doctor/extra-hours?from=${START_YEAR}-01-01&to=${END_YEAR}-12-31&includeSpecialty=true`)).json(),
  })

  const availability = useQuery<{ items: AvailabilityItem[] }>({
    queryKey: ["availability", START_YEAR, END_YEAR],
    enabled: true,
    queryFn: async () => {
      const url = `/api/availability?from=${START_YEAR}-01-01&to=${END_YEAR}-12-31&all=true&shareBlocked=true&especialidad=all`
      return (await fetch(url)).json()
    },
  })

  const weekly = useQuery<WeeklyResponse>({
    queryKey: ["weekly-slots"],
    queryFn: async () => (await fetch(`/api/doctor/weekly-slots`)).json(),
  })

  const itemsBase = useMemo(() => {
    const avail = availability.data?.items ?? []
    if (avail.length > 0) {
      return avail.map((a, idx) => ({
        id: `avail-${idx}-${a.fecha}-${a.inicio}`,
        fecha: a.fecha,
        inicio: a.inicio,
        fin: a.fin,
        boxId: a.boxId ?? undefined,
        especialidad: a.especialidad ?? undefined,
        piso: a.piso ?? null,
        audience: "especialidad",
      }))
    }
    return list.data?.items ?? []
  }, [availability.data, list.data])

  const filteredItems = useMemo(() => {
    return itemsBase.filter((i) => {
      if (bookedIds.has(i.id)) return false
      if (filters.box !== "all" && String(i.boxId ?? "") !== filters.box) return false
      if (filters.tipo === "propio" && i.audience === "especialidad") return false
      if (filters.tipo === "compartido" && i.audience !== "especialidad") return false
      return true
    })
  }, [itemsBase, bookedIds, filters])

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, ExtraHour[]>()
    for (const item of filteredItems) {
      const arr = map.get(item.fecha) ?? []
      arr.push(item)
      map.set(item.fecha, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.inicio.localeCompare(b.inicio))
    return map
  }, [filteredItems])

  useEffect(() => {
    if (selectedDates.size === 0 && availabilityByDate.size > 0) {
      const first = Array.from(availabilityByDate.keys()).sort()[0]
      setSelectedDates(new Set([first]))
    }
  }, [availabilityByDate, selectedDates.size])

  const pisosPorBox = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const item of weekly.data?.items ?? []) {
      if (typeof item.box === "number") {
        const piso = typeof (item as any).piso === "number" ? (item as any).piso : null
        map.set(item.box, piso)
      }
    }
    for (const a of filteredItems) {
      const box = typeof a.boxId === "number" ? a.boxId : null
      if (box && typeof a.piso === "number" && !map.has(box)) {
        map.set(box, a.piso)
      }
    }
    return map
  }, [weekly.data, filteredItems])

  const bloquesDelDia = useMemo(() => {
    const key = hoverDate || Array.from(selectedDates).sort()[0] || null
    const bloques = key ? availabilityByDate.get(key) ?? [] : []
    return bloques
      .map((b) => {
        const piso = b.boxId ? pisosPorBox.get(b.boxId) ?? null : null
        return {
          ...b,
          piso,
          duracionMin: minutesBetween(b.inicio, b.fin),
          boxLabel: b.boxId ? `Box ${b.boxId}` : "Box sin asignar",
          compartidoEspecialidad: b.audience === "especialidad",
        }
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
  }, [availabilityByDate, hoverDate, pisosPorBox, selectedDates])

  const resumenSeleccion = useMemo(() => {
    const picked = bloquesDelDia.filter((b) => selectedBlocks.has(b.id))
    const minutos = picked.reduce((acc, b) => acc + (customDurations[b.id] ?? b.duracionMin), 0)
    return { cantidad: picked.length, minutos, picked }
  }, [bloquesDelDia, selectedBlocks, customDurations])

  const monthLabel = fmtMesAnio.format(monthCursor)
  const weeksByMonth = useMemo(() => {
    const month = monthCursor
    const start = startOfCalendarMonth(month)
    const rows: Date[][] = []
    for (let w = 0; w < 6; w++) {
      const row: Date[] = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start)
        cur.setDate(start.getDate() + w * 7 + d)
        row.push(cur)
      }
      rows.push(row)
    }
    return [{ month, rows }]
  }, [monthCursor])

  const minMonth = new Date(START_YEAR, 0, 1)
  const maxMonth = new Date(END_YEAR, 11, 31)
  const canPrev = monthCursor > minMonth
  const canNext = monthCursor < new Date(END_YEAR, 11, 1)

  const toggleBlock = (id: string) => {
    const target = bloquesDelDia.find((b) => b.id === id)
    setSelectedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        if (target && !(id in customDurations)) {
          setCustomDurations((curr) => ({ ...curr, [id]: target.duracionMin }))
        }
      }
      return next
    })
  }

  const toggleDate = (iso: string) => {
    setSelectedBlocks(new Set())
    setCustomDurations({})
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  const setDurationForBlock = (id: string, minutes: number) => {
    setCustomDurations((curr) => ({ ...curr, [id]: minutes }))
  }

  const reservaMut = useMutation({
    mutationFn: async (payload: { id: string; minutos: number }[]) => {
      await new Promise((resolve) => setTimeout(resolve, 420))
      return payload
    },
    onSuccess: (payload) => {
      const ids = payload.map((p) => p.id)
      setBookedIds((prev) => new Set([...prev, ...ids]))
      setSelectedBlocks(new Set())
      setShowConfirm(false)
      setFeedback(`Reserva confirmada para ${ids.length} bloque${ids.length === 1 ? "" : "s"}.`)
    },
    onError: () => setFeedback("No pudimos confirmar la reserva. Inténtalo nuevamente."),
  })

  const selectedDateLabel = () => {
    if (hoverDate) return fmtDia.format(parseISODate(hoverDate)!)
    const first = Array.from(selectedDates).sort()[0]
    return first ? fmtDia.format(parseISODate(first)!) : ""
  }

  const history = useMemo(() => {
    const todayIso = toISODate(today)
    const past: ExtraHour[] = []
    const future: ExtraHour[] = []
    for (const item of filteredItems) {
      if (item.fecha < todayIso) past.push(item)
      else future.push(item)
    }
    past.sort((a, b) => a.fecha.localeCompare(b.fecha))
    future.sort((a, b) => a.fecha.localeCompare(b.fecha))
    return { past, future }
  }, [filteredItems, today])

  const renderDayCell = (day: Date) => {
    const iso = toISODate(day)
    const disponibles = availabilityByDate.get(iso)?.length ?? 0
    const isInYear = day >= minMonth && day <= maxMonth
    const isSelected = selectedDates.has(iso)
    const isDisponible = disponibles > 0 && isInYear
    const isMuted = day.getMonth() !== monthCursor.getMonth()
    const isDisabled = !isInYear
    const badgeColor = isDisponible ? "bg-emerald-500 text-white" : isSelected ? "bg-blue-500 text-white" : "bg-secondary/10 text-secondary/60"

    return (
      <button
        key={iso}
        type="button"
        disabled={isDisabled}
        onMouseEnter={() => isDisponible && setHoverDate(iso)}
        onMouseLeave={() => setHoverDate(null)}
        onClick={() => {
          if (!isInYear) return
          if (isDisponible) toggleDate(iso)
        }}
        className={cn(
          "flex min-h-[78px] flex-col justify-between rounded-xl border px-2 py-2 text-left text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed",
          isSelected ? "border-blue-400 bg-blue-50 shadow-md shadow-blue-100" : isDisponible ? "border-emerald-200 bg-white" : "border-border/40 bg-secondary/5",
          isMuted && "opacity-40"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-secondary leading-none">{day.getDate()}</span>
          {isDisponible && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
        </div>
        {isDisponible && (
          <div className="flex items-center gap-1 text-[11px] text-secondary/70">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeColor)}>
              {disponibles} bloque{disponibles === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </button>
    )
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border/40 bg-white p-6 shadow-lg shadow-primary/10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Backoffice de boxes</p>
          <h2 className="text-2xl font-semibold text-secondary">Horas extras / recuperativas</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">Selecciona días con horas disponibles en {START_YEAR}-{END_YEAR}, explora los bloques por box y confirma tu reserva con un resumen claro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <CalendarDays className="size-5" />
            <div className="leading-tight">
              <p className="font-semibold">Años {START_YEAR} - {END_YEAR}</p>
              <p className="text-xs text-emerald-800">Días verdes: disponibilidad lista para reservar</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/5 px-3 py-2 text-sm text-secondary">
            <Filter className="size-4" />
            <select className="rounded-md border border-border/60 bg-white px-2 py-1 text-xs" value={filters.box} onChange={(e) => setFilters((f) => ({ ...f, box: e.target.value }))}>
              <option value="all">Todos los boxes</option>
              {[...new Set(filteredItems.map((i) => i.boxId).filter(Boolean))].map((b) => (
                <option key={String(b)} value={String(b)}>{`Box ${b}`}</option>
              ))}
            </select>
            <select className="rounded-md border border-border/60 bg-white px-2 py-1 text-xs" value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value as any }))}>
              <option value="all">Todos</option>
              <option value="propio">Propio</option>
              <option value="compartido">Compartido por especialidad</option>
            </select>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-50 via-white to-transparent" />
          <CardHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{`Calendario ${monthLabel}`}</CardTitle>
                <CardDescription>Días disponibles en verde. Selecciona uno o varios para ver los bloques.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => canPrev && setMonthCursor(addMonths(monthCursor, -1))}>
                  Mes anterior
                </Button>
                <Button variant="outline" size="sm" disabled={!canNext} onClick={() => canNext && setMonthCursor(addMonths(monthCursor, 1))}>
                  Mes siguiente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm font-semibold text-secondary">
                <span>{fmtMesAnio.format(monthCursor)}</span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/60">
                {weekDays.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weeksByMonth[0].rows.map((row, ri) => row.map((day, di) => renderDayCell(day)))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary/70">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span>Día con horas disponibles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span>Día seleccionado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-secondary/20" />
                <span>Sin disponibilidad</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {feedback && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <Check className="size-4" />
              <span>{feedback}</span>
            </div>
          )}

          <Card className="space-y-0">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Disponibilidad del día</CardTitle>
                  <CardDescription className="text-sm text-secondary/80">{selectedDateLabel()}</CardDescription>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {bloquesDelDia.length} bloque{bloquesDelDia.length === 1 ? "" : "s"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {bloquesDelDia.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/5 px-4 py-6 text-sm text-secondary/70">
                  Selecciona una fecha con disponibilidad en el calendario para ver los bloques.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {bloquesDelDia.map((b) => {
                    const isSelected = selectedBlocks.has(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBlock(b.id)}
                        className={cn(
                          "flex h-full flex-col gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200",
                          isSelected ? "border-emerald-400 bg-emerald-50 shadow-inner" : "border-border/60 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-secondary">{b.boxLabel}</span>
                          <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", isSelected ? "bg-emerald-500 text-white" : "bg-secondary/10 text-secondary/70")}>{isSelected ? "Seleccionado" : "Disponible"}</span>
                        </div>
                        <div className="space-y-2 text-sm text-secondary/80">
                          <div className="flex items-center gap-2 font-semibold text-secondary">
                            <Clock3 className="size-4 text-emerald-600" />
                            <span>{b.inicio} - {b.fin}</span>
                          </div>
                          {b.compartidoEspecialidad && (
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                              <span>Compartido por especialidad</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Timer className="size-4 text-emerald-600" />
                            <span>{formatMinutes(b.duracionMin)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-emerald-600" />
                            <span>{b.piso !== null && b.piso !== undefined ? `Piso ${b.piso}` : "Piso sin definir"}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-secondary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Resumen de reserva</p>
                    <p className="text-sm text-secondary/80">Estás reservando {resumenSeleccion.cantidad || 0} bloque{resumenSeleccion.cantidad === 1 ? "" : "s"}: total {formatMinutes(resumenSeleccion.minutos)}.</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow">{formatMinutes(resumenSeleccion.minutos)}</div>
                </div>
                {resumenSeleccion.picked.length > 0 && (
                  <div className="grid gap-2 text-xs">
                    {resumenSeleccion.picked.map((b) => {
                      const duracionActual = customDurations[b.id] ?? b.duracionMin
                      const maxStep = Math.max(15, Math.floor(b.duracionMin / 15) * 15)
                      const opciones: number[] = []
                      for (let m = 15; m <= maxStep; m += 15) opciones.push(m)
                      if (!opciones.includes(b.duracionMin)) opciones.push(b.duracionMin)
                      opciones.sort((a, b) => a - b)
                      return (
                        <div key={b.id} className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-semibold text-secondary">
                              <Check className="size-3 text-emerald-600" />
                              {b.boxLabel} {b.inicio}-{b.fin}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">{formatMinutes(duracionActual)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary/80">
                            <span>Reserva este bloque por</span>
                            <select className="h-8 rounded-lg border border-border/60 bg-white px-2" value={duracionActual} onChange={(e) => setDurationForBlock(b.id, Number(e.target.value))}>
                              {opciones.map((m) => (
                                <option key={m} value={m}>{formatMinutes(m)}</option>
                              ))}
                            </select>
                            <span>(mínimo 15 minutos)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Button className="w-full" size="lg" disabled={resumenSeleccion.cantidad === 0} onClick={() => {
                  if (resumenSeleccion.cantidad === 0) return
                  setShowConfirm(true)
                }}>
                  Reservar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de reservas</CardTitle>
              <CardDescription>Pasadas y futuras para referencia rápida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/70">Próximas</p>
                <div className="space-y-2">
                  {history.future.slice(0, 4).map((h) => (
                    <div key={`${h.fecha}-${h.inicio}`} className="flex justify-between rounded-lg border border-border/60 bg-secondary/5 px-3 py-2">
                      <span>{fmtDia.format(parseISODate(h.fecha)!)}</span>
                      <span className="text-xs text-secondary/70">{h.inicio}-{h.fin} · Box {h.boxId ?? ""}</span>
                    </div>
                  ))}
                  {history.future.length === 0 && <p className="text-xs text-secondary/60">Sin reservas futuras</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary/70">Pasadas</p>
                <div className="space-y-2">
                  {history.past.slice(-4).map((h) => (
                    <div key={`${h.fecha}-${h.inicio}`} className="flex justify-between rounded-lg border border-border/60 bg-secondary/5 px-3 py-2">
                      <span>{fmtDia.format(parseISODate(h.fecha)!)}</span>
                      <span className="text-xs text-secondary/70">{h.inicio}-{h.fin} · Box {h.boxId ?? ""}</span>
                    </div>
                  ))}
                  {history.past.length === 0 && <p className="text-xs text-secondary/60">Sin historial</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">Confirmación</p>
              <h3 className="text-xl font-semibold text-secondary">Seguro que quieres reservar estos bloques?</h3>
              <p className="text-sm text-muted-foreground">Validaremos los bloques seleccionados y los marcaremos como reservados.</p>
            </div>

            {resumenSeleccion.picked.length > 0 && (
              <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-secondary/5 px-4 py-3 text-sm text-secondary">
                {resumenSeleccion.picked.map((b) => {
                  const duracionActual = customDurations[b.id] ?? b.duracionMin
                  return (
                    <div key={b.id} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold">{b.boxLabel}</span>
                        <span className="text-[12px] text-secondary/70">{b.inicio} - {b.fin}</span>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-secondary">{formatMinutes(duracionActual)}</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-secondary/80">
                  <span>Total</span>
                  <span className="font-semibold text-secondary">{formatMinutes(resumenSeleccion.minutos)}</span>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
              <Button onClick={() => {
                const payload = resumenSeleccion.picked.map((b) => ({ id: b.id, minutos: customDurations[b.id] ?? b.duracionMin }))
                reservaMut.mutate(payload)
              }} disabled={resumenSeleccion.cantidad === 0 || reservaMut.isPending}>
                {reservaMut.isPending ? "Confirmando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
