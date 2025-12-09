/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ticketSchema } from "@/lib/validators"
import { logAudit } from "@/lib/audit"

export async function GET() {
  const db = await getDb()
  const items = await db.collection("tickets").find({}).sort({ createdAt: -1 }).toArray()
  return NextResponse.json(items.map((t: any) => ({ id: String(t._id), ...t })))
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const parsed = ticketSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "payload invalido", issues: parsed.error.flatten() }, { status: 400 })
  const doc: any = { ...parsed.data, estado: "abierto", createdAt: new Date().toISOString(), creadoPor: req.cookies.get("rut")?.value ?? "anon" }
  const res = await db.collection("tickets").insertOne(doc)
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "create", entity: "tickets", entityId: String(res.insertedId), details: parsed.data })
  return NextResponse.json({ id: String(res.insertedId), ...doc }, { status: 201 })
}
