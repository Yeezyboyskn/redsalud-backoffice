"use client"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

const semanaLabelCorta = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

const toISODate = (d: Date) => d.toISOString().slice(0, 10)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const startOfCalendarMonth = (d: Date) => {
  const first = startOfMonth(d)
  const day = first.getDay()
  const diff = (day + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - diff)
  return start
}
const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

export type MiniCalendarProps = {
  monthCursor: Date
  selectedDate?: string | null
  onSelectDate: (iso: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  monthLabel?: string
  counters?: Map<string, number>
}

export default function MiniCalendar({
  monthCursor,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  monthLabel,
  counters,
}: MiniCalendarProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onPrevMonth} className="rounded-lg border px-2 py-1 text-xs">Mes anterior</button>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
          {monthLabel}
        </div>
        <button onClick={onNextMonth} className="rounded-lg border px-2 py-1 text-xs">Mes siguiente</button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/60">
        {semanaLabelCorta.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weeks.map((row, ri) =>
          row.map((day, di) => {
            const iso = toISODate(day)
            const isSelected = selectedDate === iso
            const isCurrent = isSameMonth(day, monthCursor)
            const count = counters?.get(iso) ?? 0
            const today = toISODate(new Date()) === iso
            return (
              <button
                key={`${ri}-${di}`}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={cn(
                  "min-h-[88px] rounded-xl border px-2 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isSelected ? "border-primary bg-primary/10 shadow" : "border-border/60 bg-white/80",
                  !isCurrent && "opacity-60",
                  today && !isSelected ? "ring-1 ring-primary/40" : "",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-secondary">{day.getDate()}</span>
                  {count > 0 && (
                    <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/70">
                      {count}
                    </span>
                  )}
                </div>
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}

