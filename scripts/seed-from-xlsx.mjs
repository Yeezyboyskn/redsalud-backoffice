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
  const doctorsSheet = wb.Sheets[
    docNameOverride || findSheetName(wb.SheetNames, ["doctor", "medic", "profesional", "ofertas", "horario"])
  ]
  const hoursSheet = wb.Sheets[
    hrsNameOverride || findSheetName(wb.SheetNames, ["hora", "agenda", "dispon", "slot", "turno", "tramo", "ofertas", "horario"])
  ]
  const doctorsRows = sheetToObjects(doctorsSheet)
  const hoursRows = sheetToObjects(hoursSheet)

  // Transform doctors
  const doctorsMap = new Map()
  for (const r of doctorsRows) {
    const rut = (r.rut || r.doctor_rut || r.id || r.usuario || "").toString()
    if (!rut) continue
    const nombre = r.nombre || r.doctor || r.profesor || r.medico || null
    const piso = r.piso || r.piso_numero || r.piso_asignado || r.nuevos_pisos || r.pisos || null
    const box = r.box || r.box_id || r.box_asignado || null
    const especialidad = r.especialidad || r.especialidades || null
    const correo = (r.correo || r.email || r.mail || "").toString().trim() || null
    const telefonoRaw = (r.telefono || r.fono || r.telefono_contacto || "").toString()
    const telefono = telefonoRaw ? telefonoRaw.replace(/[^0-9+]/g, "").trim() : null
    const current =
      doctorsMap.get(rut) || { rut, nombre, especialidad, correo: correo ? correo.toLowerCase() : null, telefono, pisos: new Set(), boxes: new Set() }
    if (piso) String(piso)
      .split(/[,\/]|\s+/)
      .filter(Boolean)
      .forEach((p) => current.pisos.add(String(p).trim()))
    if (box) current.boxes.add(String(box))
    if (!current.correo && correo) current.correo = correo.toLowerCase()
    if (!current.telefono && telefono) current.telefono = telefono
    doctorsMap.set(rut, current)
  }

  // Doctores será materializado después de extraer boxes desde los tramos semanales

  // Transform hours. Soportamos dos formatos:
  // 1) Formato por fecha (fecha/inicio/fin)
  // 2) Formato semanal por dia (columnas LUNES/MARTES/... con "HH:MM a HH:MM (BOX)")
  const extra = []
  const weekly = []
  const boxesByRut = new Map()
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
  // Fallback para columna de box por d�a (box_lunes, box_martes, ...)
  const dayMap = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' }
  const boxKey = ox_
  const fallbackBox = r[boxKey] != null ? Number(String(r[boxKey]).match(/\d+/)?.[0]) : null
  const segs = parseSegments(r[key])
  for (const seg of segs) {
    if (!seg.box && (fallbackBox || fallbackBox === 0)) seg.box = fallbackBox
    if (seg.inicio && seg.fin) {
      weekly.push({ doctor_rut: rut, dia_semana: dow, inicio: seg.inicio, fin: seg.fin, box: seg.box, frecuencia_min: frecuencia ?? null })
      if (seg.box) {
        const set = boxesByRut.get(rut) || new Set()
        set.add(String(seg.box))
        boxesByRut.set(rut, set)
      }
    }
  }
}
  }

  // Completar boxes desde los tramos semanales
  for (const [rut, set] of boxesByRut.entries()) {
    const doc = doctorsMap.get(rut)
    if (doc) for (const b of set) doc.boxes.add(b)
  }

  const doctors = Array.from(doctorsMap.values()).map((d) => ({
    rut: d.rut,
    nombre: d.nombre,
    especialidad: d.especialidad,
    correo: d.correo || null,
    telefono: d.telefono || null,
    pisos: Array.from(d.pisos),
    boxes: Array.from(d.boxes),
  }))

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

  // Dataset de pisos por especialidad y heurística por box para completar 'piso' en la plantilla semanal
  const specItems = await db.collection("specialty_floors").find({}).toArray()
  const norm = (s) => (s ? String(s).trim().toLowerCase() : "")
  const specMap = new Map(specItems.map((it) => [norm(it.especialidad), it.pisos]))
  const guessPiso = (box) => {
    const n = Number(box)
    if (Number.isNaN(n)) return null
    const g = Math.floor(n / 100)
    return g
  }
  const weeklyFinal = weeklyEnriched.map((w) => {
    let piso = w.piso
    if (!piso) {
      const pisosSpec = specMap.get(norm(w.especialidad))
      if (Array.isArray(pisosSpec) && pisosSpec.length === 1) piso = pisosSpec[0]
    }
    if (!piso && w.box) {
      const g = guessPiso(w.box)
      if (g || g === 0) piso = g
    }
    const pisoNum = piso != null && !Number.isNaN(Number(piso)) ? Number(piso) : null\n    return { ...w, piso: pisoNum }
  })

  // Insert plantillas semanales (reescribe por doctor)
  const weeklyColl = db.collection("weekly_slots_import")
  await weeklyColl.createIndex({ doctor_rut: 1, dia_semana: 1, inicio: 1 }, { unique: true })
  const rutsWeekly = Array.from(new Set(weeklyFinal.map((w) => w.doctor_rut)))
  if (rutsWeekly.length) {
    await weeklyColl.deleteMany({ doctor_rut: { $in: rutsWeekly } })
  }
  if (weeklyFinal.length) {
    await weeklyColl.insertMany(weeklyFinal)
  }

  console.log("Seed completado ✅")
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})





