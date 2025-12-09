/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["admin", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const entity = url.searchParams.get("entity")
  const rut = url.searchParams.get("rut")
  const filter: any = {}
  if (entity) filter.entity = entity
  if (rut) filter.actorRut = rut
  const items = await db.collection("audit_logs").find(filter).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json(items.map((i: any) => ({ id: String(i._id), ...i })))
}
