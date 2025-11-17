/* eslint-disable no-console */
import path from "node:path"
import fs from "node:fs"
import process from "node:process"
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

function findSheetName(names, candidates) {
  const lowers = names.map((n) => n.toLowerCase())
  for (const c of candidates) {
    const idx = lowers.findIndex((n) => n.includes(c))
    if (idx !== -1) return names[idx]
  }
  return names[0]
}

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

function toISODate(value) {
  if (!value) return null
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value)
  // Try Date parse
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  // Excel serialized date number (approx)
  const n = Number(value)
  if (!Number.isNaN(n)) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const ms = n * 24 * 60 * 60 * 1000
    return new Date(epoch.getTime() + ms).toISOString().slice(0, 10)
  }
  return null
}

function parseHour(h) {
  if (!h) return null
  const m = String(h).match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`
  // Excel time fraction (e.g., 0.5 is 12:00)
  const num = Number(h)
  if (!Number.isNaN(num)) {
    const totalMin = Math.round(num * 24 * 60)
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0")
    const mm = String(totalMin % 60).padStart(2, "0")
    return `${hh}:${mm}`
  }
  return null
}

function plusMinutes(hhmm, minutes = 60) {
  const [h, m] = hhmm.split(":").map(Number)
  const total = h * 60 + m + Number(minutes || 0)
  const hh = String(Math.floor(total / 60)).padStart(2, "0")
  const mm = String(total % 60).padStart(2, "0")
  return `${hh}:${mm}`
}

async function main() {
  const file = process.argv[2] || "data.xlsx"
  const filePath = path.resolve(process.cwd(), file)
  if (!fs.existsSync(filePath)) {
    console.error(`No se encontró el archivo: ${filePath}`)
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || "backoffice"
  if (!uri) {
    console.error("MONGODB_URI no configurado. Define la variable de entorno.")
    process.exit(1)
  }

  console.log(`Leyendo Excel: ${filePath}`)
  const wb = XLSX.readFile(filePath, { cellDates: true })
  // Overrides via flags or env
  const flags = Object.fromEntries(process.argv.slice(3).map((arg) => arg.split("=").map((s) => s.replace(/^--/, ""))))
  const docNameOverride = flags["doctors-sheet"] || process.env.SEED_SHEET_DOCTORS
  const hrsNameOverride = flags["hours-sheet"] || process.env.SEED_SHEET_HOURS
  const doctorsSheet = wb.Sheets[docNameOverride || findSheetName(wb.SheetNames, ["doctor", "medic", "profesional"])]
  const hoursSheet = wb.Sheets[hrsNameOverride || findSheetName(wb.SheetNames, ["hora", "agenda", "dispon", "slot", "turno", "tramo"])]
  const doctorsRows = sheetToObjects(doctorsSheet)
  const hoursRows = sheetToObjects(hoursSheet)

  // Transform doctors
  const doctorsMap = new Map()
  for (const r of doctorsRows) {
    const rut = (r.rut || r.doctor_rut || r.id || r.usuario || "").toString()
    if (!rut) continue
    const nombre = r.nombre || r.doctor || r.profesor || r.medico || null
    const piso = r.piso || r.piso_numero || r.piso_asignado || null
    const box = r.box || r.box_id || r.box_asignado || null
    const especialidad = r.especialidad || r.especialidades || null
    const current = doctorsMap.get(rut) || { rut, nombre, especialidad, pisos: new Set(), boxes: new Set() }
    if (piso) current.pisos.add(String(piso))
    if (box) current.boxes.add(String(box))
    doctorsMap.set(rut, current)
  }

  const doctors = Array.from(doctorsMap.values()).map((d) => ({
    rut: d.rut,
    nombre: d.nombre,
    especialidad: d.especialidad,
    pisos: Array.from(d.pisos),
    boxes: Array.from(d.boxes),
  }))

  // Transform hours. Soportamos dos formatos:
  // 1) Formato por fecha (fecha/inicio/fin)
  // 2) Formato semanal por dia (columnas LUNES/MARTES/... con "HH:MM a HH:MM (BOX)")
  const extra = []
  const weekly = []
  const dayCols = [
    { keys: ["lunes", "lunes ", "lun"], dow: 1 },
    { keys: ["martes", "martes ", "mar"], dow: 2 },
    { keys: ["miércoles", "miercoles", "miércoles ", "miercoles ", "mie"], dow: 3 },
    { keys: ["jueves", "jueves ", "jue"], dow: 4 },
    { keys: ["viernes", "viernes ", "vie"], dow: 5 },
    { keys: ["sábado", "sabado", "sábado ", "sabado ", "sab"], dow: 6 },
  ]

  const cleanNum = (s) => {
    const m = String(s ?? "").match(/\d+/)
    return m ? Number(m[0]) : null
  }
  const parseSegments = (value) => {
    if (!value) return []
    const parts = String(value).split(/\r?\n|\s*\/\s*|;|\|/).map((t) => t.trim()).filter(Boolean)
    const segs = []
    for (const p of parts) {
      const m = p.match(/(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2}).*?(\((\d+)\))?/i)
      if (m) segs.push({ inicio: parseHour(m[1]), fin: parseHour(m[2]), box: m[4] ? Number(m[4]) : null })
    }
    return segs
  }

  for (const r of hoursRows) {
    const rut = (r.rut || r.Rut || r.doctor_rut || "").toString()
    if (!rut) continue
    // Frecuencia por fila si existe
    const frecuencia = cleanNum(r["Frecuencia x min"] || r.frecuencia || r.frecuencia_min || r.cada_min || r.cadencia)

    // Caso 1: por fecha explícita
    const fecha = toISODate(r.fecha || r.dia || r.fecha_atencion)
    const inicio = parseHour(r.inicio || r.hora || r.hora_inicio)
    let fin = parseHour(r.fin || r.hora_fin)
    const boxRaw = r.box || r.box_id || r.box_asignado || r.bloque
    const box = boxRaw ? Number(String(boxRaw).match(/\d+/)?.[0]) || null : null
    if (fecha && inicio && (fin || frecuencia)) {
      if (!fin && frecuencia) fin = plusMinutes(inicio, frecuencia)
      extra.push({ doctor_rut: rut, fecha, inicio, fin, box, frecuencia_min: frecuencia ?? null })
    }

    // Caso 2: por dia de semana en columnas
    const rowKeys = Object.keys(r)
    for (const { keys, dow } of dayCols) {
      const key = rowKeys.find((k) => keys.includes(String(k).toLowerCase()))
      if (!key) continue
      const segs = parseSegments(r[key])
      for (const seg of segs) {
        if (seg.inicio && seg.fin) {
          weekly.push({ doctor_rut: rut, dia_semana: dow, inicio: seg.inicio, fin: seg.fin, box: seg.box, frecuencia_min: frecuencia ?? null })
        }
      }
    }
  }

  const dry = Boolean(process.env.SEED_DRY_RUN)
  console.log(`Encontrados: doctores=${doctors.length}, tramos_fecha=${extra.length}, tramos_semana=${weekly.length}`)
  if (dry) {
    console.log("Modo SEED_DRY_RUN activo. No se escribirá en la base de datos.")
    return
  }

  console.log("Conectando a MongoDB…")
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  // Upsert doctors
  const doctorsColl = db.collection("doctors")
  await doctorsColl.createIndex({ rut: 1 }, { unique: true })
  for (const d of doctors) {
    await doctorsColl.updateOne({ rut: d.rut }, { $set: d }, { upsert: true })
  }

  // Insert extra hours por fecha
  const extraColl = db.collection("extra_hours_import")
  await extraColl.createIndex({ doctor_rut: 1, fecha: 1, inicio: 1 }, { unique: true })
  for (const e of extra) {
    await extraColl.updateOne({ doctor_rut: e.doctor_rut, fecha: e.fecha, inicio: e.inicio }, { $set: e }, { upsert: true })
  }

  // Insert plantillas semanales
  const weeklyColl = db.collection("weekly_slots_import")
  await weeklyColl.createIndex({ doctor_rut: 1, dia_semana: 1, inicio: 1 }, { unique: true })
  for (const w of weekly) {
    await weeklyColl.updateOne({ doctor_rut: w.doctor_rut, dia_semana: w.dia_semana, inicio: w.inicio }, { $set: w }, { upsert: true })
  }

  console.log("Seed completado ✅")
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
