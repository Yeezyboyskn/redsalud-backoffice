/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"

export async function GET() {
  const db = await getDb()
  const items = await db.collection("specialties").find({}).sort({ nombre: 1 }).toArray()
  return NextResponse.json(items.map((s: any) => ({ id: String(s._id), nombre: s.nombre ?? s.especialidad ?? "" })))
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (!body.nombre) return NextResponse.json({ message: "nombre requerido" }, { status: 400 })
  const res = await db.collection("specialties").insertOne({ nombre: body.nombre, createdAt: new Date().toISOString() })
  return NextResponse.json({ id: String(res.insertedId), nombre: body.nombre }, { status: 201 })
}
