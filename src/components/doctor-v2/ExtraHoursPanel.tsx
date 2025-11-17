"use client"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import MiniCalendar from "./MiniCalendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ExtraHour = { id: string; fecha: string; inicio: string; fin: string; boxId?: number }
type ListResponse = { items: ExtraHour[] }
type WeeklyItem = { dia_semana: number; inicio: string; fin: string; box?: number | null; frecuencia_min?: number | null }
type WeeklyResponse = { items: WeeklyItem[] }

const fmtMesAnio = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
const toISODate = (d: Date) => d.toISOString().slice(0, 10)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

export default function ExtraHoursPanel() {
  const qc = useQueryClient()
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(toISODate(new Date()))
  const [duracion, setDuracion] = useState<number>(60)

  const from = toISODate(startOfMonth(monthCursor))
  const to = toISODate(endOfMonth(monthCursor))

  const list = useQuery<ListResponse>({
    queryKey: ["extra-hours", from, to],
    queryFn: async () => (await fetch(`/api/doctor/extra-hours?from=${from}&to=${to}`)).json(),
  })

  const weekly = useQuery<WeeklyResponse>({
    queryKey: ["weekly-slots"],
    queryFn: async () => (await fetch(`/api/doctor/weekly-slots`)).json(),
  })

  const counters = useMemo(() => {
    const map = new Map<string, number>()
    ;(list.data?.items ?? []).forEach((i) => map.set(i.fecha, (map.get(i.fecha) ?? 0) + 1))
    return map
  }, [list.data])

  const addMut = useMutation({
    mutationFn: async (payload: { fecha: string; inicio: string; fin: string }) => {
      const res = await fetch("/api/doctor/extra-hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("No se pudo crear")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extra-hours"] }),
  })

  const updateMut = useMutation({
    mutationFn: async (payload: Partial<ExtraHour> & { id: string }) => {
      const res = await fetch("/api/doctor/extra-hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("No se pudo actualizar")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extra-hours"] }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/doctor/extra-hours?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("No se pudo eliminar")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extra-hours"] }),
  })

  const monthLabel = fmtMesAnio.format(monthCursor)

  const itemsDia = (list.data?.items ?? []).filter((i) => i.fecha === selectedDate)

  const dow = selectedDate ? new Date(selectedDate).getUTCDay() : null
  const sugeridasDia = useMemo(() => {
    if (!dow) return [] as WeeklyItem[]
    return (weekly.data?.items ?? []).filter((w) => w.dia_semana === dow)
  }, [weekly.data, dow])

  const generarHoras = () => {
    const paso = 15 // granularidad fina
    const inicio = 8 * 60
    const fin = 20 * 60
    const max = fin - duracion
    const out: string[] = []
    for (let t = inicio; t <= max; t += paso) {
      const h = String(Math.floor(t / 60)).padStart(2, "0")
      const m = String(t % 60).padStart(2, "0")
      out.push(`${h}:${m}`)
    }
    return out
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Horas extras / recuperativas</h2>
        <p className="text-sm text-muted-foreground">Calendario mensual + listado de horas del día seleccionado. Puedes agregar, editar o eliminar tramos.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <MiniCalendar
          monthCursor={monthCursor}
          monthLabel={monthLabel}
          selectedDate={selectedDate}
          onSelectDate={(iso) => setSelectedDate(iso)}
          onPrevMonth={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
          onNextMonth={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
          counters={counters}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Tramos del día</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Duración</Label>
              <select className="h-9 rounded-lg border border-border/60 bg-white/80 px-2 text-xs" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
          </div>

          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto pr-1">
            {selectedDate ? (
              generarHoras().map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const [hh, mm] = h.split(":")
                    const startMin = Number(hh) * 60 + Number(mm)
                    const endMin = startMin + duracion
                    const hh2 = String(Math.floor(endMin / 60)).padStart(2, "0")
                    const mm2 = String(endMin % 60).padStart(2, "0")
                    const label = `${selectedDate} · ${h}-${hh2}:${mm2}`
                    if (window.confirm(`¿Agregar tramo?\n\n${label}`)) {
                      addMut.mutate({ fecha: selectedDate!, inicio: h, fin: `${hh2}:${mm2}` })
                    }
                  }}
                  className="rounded-lg border border-border/60 bg-white px-3 py-2 text-sm font-semibold text-secondary/80 hover:border-primary/60 hover:bg-primary/5"
                >
                  {h}
                </button>
              ))
            ) : (
              <div className="col-span-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Selecciona un día.</div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Publicadas</h4>
            <ul className="space-y-2">
              {itemsDia.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-white px-3 py-2 text-sm">
                  <span className="font-semibold text-secondary">{i.inicio} - {i.fin}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nuevo = prompt("Nueva hora de inicio (HH:MM)", i.inicio)
                        if (!nuevo) return
                        updateMut.mutate({ id: i.id, inicio: nuevo })
                      }}
                    >Editar</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => window.confirm("¿Eliminar tramo?") && deleteMut.mutate(i.id)}
                    >Eliminar</Button>
                  </div>
                </li>
              ))}
              {itemsDia.length === 0 && <li className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">No hay tramos publicados para este día.</li>}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Sugerencias desde plantilla</h4>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto pr-1">
              {selectedDate && sugeridasDia.length > 0 ? (
                sugeridasDia.map((s, idx) => (
                  <button
                    key={`${s.inicio}-${idx}`}
                    type="button"
                    onClick={() => {
                      const label = `${selectedDate} · ${s.inicio}-${s.fin}${s.box ? ` · Box ${s.box}` : ""}`
                      if (window.confirm(`¿Publicar tramo sugerido?\n\n${label}`)) {
                        addMut.mutate({ fecha: selectedDate!, inicio: s.inicio, fin: s.fin })
                      }
                    }}
                    className="rounded-lg border border-dashed border-border/60 bg-white px-3 py-2 text-sm font-semibold text-secondary/80 hover:border-primary/60 hover:bg-primary/5"
                  >
                    {s.inicio} - {s.fin}
                  </button>
                ))
              ) : (
                <div className="col-span-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Sin sugerencias para este día.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
