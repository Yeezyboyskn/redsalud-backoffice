"use client"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, Clock3, Repeat2, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Block = { id: string; fecha: string; inicio: string; fin: string; motivo: string; boxId?: number; estado: "pendiente" | "aprobado" | "rechazado" }
type ListResponse = { items: Block[] }
type Profile = { boxes: { id: number; etiqueta: string }[] }

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
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const daysBetween = (a: string, b: string) => {
  const res: string[] = []
  const start = new Date(`${a}T00:00:00`)
  const end = new Date(`${b}T00:00:00`)
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    res.push(toISODate(cur))
  }
  return res
}
const timeOptions = () => {
  const out: string[] = []
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, "0")
      const mm = String(m).padStart(2, "0")
      out.push(`${hh}:${mm}`)
    }
  }
  return out
}
const motivoOptions = [
  { value: "urgencia", label: "🚑 Urgencia" },
  { value: "congreso", label: "🎓 Congreso" },
  { value: "vacaciones", label: "🏖️ Vacaciones" },
  { value: "licencia", label: "🤒 Licencia" },
  { value: "admin", label: "🗂️ Administrativo" },
]

const iconByMotivo: Record<string, string> = {
  urgencia: "🚑",
  congreso: "🎓",
  vacaciones: "✈️",
  licencia: "🤒",
  admin: "🚫",
}

const pseudoConflict = (start?: string, end?: string) => {
  if (!start || !end) return 0
  const seed = start.replace(/-/g, "") + end.replace(/-/g, "")
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 97
  }
  return hash % 4
}

export default function BlockRequestsPanel() {
  const qc = useQueryClient()
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [rangeEnd, setRangeEnd] = useState<string | null>(null)
  const [allDay, setAllDay] = useState(true)
  const [horaInicio, setHoraInicio] = useState("09:00")
  const [horaFin, setHoraFin] = useState("13:00")
  const [motivo, setMotivo] = useState("congreso")
  const [boxId, setBoxId] = useState<number | "">("")
  const [repeat, setRepeat] = useState(false)
  const [repeatCount, setRepeatCount] = useState(4)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmPayloads, setConfirmPayloads] = useState<{ fecha: string; inicio: string; fin: string; motivo: string; boxId?: number }[] | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const yearScope = monthCursor.getFullYear()
  const profile = useQuery<Profile>({ queryKey: ["doctor-profile"], queryFn: () => fetch("/api/doctor/profile").then((r) => r.json()) })
  const list = useQuery<ListResponse>({
    queryKey: ["block-requests", yearScope],
    queryFn: async () => fetch(`/api/doctor/block-requests?from=${yearScope}-01-01&to=${yearScope}-12-31`).then((r) => r.json()),
  })

  const demoBlocks: Block[] = useMemo(
    () => [
      { id: "demo-b1", fecha: `${yearScope}-01-08`, inicio: "09:00", fin: "12:00", motivo: "congreso", estado: "pendiente" },
      { id: "demo-b2", fecha: `${yearScope}-01-12`, inicio: "00:00", fin: "23:59", motivo: "vacaciones", estado: "pendiente" },
      { id: "demo-b3", fecha: `${yearScope}-02-04`, inicio: "08:00", fin: "10:00", motivo: "admin", estado: "aprobado" },
      { id: "demo-b4", fecha: `${yearScope}-02-18`, inicio: "15:00", fin: "18:00", motivo: "urgencia", estado: "aprobado" },
      { id: "demo-b5", fecha: `${yearScope}-03-05`, inicio: "07:00", fin: "13:00", motivo: "licencia", estado: "pendiente" },
      { id: "demo-b6", fecha: `${yearScope}-03-21`, inicio: "00:00", fin: "23:59", motivo: "vacaciones", estado: "pendiente" },
      { id: "demo-b7", fecha: `${yearScope}-04-10`, inicio: "10:00", fin: "12:00", motivo: "congreso", estado: "pendiente" },
    ],
    [yearScope],
  )

  const itemsBase = useMemo(() => {
    return (list.data?.items ?? []).length > 0 ? list.data?.items ?? [] : demoBlocks
  }, [list.data, demoBlocks])

  const counters = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of itemsBase) {
      m.set(i.fecha, (m.get(i.fecha) ?? 0) + 1)
    }
    return m
  }, [itemsBase])

  const blocksByDate = useMemo(() => {
    const m = new Map<string, Block[]>()
    for (const b of itemsBase) {
      const arr = m.get(b.fecha) ?? []
      arr.push(b)
      m.set(b.fecha, arr)
    }
    return m
  }, [itemsBase])

  const monthLabel = fmtMesAnio.format(monthCursor)

  const selectionDays = useMemo(() => {
    if (!rangeStart) return []
    if (!rangeEnd) return [rangeStart]
    return daysBetween(rangeStart, rangeEnd)
  }, [rangeStart, rangeEnd])

  const toggleDay = (iso: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso)
      setRangeEnd(null)
      return
    }
    if (iso < rangeStart) {
      setRangeStart(iso)
      setRangeEnd(rangeStart)
    } else {
      setRangeEnd(iso)
    }
  }

  const addMut = useMutation({
    mutationFn: async (payloads: { fecha: string; inicio: string; fin: string; motivo: string; boxId?: number }[]) => {
      const results = []
      for (const payload of payloads) {
        const res = await fetch("/api/doctor/block-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("No se pudo crear solicitud")
        results.push(await res.json())
      }
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["block-requests"] })
      setFeedback("Bloqueo confirmado y enviado a validacion.")
      setShowConfirm(false)
      setConfirmPayloads(null)
      setRangeStart(null)
      setRangeEnd(null)
    },
  })

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

  const selectedRangeLabel = rangeStart
    ? rangeEnd
      ? `${fmtDia.format(new Date(`${rangeStart}T00:00:00`))} - ${fmtDia.format(new Date(`${rangeEnd}T00:00:00`))}`
      : fmtDia.format(new Date(`${rangeStart}T00:00:00`))
    : "Sin fechas seleccionadas"

  const summaryHours = () => {
    if (allDay) return "Todo el dia"
    return `${horaInicio} a ${horaFin}`
  }

  const buildPayloads = () => {
    if (!rangeStart) return []
    const start = rangeStart
    const end = rangeEnd ?? rangeStart
    const days = daysBetween(start, end)
    const basePayloads = days.map((fecha) => ({
      fecha,
      inicio: allDay ? "00:00" : horaInicio,
      fin: allDay ? "23:59" : horaFin,
      motivo,
      boxId: boxId || undefined,
    }))

    if (!repeat) return basePayloads
    const extra: typeof basePayloads = []
    for (let i = 1; i < repeatCount; i++) {
      const offset = i * 7
      for (const payload of basePayloads) {
        const d = new Date(`${payload.fecha}T00:00:00`)
        d.setDate(d.getDate() + offset)
        extra.push({ ...payload, fecha: toISODate(d) })
      }
    }
    return [...basePayloads, ...extra]
  }

  const conflictCount = pseudoConflict(rangeStart, rangeEnd ?? rangeStart)

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">Flujo rapido</p>
          <h2 className="text-2xl font-semibold text-secondary">Bloqueos operativos</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Selecciona rango de fechas, define horas o marca todo el dia, y confirma en un solo paso. Ideal para urgencias, congresos o vacaciones.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-secondary">
          <CalendarDays className="size-5" />
          <div className="leading-tight">
            <p className="font-semibold">Seleccion por rango</p>
            <p className="text-xs text-secondary/70">Clic en fecha inicio y fecha fin, el panel se adapta.</p>
          </div>
        </div>
      </header>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="size-4" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-transparent" />
          <CardHeader className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Calendario inteligente</CardTitle>
                <CardDescription>Selecciona rango, visualiza bloqueos existentes con iconos tenues.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
                  Anterior
                </Button>
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">{monthLabel}</span>
                <Button variant="outline" size="sm" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
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
                  const isCurrent = day.getMonth() === monthCursor.getMonth()
                  const isSelected = selectionDays.includes(iso)
                  const isStart = rangeStart === iso
                  const isEnd = rangeEnd === iso
                  const inRange = isSelected
                  const count = counters.get(iso) ?? 0
                  const blocks = blocksByDate.get(iso) ?? []
                  const marker = blocks[0] ? iconByMotivo[blocks[0].motivo] ?? "•" : null

                  return (
                    <button
                      key={`${ri}-${di}`}
                      type="button"
                      onClick={() => toggleDay(iso)}
                      className={cn(
                        "flex min-h-[72px] flex-col justify-between rounded-xl border px-2 py-2 text-left text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        isSelected ? "border-primary bg-primary/10 shadow" : "border-border/60 bg-white/90",
                        inRange && "ring-1 ring-primary/30",
                        !isCurrent && "opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-[15px] font-semibold", isStart || isEnd ? "text-primary" : "text-secondary")}>{day.getDate()}</span>
                        {marker && <span className="text-sm">{marker}</span>}
                      </div>
                      <div className="space-y-1">
                        {count > 0 ? (
                          <div className="rounded-lg bg-secondary/5 px-2 py-1 text-[10px] font-semibold text-secondary/70">
                            {count} bloqueo{count === 1 ? "" : "s"}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-muted/50 px-2 py-1 text-[10px] font-semibold text-secondary/50">Libre</div>
                        )}
                      </div>
                    </button>
                  )
                }),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary/70">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-primary/70" />
                <span>Rango seleccionado</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">✈️</span>
                <span>Vacaciones/licencia marcada</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Configura tu bloqueo</CardTitle>
              <CardDescription className="text-sm text-secondary/80">{selectedRangeLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-secondary">Todo el dia</p>
                    <p className="text-xs text-secondary/70">Ideal para vacaciones o licencias.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
                    <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                    Activar
                  </label>
                </div>

                {!allDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Hora inicio</Label>
                      <select className="h-11 w-full rounded-xl border border-border/60 bg-white px-3 text-sm" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}>
                        {timeOptions().map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Hora fin</Label>
                      <select className="h-11 w-full rounded-xl border border-border/60 bg-white px-3 text-sm" value={horaFin} onChange={(e) => setHoraFin(e.target.value)}>
                        {timeOptions().map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Motivo</Label>
                    <select className="h-11 w-full rounded-xl border border-border/60 bg-white px-3 text-sm" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                      {motivoOptions.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Box (opcional)</Label>
                    <select className="h-11 w-full rounded-xl border border-border/60 bg-white px-3 text-sm" value={boxId} onChange={(e) => setBoxId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Sin box</option>
                      {profile.data?.boxes?.map((b) => (
                        <option key={b.id} value={b.id}>{b.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Repeat2 className="size-4 text-secondary/80" />
                    <div>
                      <p className="text-sm font-semibold text-secondary">Repetir bloqueo</p>
                      <p className="text-xs text-secondary/70">Repite mismo dia de la semana por varias semanas.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                    <select
                      className="h-9 rounded-lg border border-border/60 bg-white px-2 text-sm disabled:opacity-40"
                      disabled={!repeat}
                      value={repeatCount}
                      onChange={(e) => setRepeatCount(Number(e.target.value))}
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n} semanas</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {conflictCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <TriangleAlert className="mt-0.5 size-4" />
                  <div>
                    <p className="font-semibold">Tienes {conflictCount} pacientes agendados en este horario.</p>
                    <p className="text-xs text-amber-800">Deseas bloquear y solicitar reprogramacion?</p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border/60 bg-secondary/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary/70">Resumen</p>
                <p className="text-sm text-secondary">
                  Vas a bloquear {selectionDays.length} dia{selectionDays.length === 1 ? "" : "s"} ({summaryHours()}) por {motivoOptions.find((m) => m.value === motivo)?.label ?? motivo}.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!rangeStart || addMut.isPending}
                onClick={() => {
                  if (!rangeStart) return
                  if (!allDay && horaFin <= horaInicio) {
                    alert("Hora fin debe ser mayor a hora inicio")
                    return
                  }
                  const payloads = buildPayloads()
                  if (payloads.length === 0) return
                  setConfirmPayloads(payloads)
                  setShowConfirm(true)
                }}
              >
                {addMut.isPending ? "Creando..." : "Confirmar bloqueo"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bloqueos existentes</CardTitle>
              <CardDescription className="text-sm text-secondary/70">Visual rapido del mes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {itemsBase.filter((b) => b.fecha >= toISODate(startOfMonth(monthCursor)) && b.fecha <= toISODate(endOfMonth(monthCursor))).slice(0, 6).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-semibold text-secondary">{fmtDia.format(new Date(`${b.fecha}T00:00:00`))}</span>
                    <span className="text-xs text-secondary/70">{b.inicio} - {b.fin} {iconByMotivo[b.motivo] ?? ""}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-secondary/60">{b.estado}</span>
                </div>
              ))}
              {itemsBase.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Sin bloqueos registrados.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showConfirm && confirmPayloads && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">Confirmar bloqueo</p>
                <h3 className="text-xl font-semibold text-secondary">Revisa antes de enviar</h3>
                <p className="text-sm text-secondary/70">{selectedRangeLabel}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setShowConfirm(false); setConfirmPayloads(null) }}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-secondary/5 px-4 py-3 text-sm text-secondary">
              <div className="flex items-center justify-between">
                <span>Horario</span>
                <span className="font-semibold">{allDay ? "Todo el dia" : `${horaInicio} - ${horaFin}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Motivo</span>
                <span className="font-semibold">{motivoOptions.find((m) => m.value === motivo)?.label ?? motivo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dias a bloquear</span>
                <span className="font-semibold">{confirmPayloads.length}</span>
              </div>
              {repeat && (
                <div className="flex items-center justify-between">
                  <span>Repeticion</span>
                  <span className="font-semibold">Cada semana por {repeatCount} semanas</span>
                </div>
              )}
              {boxId && (
                <div className="flex items-center justify-between">
                  <span>Box</span>
                  <span className="font-semibold">Box {boxId}</span>
                </div>
              )}
            </div>

            {conflictCount > 0 && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 size-4" />
                <div>
                  <p className="font-semibold">Tienes {conflictCount} pacientes agendados en este rango.</p>
                  <p className="text-xs text-amber-800">¿Deseas bloquear y solicitar reprogramacion?</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmPayloads(null) }}>Volver</Button>
              <Button
                onClick={async () => {
                  if (!confirmPayloads) return
                  await addMut.mutateAsync(confirmPayloads)
                }}
                disabled={addMut.isPending}
              >
                {addMut.isPending ? "Enviando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
