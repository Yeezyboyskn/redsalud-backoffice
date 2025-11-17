"use client"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import MiniCalendar from "./MiniCalendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Block = { id: string; fecha: string; inicio: string; fin: string; motivo: string; boxId?: number; estado: "pendiente" | "aprobado" | "rechazado" }
type ListResponse = { items: Block[] }
type Profile = { boxes: { id: number; etiqueta: string }[] }

const fmtMesAnio = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
const toISODate = (d: Date) => d.toISOString().slice(0, 10)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

export default function BlockRequestsPanel() {
  const qc = useQueryClient()
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(toISODate(new Date()))
  const [duracion, setDuracion] = useState<number>(120)
  const [inicio, setInicio] = useState<string>("08:00")
  const [motivo, setMotivo] = useState<string>("")
  const [boxId, setBoxId] = useState<number | "">("")

  const profile = useQuery<Profile>({ queryKey: ["doctor-profile"], queryFn: () => fetch("/api/doctor/profile").then((r) => r.json()) })

  const from = toISODate(startOfMonth(monthCursor))
  const to = toISODate(endOfMonth(monthCursor))

  const list = useQuery<ListResponse>({ queryKey: ["block-requests", from, to], queryFn: () => fetch(`/api/doctor/block-requests?from=${from}&to=${to}`).then((r) => r.json()) })
  const counters = useMemo(() => {
    const m = new Map<string, number>()
    ;(list.data?.items ?? []).forEach((i) => m.set(i.fecha, (m.get(i.fecha) ?? 0) + 1))
    return m
  }, [list.data])

  const monthLabel = fmtMesAnio.format(monthCursor)

  const addMut = useMutation({
    mutationFn: async (payload: { fecha: string; inicio: string; fin: string; motivo: string; boxId?: number }) => {
      const res = await fetch("/api/doctor/block-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("No se pudo crear solicitud")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["block-requests"] })
      setMotivo("")
    },
  })

  const itemsDia = (list.data?.items ?? []).filter((i) => i.fecha === selectedDate)

  const generarHoras = () => {
    const paso = 30
    const arr: string[] = []
    for (let h = 8; h <= 19; h++) {
      for (const mm of ["00", "30"]) {
        const hh = String(h).padStart(2, "0")
        arr.push(`${hh}:${mm}`)
      }
    }
    return arr
  }

  const calcularFin = (ini: string) => {
    const [h, m] = ini.split(":").map(Number)
    const total = h * 60 + m + duracion
    const hh = String(Math.floor(total / 60)).padStart(2, "0")
    const mm = String(total % 60).padStart(2, "0")
    return `${hh}:${mm}`
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Bloqueos operativos</h2>
        <p className="text-sm text-muted-foreground">Selecciona día y hora para solicitar un bloqueo. Queda en estado pendiente para validación.</p>
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
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Box asignado</Label>
              <select className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm" value={boxId} onChange={(e) => setBoxId(e.target.value ? Number(e.target.value) : "") }>
                <option value="">Selecciona</option>
                {profile.data?.boxes?.map((b) => (
                  <option key={b.id} value={b.id}>{b.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hora de inicio</Label>
              <div className="grid max-h-44 grid-cols-2 gap-2 overflow-auto pr-1">
                {selectedDate ? (
                  generarHoras().map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setInicio(h)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${inicio === h ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-white text-secondary/80"}`}
                    >
                      {h}
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Selecciona un día.</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duración</Label>
              <select className="h-11 w-full rounded-xl border border-border/60 bg-white/80 px-4 text-sm" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Enfermedad, capacitación, personal, etc." />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!selectedDate || !inicio || !motivo.trim()) return alert("Completa fecha, hora y motivo")
                const fin = calcularFin(inicio)
                const resumen = `${selectedDate} · ${inicio}-${fin}${boxId ? ` · Box ${boxId}` : ""}`
                if (window.confirm(`¿Enviar solicitud de bloqueo?\n\n${resumen}\nMotivo: ${motivo.trim()}`)) {
                  addMut.mutate({ fecha: selectedDate, inicio, fin, motivo: motivo.trim(), boxId: boxId || undefined })
                }
              }}
            >
              Enviar solicitud
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/70">Solicitudes del día</h4>
            <ul className="space-y-2">
              {itemsDia.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-white px-3 py-2 text-sm">
                  <span className="font-semibold text-secondary">{i.inicio}-{i.fin}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-secondary/60">{i.estado}</span>
                </li>
              ))}
              {itemsDia.length === 0 && <li className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">Sin solicitudes para este día.</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

