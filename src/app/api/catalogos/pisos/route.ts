/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"

export async function GET() {
  const db = await getDb()
  const items = await db.collection("floors").find({}).sort({ numero: 1 }).toArray()
  return NextResponse.json(items.map((p: any) => ({ id: String(p._id), numero: p.numero, torre: p.torre ?? null, sede: p.sede ?? null })))
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (body.numero == null) return NextResponse.json({ message: "numero requerido" }, { status: 400 })
  const doc = { numero: Number(body.numero), torre: body.torre ?? null, sede: body.sede ?? null, createdAt: new Date().toISOString() }
  const res = await db.collection("floors").insertOne(doc)
  return NextResponse.json({ id: String(res.insertedId), ...doc }, { status: 201 })
}
