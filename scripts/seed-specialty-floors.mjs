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

function parsePisos(value) {
  if (!value) return []
  const str = String(value)
  const parts = str
    .split(/[,/]|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  // Intentar convertir a numero si aplica
  return parts.map((p) => {
    const n = Number(p)
    return Number.isNaN(n) ? p : n
  })
}

async function main() {
  const file = process.argv[2] || "pisos por especialidad.xlsx"
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
  const firstSheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[firstSheetName]
  const rows = sheetToObjects(sheet)

  const items = rows
    .map((r) => {
      const esp = r.especialidad || r.nombre || r.especialidad_medica || null
      const pisos = parsePisos(r.pisos || r.piso || r.piso_compatible)
      if (!esp || !pisos.length) return null
      return { especialidad: String(esp).trim(), pisos, updatedAt: new Date().toISOString() }
    })
    .filter(Boolean)

  console.log(`Registros a cargar: ${items.length}`)
  const dry = Boolean(process.env.SEED_DRY_RUN)
  if (dry) {
    console.log("SEED_DRY_RUN activo. No se escribirá en la base de datos.")
    return
  }

  console.log("Conectando a MongoDB…")
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  const coll = db.collection("specialty_floors")
  await coll.createIndex({ especialidad: 1 }, { unique: true })
  for (const it of items) {
    await coll.updateOne({ especialidad: it.especialidad }, { $set: it }, { upsert: true })
  }

  console.log("Carga completada ✅")
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

