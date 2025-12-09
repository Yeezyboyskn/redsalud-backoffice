/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["admin", "jefatura", "agendamiento"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const especialidad = url.searchParams.get("especialidad")
  const rut = url.searchParams.get("rut")
  const filter: any = {}
  if (especialidad) filter.especialidad = especialidad
  if (rut) filter.rut = rut
  const items = await db.collection("doctors").find(filter).limit(200).toArray()
  return NextResponse.json(items.map((d: any) => ({ id: String(d._id), ...d })))
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (!body.rut || !body.nombre) return NextResponse.json({ message: "rut y nombre requeridos" }, { status: 400 })
  const doc = {
    rut: body.rut,
    nombre: body.nombre,
    especialidad: body.especialidad ?? "",
    boxes: body.boxes ?? [],
    pisos: body.pisos ?? [],
    correo: body.correo ?? "",
    telefono: body.telefono ?? "",
    createdAt: new Date().toISOString(),
  }
  const res = await db.collection("doctors").insertOne(doc as any)
  return NextResponse.json({ id: String(res.insertedId), ...doc }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (!body.id) return NextResponse.json({ message: "id requerido" }, { status: 400 })
  const update: any = {}
  for (const key of ["nombre", "especialidad", "boxes", "pisos", "correo", "telefono"]) {
    if (key in body) update[key] = body[key]
  }
  const res = await db.collection("doctors").findOneAndUpdate({ _id: body.id }, { $set: update }, { returnDocument: "after" })
  if (!res.value) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  return NextResponse.json({ id: String(res.value._id), ...res.value })
}
