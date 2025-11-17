/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const rutQuery = url.searchParams.get("rut") || req.cookies.get("rut")?.value || ""
  const rutSan = sanitizeRut(rutQuery)
  if (!rutSan) return NextResponse.json({ items: [] })
  const items = await db
    .collection("weekly_slots_import")
    .find({ doctor_rut: rutSan }, { projection: { _id: 0 } })
    .sort({ dia_semana: 1, inicio: 1 })
    .toArray()
  return NextResponse.json({ items })
}

