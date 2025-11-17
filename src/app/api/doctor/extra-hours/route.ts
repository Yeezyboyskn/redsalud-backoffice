/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

const parseBody = async (req: NextRequest) => {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const rutQuery = url.searchParams.get("rut") || req.cookies.get("rut")?.value || ""
  const from = url.searchParams.get("from") || "0000-01-01"
  const to = url.searchParams.get("to") || "9999-12-31"
  const rutSan = sanitizeRut(rutQuery)
  const items = await db
    .collection("extra_hours")
    .find({ doctor_rut: rutSan, fecha: { $gte: from, $lte: to } })
    .sort({ fecha: 1, inicio: 1 })
    .toArray()
  return NextResponse.json({
    items: items.map((d: any) => ({ id: String(d._id), rut: rutQuery, fecha: d.fecha, inicio: d.inicio, fin: d.fin, boxId: d.boxId })),
  })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await parseBody(req)
  const rutQuery = req.cookies.get("rut")?.value || body.rut || ""
  if (!body.fecha || !body.inicio || !body.fin) {
    return NextResponse.json({ message: "fecha, inicio y fin son requeridos" }, { status: 400 })
  }
  const doc = {
    doctor_rut: sanitizeRut(rutQuery),
    fecha: body.fecha,
    inicio: body.inicio,
    fin: body.fin,
    boxId: body.boxId ?? null,
    createdAt: new Date().toISOString(),
  }
  const res = await db.collection("extra_hours").insertOne(doc as any)
  return NextResponse.json({ id: String(res.insertedId), rut: rutQuery, fecha: doc.fecha, inicio: doc.inicio, fin: doc.fin, boxId: doc.boxId }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const db = await getDb()
  const body = await parseBody(req)
  if (!body.id) return NextResponse.json({ message: "id requerido" }, { status: 400 })
  const _id = new ObjectId(body.id)
  const update: any = {}
  if (body.fecha) update.fecha = body.fecha
  if (body.inicio) update.inicio = body.inicio
  if (body.fin) update.fin = body.fin
  if ("boxId" in body) update.boxId = body.boxId
  const res: any = await db.collection("extra_hours").findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" })
  const d: any = res?.value
  if (!d) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  return NextResponse.json({ id: String(d._id), rut: d.doctor_rut, fecha: d.fecha, inicio: d.inicio, fin: d.fin, boxId: d.boxId })
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ message: "id requerido" }, { status: 400 })
  const res = await db.collection("extra_hours").deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ removed: res.deletedCount === 1 })
}
