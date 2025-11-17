import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

function normalizeEspecialidad(v?: string | null) {
  return (v || "").toString().trim()
}

function parsePisos(input: unknown): (number | string)[] {
  if (Array.isArray(input)) return input
  if (input == null) return []
  const str = String(input)
  const parts = str
    .split(/[,/]|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.map((p) => {
    const n = Number(p)
    return Number.isNaN(n) ? p : n
  })
}

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim().toLowerCase()
  const coll = db.collection("specialty_floors")
  const filter = q ? { especialidad: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}
  const items = await coll.find(filter, { projection: { _id: 0 } }).sort({ especialidad: 1 }).toArray()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json().catch(() => ({}))
  const especialidad = normalizeEspecialidad(body.especialidad)
  const pisos = parsePisos(body.pisos)
  if (!especialidad || pisos.length === 0) {
    return NextResponse.json({ message: "especialidad y pisos son requeridos" }, { status: 400 })
  }
  const coll = db.collection("specialty_floors")
  await coll.createIndex({ especialidad: 1 }, { unique: true })
  const doc = { especialidad, pisos, updatedAt: new Date().toISOString() }
  await coll.updateOne({ especialidad }, { $set: doc }, { upsert: true })
  return NextResponse.json(doc, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const esp = normalizeEspecialidad(url.searchParams.get("especialidad"))
  if (!esp) return NextResponse.json({ message: "especialidad requerida" }, { status: 400 })
  const coll = db.collection("specialty_floors")
  const res = await coll.deleteOne({ especialidad: esp })
  return NextResponse.json({ removed: res.deletedCount === 1 })
}
