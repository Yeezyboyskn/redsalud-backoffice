/* eslint-disable no-console */
import path from "node:path"
import fs from "node:fs"
import XLSX from "xlsx"
import { MongoClient } from "mongodb"

const normalizeKey = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

function sheetToObjects(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  return rows.map((row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      out[normalizeKey(k)] = v
    }
    return out
  })
}

function parseHour(h) {
  if (!h) return null
  const m = String(h).match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`
  const num = Number(h)
  if (!Number.isNaN(num)) {
    const totalMin = Math.round(num * 24 * 60)
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0")
    const mm = String(totalMin % 60).padStart(2, "0")
    return `${hh}:${mm}`
  }
  return null
}

function parseRange(str) {
  if (!str) return []
  const parts = String(str).split(/\r?\n|\s*\/\s*|;|\|/).map((t) => t.trim()).filter(Boolean)
  const segs = []
  for (const p of parts) {
    const m = p.match(/(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})/i)
    if (m) segs.push({ inicio: parseHour(m[1]), fin: parseHour(m[2]) })
  }
  return segs
}

function parsePisos(value) {
  if (!value) return []
  const str = String(value)
  const parts = str.split(/[,/]|\s+/).map((p) => p.trim()).filter(Boolean)
  return parts.map((p) => {
    const n = Number(p)
    return Number.isNaN(n) ? p : n
  })
}

const DAYS = [
  { time: "lunes", box: "box_lunes", dow: 1 },
  { time: "martes", box: "box_martes", dow: 2 },
  { time: "miercoles", box: "box_miercoles", dow: 3 },
  { time: "jueves", box: "box_jueves", dow: 4 },
  { time: "viernes", box: "box_viernes", dow: 5 },
  { time: "sabado", box: "box_sabado", dow: 6 },
]

function guessFloorFromBox(box) {
  const n = Number(box)
  if (Number.isNaN(n)) return null
  return Math.floor(n / 100)
}

async function main() {
  const file = process.argv[2] || "horario y box new version.xlsx"
  const sheetName = process.argv[3] || "Horario"
  const filePath = path.resolve(process.cwd(), file)

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || "backoffice"
  if (!uri) throw new Error("MONGODB_URI no configurado")
  if (!fs.existsSync(filePath)) throw new Error(`No se encontró el archivo: ${filePath}`)

  console.log(`Leyendo: ${filePath}`)
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const sheet = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]]
  const rows = sheetToObjects(sheet)

  // Cargar catálogo de pisos por especialidad para ayudar a completar piso
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const specItems = await db.collection("specialty_floors").find({}).toArray()
  const norm = (s) => (s ? String(s).trim().toLowerCase() : "")
  const specMap = new Map(specItems.map((it) => [norm(it.especialidad), it.pisos]))

  const doctorsMap = new Map()
  const weekly = []

  for (const r of rows) {
    const rut = (r.rut || "").toString()
    if (!rut) continue
    const nombre = r.nombre || null
    const especialidad = r.especialidad || null
    const correo = (r.correo || "").toString().trim() || null
    const telefonoRaw = (r.telefono || "").toString()
    const telefono = telefonoRaw ? telefonoRaw.replace(/[^0-9+]/g, "").trim() : null
    const pisos = parsePisos(r.pisos)

    const doc = doctorsMap.get(rut) || { rut, nombre, especialidad, correo, telefono, pisos: new Set(), boxes: new Set() }
    for (const p of pisos) doc.pisos.add(String(p))

    for (const { time, box, dow } of DAYS) {
      const timeStr = r[time]
      const boxVal = r[box] != null ? Number(String(r[box]).match(/\d+/)?.[0]) : null
      if (boxVal) doc.boxes.add(String(boxVal))
      const segs = parseRange(timeStr)
      for (const seg of segs) {
        const pisoCandidates = Array.from(doc.pisos)
        let piso = null
        if (pisoCandidates.length === 1) piso = pisoCandidates[0]
        if (!piso) {
          const pisosSpec = specMap.get(norm(especialidad))
          if (Array.isArray(pisosSpec) && pisosSpec.length === 1) piso = pisosSpec[0]
        }
        if (!piso && boxVal) piso = guessFloorFromBox(boxVal)
        const pisoNum = piso != null && !Number.isNaN(Number(piso)) ? Number(piso) : null
        weekly.push({
          doctor_rut: rut,
          dia_semana: dow,
          inicio: seg.inicio,
          fin: seg.fin,
          box: boxVal ?? null,
          frecuencia_min: null,
          doctor_nombre: nombre,
          especialidad,
          piso: pisoNum,
        })
      }
    }
    doctorsMap.set(rut, doc)
  }

  const doctors = Array.from(doctorsMap.values()).map((d) => ({
    rut: d.rut,
    nombre: d.nombre,
    especialidad: d.especialidad,
    correo: d.correo || null,
    telefono: d.telefono || null,
    pisos: Array.from(d.pisos).map((p)=>(!Number.isNaN(Number(p))?Number(p):p)),
    boxes: Array.from(d.boxes),
  }))

  console.log(`Doctores=${doctors.length}, tramos_semana=${weekly.length}`)

  const dry = Boolean(process.env.SEED_DRY_RUN)
  if (dry) {
    console.log("SEED_DRY_RUN activo, no escribe")
    await client.close()
    return
  }

  // Persistir
  const doctorsColl = db.collection("doctors")
  await doctorsColl.createIndex({ rut: 1 }, { unique: true })\n  await doctorsColl.createIndex({ especialidad: 1 })\n  await doctorsColl.createIndex({ pisos: 1 })\n  await doctorsColl.createIndex({ especialidad: 1, pisos: 1 })\n  await doctorsColl.createIndex({ boxes: 1 })
  for (const d of doctors) {
    await doctorsColl.updateOne({ rut: d.rut }, { $set: d }, { upsert: true })
  }

  const weeklyColl = db.collection("weekly_slots_import")
  await weeklyColl.createIndex({ doctor_rut: 1, dia_semana: 1, inicio: 1 }, { unique: true })
  const rutsWeekly = Array.from(new Set(weekly.map((w) => w.doctor_rut)))
  if (rutsWeekly.length) {
    await weeklyColl.deleteMany({ doctor_rut: { $in: rutsWeekly } })
  }
  if (weekly.length) await weeklyColl.insertMany(weekly)

  console.log("Carga completada ✅")
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


