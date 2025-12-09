/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { subtractIntervals, toHourString, toMinutes } from "@/lib/time"

const toISO = (d: Date) => d.toISOString().slice(0, 10)
const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "jefatura", "admin", "doctor"])
  } catch (res) {
    return res as NextResponse
  }
  const url = new URL(req.url)
  const from = url.searchParams.get("from") || toISO(new Date())
  const to = url.searchParams.get("to") || from
  const doctorRut = sanitizeRut(url.searchParams.get("doctorRut") || url.searchParams.get("rut") || req.cookies.get("rut")?.value || "")
  const includeAll = url.searchParams.get("all") === "true" || url.searchParams.get("especialidad") === "all" || !doctorRut
  const shareBlocked = url.searchParams.get("shareBlocked") === "true" || url.searchParams.get("includeReleased") === "true"
  const specialtyParamRaw = url.searchParams.get("especialidad") || url.searchParams.get("specialty") || ""
  const specialtyParam = specialtyParamRaw === "all" ? "" : specialtyParamRaw
  const maxDays = 730
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const days: string[] = []
  for (let d = new Date(start); d <= end && days.length < maxDays; d.setDate(d.getDate() + 1)) {
    days.push(toISO(d))
  }

  const db = await getDb()
  const doctorDocs = await db.collection("doctors").find().toArray()
  const doctorByRut = new Map<string, any>()
  for (const d of doctorDocs) {
    doctorByRut.set(sanitizeRut(d.rut || ""), d)
    if (d.rut_clean) doctorByRut.set(sanitizeRut(d.rut_clean), d)
  }
  const specialty = specialtyParam || doctorByRut.get(doctorRut)?.especialidad || ""

  const weeklyFilter: any = {}
  if (!includeAll && doctorRut) weeklyFilter.doctor_rut = doctorRut
  let weekly = await db.collection("weekly_slots_import").find(weeklyFilter).toArray()

  const blocksFilter: any = { fecha: { $gte: from, $lte: to }, estado: { $in: ["pendiente", "aprobado"] } }
  const blocksAll = await db.collection("block_requests").find(blocksFilter).toArray()

  const opsFilter: any = { fecha: { $gte: from, $lte: to } }
  const opsAll = await db.collection("operational_blocks").find(opsFilter).toArray()

  // Si no hay slots semanales cargados, generamos slots sintéticos para todos los boxes (horario base 09-13 y 14-18 lun-vie)
  if (weekly.length === 0) {
    const boxes = await db.collection("boxes").find().toArray()
    const synthetic: any[] = []
    for (let dow = 1; dow <= 5; dow++) {
      for (const box of boxes) {
        synthetic.push({
          doctor_rut: "",
          dia_semana: dow,
          inicio: "09:00",
          fin: "13:00",
          boxId: box.code ?? box.boxId ?? box.id ?? null,
          piso: box.floor ?? box.piso ?? null,
          especialidad: box.especialidad ?? null,
        })
        synthetic.push({
          doctor_rut: "",
          dia_semana: dow,
          inicio: "14:00",
          fin: "18:00",
          boxId: box.code ?? box.boxId ?? box.id ?? null,
          piso: box.floor ?? box.piso ?? null,
          especialidad: box.especialidad ?? null,
        })
      }
    }
    weekly = synthetic
  }

  // Map busy by date+box+doctor
  const busyByKey = new Map<string, { start: number; end: number }[]>()
  const addBusy = (fecha: string, boxId: any, doctor: any, inicio: string, fin: string) => {
    const key = `${fecha}|${boxId ?? "n/a"}|${doctor ?? "na"}`
    const arr = busyByKey.get(key) ?? []
    arr.push({ start: toMinutes(inicio), end: toMinutes(fin) })
    busyByKey.set(key, arr)
  }
  for (const b of blocksAll) addBusy(b.fecha, b.boxId, sanitizeRut(b.doctor_rut), b.inicio, b.fin)
  for (const b of opsAll) addBusy(b.fecha, b.boxId, sanitizeRut(b.doctor_rut), b.inicio, b.fin)

  const items: any[] = []

  const considerSlot = (slot: any, day: string) => {
    const slotDoctor = sanitizeRut(slot.doctor_rut || "")
    if (!includeAll && doctorRut && slotDoctor && slotDoctor !== doctorRut) return
    if (includeAll && specialty) {
      const doc = doctorByRut.get(slotDoctor)
      if (doc && doc.especialidad && doc.especialidad !== specialty) return
    }
    const base: [number, number] = [toMinutes(slot.inicio), toMinutes(slot.fin)]
    const key = `${day}|${slot.box ?? slot.boxId ?? "n/a"}|${slotDoctor || "na"}`
    const busy = busyByKey.get(key) ?? []
    const free = subtractIntervals({ start: base[0], end: base[1] }, busy, 15)
    for (const f of free) {
      items.push({
        fecha: day,
        inicio: toHourString(f.start),
        fin: toHourString(f.end),
        boxId: slot.box ?? slot.boxId ?? null,
        piso: slot.piso ?? doctorByRut.get(slotDoctor)?.pisos?.[0] ?? null,
        especialidad: slot.especialidad ?? doctorByRut.get(slotDoctor)?.especialidad ?? null,
        doctorRut: slotDoctor || null,
        fuente: "weekly_slots_import",
        audience: includeAll ? "especialidad" : "propio",
      })
    }
  }

  // 1) Disponibilidad propia (o de todos si includeAll)
  for (const day of days) {
    const dow = new Date(`${day}T00:00:00`).getDay() === 0 ? 7 : new Date(`${day}T00:00:00`).getDay()
    for (const slot of weekly) {
      const slotDow = typeof slot.dia_semana === "string" ? normalizeDow(slot.dia_semana) : Number(slot.dia_semana)
      if (slotDow !== dow) continue
      considerSlot(slot, day)
    }
  }

  // 2) Bloqueos aprobados compartidos por especialidad para que otros doctores puedan tomarlos como horas extra
  if (shareBlocked && specialty) {
    for (const b of blocksAll) {
      if (b.estado !== "aprobado") continue
      const owner = doctorByRut.get(sanitizeRut(b.doctor_rut))
      const ownerSpec = owner?.especialidad
      if (ownerSpec && ownerSpec !== specialty) continue
      items.push({
        fecha: b.fecha,
        inicio: b.inicio,
        fin: b.fin,
        boxId: b.boxId ?? null,
        piso: owner?.pisos?.[0] ?? null,
        especialidad: ownerSpec ?? null,
        doctorRut: sanitizeRut(b.doctor_rut),
        fuente: "bloqueo_aprobado",
        audience: "especialidad",
        compartido: true,
      })
    }
  }

  // Ordena por fecha e inicio
  items.sort((a, b) => (a.fecha === b.fecha ? a.inicio.localeCompare(b.inicio) : a.fecha.localeCompare(b.fecha)))

  return NextResponse.json({ items })
}

function normalizeDow(value: string | number | null | undefined) {
  if (typeof value === "number") return value === 0 ? 7 : value
  const v = String(value ?? "").toLowerCase()
  if (v.startsWith("lun")) return 1
  if (v.startsWith("mar")) return 2
  if (v.startsWith("mie") || v.startsWith("mié")) return 3
  if (v.startsWith("jue")) return 4
  if (v.startsWith("vie")) return 5
  if (v.startsWith("sab") || v.startsWith("sáb")) return 6
  if (v.startsWith("dom")) return 7
  return 0
}
