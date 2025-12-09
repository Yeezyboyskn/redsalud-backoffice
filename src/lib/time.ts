export const minutesBetween = (inicio: string, fin: string) => {
  const [hi, mi] = inicio.split(":").map(Number)
  const [hf, mf] = fin.split(":").map(Number)
  return hf * 60 + mf - (hi * 60 + mi)
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export const toHourString = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export type Interval = { start: number; end: number }

export function subtractIntervals(base: Interval, busy: Interval[], minDuration = 15): Interval[] {
  let segments: Interval[] = [base]
  const ordered = busy
    .map((b) => ({ start: Math.max(base.start, b.start), end: Math.min(base.end, b.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)
  for (const b of ordered) {
    const next: Interval[] = []
    for (const seg of segments) {
      if (b.end <= seg.start || b.start >= seg.end) {
        next.push(seg)
        continue
      }
      if (b.start > seg.start) next.push({ start: seg.start, end: b.start })
      if (b.end < seg.end) next.push({ start: b.end, end: seg.end })
    }
    segments = next
  }
  return segments.filter((s) => s.end - s.start >= minDuration)
}
