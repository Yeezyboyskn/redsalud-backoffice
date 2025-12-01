"use client"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CalendarDays, Check, Clock3, MapPin, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ExtraHour = { id: string; fecha: string; inicio: string; fin: string; boxId?: number }
type ListResponse = { items: ExtraHour[] }
type WeeklyItem = { dia_semana: number; inicio: string; fin: string; box?: number | null; frecuencia_min?: number | null; piso?: number | null }
type WeeklyResponse = { items: WeeklyItem[] }
type EnrichedBlock = ExtraHour & { piso?: number | null; duracionMin: number; boxLabel: string }

const YEAR_SCOPE = 2025
const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const fmtMesAnio = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
const fmtDia = new Intl.DateTimeFormat("es-CL", { weekday: "long", month: "long", day: "numeric" })

const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
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
  const initialMonth = today.getFullYear() === YEAR_SCOPE ? startOfMonth(today) : new Date(YEAR_SCOPE, 0, 1)
  const [monthCursor, setMonthCursor] = useState<Date>(initialMonth)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set())
  const [customDurations, setCustomDurations] = useState<Record<string, number>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const list = useQuery<ListResponse>({
    queryKey: ["extra-hours", YEAR_SCOPE],
    queryFn: async () => (await fetch(`/api/doctor/extra-hours?from=${YEAR_SCOPE}-01-01&to=${YEAR_SCOPE}-12-31`)).json(),
  })

  const weekly = useQuery<WeeklyResponse>({
    queryKey: ["weekly-slots"],
    queryFn: async () => (await fetch(`/api/doctor/weekly-slots`)).json(),
  })

  const demoItems: ExtraHour[] = useMemo(
    () => [
      { id: "demo-1", fecha: `${YEAR_SCOPE}-01-06`, inicio: "08:00", fin: "08:30", boxId: 2 },
      { id: "demo-2", fecha: `${YEAR_SCOPE}-01-06`, inicio: "08:45", fin: "09:30", boxId: 3 },
      { id: "demo-3", fecha: `${YEAR_SCOPE}-01-09`, inicio: "10:00", fin: "11:00", boxId: 5 },
      { id: "demo-4", fecha: `${YEAR_SCOPE}-01-12`, inicio: "15:00", fin: "15:45", boxId: 1 },
      { id: "demo-5", fecha: `${YEAR_SCOPE}-01-15`, inicio: "18:00", fin: "19:00", boxId: 4 },
      { id: "demo-6", fecha: `${YEAR_SCOPE}-02-01`, inicio: "09:15", fin: "10:00", boxId: 6 },
      { id: "demo-7", fecha: `${YEAR_SCOPE}-01-20`, inicio: "07:30", fin: "08:15", boxId: 2 },
      { id: "demo-8", fecha: `${YEAR_SCOPE}-01-20`, inicio: "12:00", fin: "13:00", boxId: 3 },
      { id: "demo-9", fecha: `${YEAR_SCOPE}-02-05`, inicio: "09:00", fin: "09:45", boxId: 4 },
      { id: "demo-10", fecha: `${YEAR_SCOPE}-02-05`, inicio: "16:00", fin: "17:00", boxId: 5 },
      { id: "demo-11", fecha: `${YEAR_SCOPE}-02-14`, inicio: "11:00", fin: "12:00", boxId: 1 },
      { id: "demo-12", fecha: `${YEAR_SCOPE}-03-03`, inicio: "08:30", fin: "09:30", boxId: 6 },
      { id: "demo-13", fecha: `${YEAR_SCOPE}-03-03`, inicio: "17:15", fin: "18:00", boxId: 4 },
      { id: "demo-14", fecha: `${YEAR_SCOPE}-03-10`, inicio: "14:00", fin: "15:00", boxId: 2 },
      { id: "demo-15", fecha: `${YEAR_SCOPE}-04-08`, inicio: "09:30", fin: "10:15", boxId: 5 },
      { id: "demo-16", fecha: `${YEAR_SCOPE}-04-08`, inicio: "18:00", fin: "19:00", boxId: 3 },
    ],
    [],
  )

  const itemsBase = useMemo(() => {
    return (list.data?.items ?? []).length > 0 ? list.data?.items ?? [] : demoItems
  }, [list.data, demoItems])

  const availableItems = useMemo(() => {
    return itemsBase.filter((i) => !bookedIds.has(i.id))
  }, [itemsBase, bookedIds])

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, ExtraHour[]>()
    for (const item of availableItems) {
      const arr = map.get(item.fecha) ?? []
      arr.push(item)
      map.set(item.fecha, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.inicio.localeCompare(b.inicio))
    }
    return map
  }, [availableItems])

  useEffect(() => {
    if (selectedDate || availabilityByDate.size === 0) return
    const first = Array.from(availabilityByDate.keys()).sort()[0]
    setSelectedDate(first)
  }, [availabilityByDate, selectedDate])

  useEffect(() => {
    if (!selectedDate) return
    if (!availabilityByDate.has(selectedDate)) {
      const next = Array.from(availabilityByDate.keys()).sort()[0] ?? null
      setSelectedBlocks(new Set())
      setSelectedDate(next ?? null)
    }
  }, [availabilityByDate, selectedDate])

  useEffect(() => {
    setSelectedBlocks(new Set())
    setCustomDurations({})
  }, [selectedDate])

  const pisosPorBox = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const item of weekly.data?.items ?? []) {
      if (typeof item.box === "number") {
        const piso = typeof (item as any).piso === "number" ? (item as any).piso : null
        map.set(item.box, piso)
      }
    }
    return map
  }, [weekly.data])

  const bloquesDelDia: EnrichedBlock[] = useMemo(() => {
    const bloques = selectedDate ? availabilityByDate.get(selectedDate) ?? [] : []
    return bloques
      .map((b) => {
        const piso = b.boxId ? pisosPorBox.get(b.boxId) ?? null : null
        return {
          ...b,
          piso,
          duracionMin: minutesBetween(b.inicio, b.fin),
          boxLabel: b.boxId ? `Box ${b.boxId}` : "Box sin asignar",
        }
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
  }, [availabilityByDate, pisosPorBox, selectedDate])

  const resumenSeleccion = useMemo(() => {
    const picked = bloquesDelDia.filter((b) => selectedBlocks.has(b.id))
    const minutos = picked.reduce((acc, b) => acc + (customDurations[b.id] ?? b.duracionMin), 0)
    return { cantidad: picked.length, minutos, picked }
  }, [bloquesDelDia, selectedBlocks, customDurations])

  const monthLabel = fmtMesAnio.format(monthCursor)
  const weeks = useMemo(() => {
    const start = startOfCalendarMonth(monthCursor)
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
    return rows
  }, [monthCursor])

  const minMonth = new Date(YEAR_SCOPE, 0, 1)
  const maxMonth = new Date(YEAR_SCOPE, 11, 1)
  const canPrev = monthCursor > minMonth
  const canNext = monthCursor < maxMonth

  const blockById = useMemo(() => new Map(bloquesDelDia.map((b) => [b.id, b])), [bloquesDelDia])

  const toggleBlock = (id: string) => {
    const target = blockById.get(id)
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
    onError: () => setFeedback("No pudimos confirmar la reserva. Intentalo nuevamente."),
  })

  const selectedDateLabel = selectedDate ? fmtDia.format(parseISODate(selectedDate)!) : ""
  const showResumen = Boolean(selectedDate && bloquesDelDia.length > 0)

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Rematador de box</p>
          <h2 className="text-2xl font-semibold text-secondary">Horas extras / recuperativas</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Selecciona dias con horas disponibles en 2025, explora los bloques por box y confirma tu reserva con un resumen claro antes de publicarla.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-inner">
          <CalendarDays className="size-5" />
          <div className="leading-tight">
            <p className="font-semibold">Anio {YEAR_SCOPE}</p>
            <p className="text-xs text-emerald-800">Dias verdes: disponibilidad lista para reservar</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-transparent" />
          <CardHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Calendario 2025</CardTitle>
                <CardDescription>Dias con horas disponibles aparecen en verde. Selecciona uno para ver los bloques.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => canPrev && setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
                  Anterior
                </Button>
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">{monthLabel}</span>
                <Button variant="outline" size="sm" disabled={!canNext} onClick={() => canNext && setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
                  Siguiente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/60">
              {weekDays.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weeks.map((row, ri) =>
                row.map((day, di) => {
                  const iso = toISODate(day)
                  const disponibles = availabilityByDate.get(iso)?.length ?? 0
                  const isInYear = day.getFullYear() === YEAR_SCOPE
                  const isSelected = selectedDate === iso
                  const isDisponible = disponibles > 0 && isInYear
                  const isMuted = day.getMonth() !== monthCursor.getMonth()
                  const isDisabled = !isDisponible

                  return (
                    <button
                      key={`${ri}-${di}`}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return
                        setSelectedDate(iso)
                        setFeedback(null)
                      }}
                      className={cn(
                        "flex min-h-[76px] flex-col justify-between rounded-xl border px-2 py-2 text-left text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed",
                        isSelected ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100" : "border-border/60 bg-white/90",
                        isMuted && "opacity-60",
                        isDisponible ? "hover:border-emerald-400 hover:bg-emerald-50" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-semibold text-secondary leading-none">{day.getDate()}</span>
                        {isDisponible && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
                      </div>
                      <div className="space-y-1">
                        {isDisponible ? (
                          <div className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                            {disponibles} bloque{disponibles === 1 ? "" : "s"}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-secondary/5 px-2 py-1 text-[11px] font-semibold text-secondary/50">Sin disponibilidad</div>
                        )}
                      </div>
                    </button>
                  )
                }),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary/70">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span>Dia con horas disponibles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-secondary/10" />
                <span>Sin disponibilidad o fuera de 2025</span>
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

          {selectedDate && showResumen ? (
            <Card className="space-y-0">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Disponibilidad del dia</CardTitle>
                    <CardDescription className="text-sm text-secondary/80">
                      {selectedDateLabel}
                    </CardDescription>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    {bloquesDelDia.length} bloque{bloquesDelDia.length === 1 ? "" : "s"} para reservar
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold",
                              isSelected ? "bg-emerald-500 text-white" : "bg-secondary/10 text-secondary/70"
                            )}
                          >
                            {isSelected ? "Seleccionado" : "Disponible"}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm text-secondary/80">
                          <div className="flex items-center gap-2 font-semibold text-secondary">
                            <Clock3 className="size-4 text-emerald-600" />
                            <span>{b.inicio} - {b.fin}</span>
                          </div>
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

                <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-secondary">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Resumen de reserva</p>
                      <p className="text-sm text-secondary/80">
                        Estas reservando {resumenSeleccion.cantidad || 0} bloque{resumenSeleccion.cantidad === 1 ? "" : "s"}: total {formatMinutes(resumenSeleccion.minutos)}.
                      </p>
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
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                {formatMinutes(duracionActual)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary/80">
                              <span>Reserva este bloque por</span>
                              <select
                                className="h-8 rounded-lg border border-border/60 bg-white px-2"
                                value={duracionActual}
                                onChange={(e) => setDurationForBlock(b.id, Number(e.target.value))}
                              >
                                {opciones.map((m) => (
                                  <option key={m} value={m}>{formatMinutes(m)}</option>
                                ))}
                              </select>
                              <span>(minimo 15 minutos)</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={resumenSeleccion.cantidad === 0}
                    onClick={() => {
                      if (resumenSeleccion.cantidad === 0) return
                      setShowConfirm(true)
                    }}
                  >
                    Reservar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selecciona un dia con disponibilidad</CardTitle>
                <CardDescription>El panel se activara cuando elijas un dia en verde del calendario 2025.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/5 px-4 py-6 text-sm text-muted-foreground">
                  Busca los dias marcados en verde para ver y reservar bloques de box con su piso y horario.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">Confirmacion</p>
              <h3 className="text-xl font-semibold text-secondary">Seguro que quieres reservar este box?</h3>
              <p className="text-sm text-muted-foreground">
                Validaremos los bloques seleccionados y los marcaremos como reservados. Puedes cancelar si quieres revisar otra fecha.
              </p>
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
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-secondary">
                        {formatMinutes(duracionActual)}
                      </span>
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
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Rechazar</Button>
              <Button
                onClick={() => {
                  const payload = resumenSeleccion.picked.map((b) => ({ id: b.id, minutos: customDurations[b.id] ?? b.duracionMin }))
                  reservaMut.mutate(payload)
                }}
                disabled={resumenSeleccion.cantidad === 0 || reservaMut.isPending}
              >
                {reservaMut.isPending ? "Confirmando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
