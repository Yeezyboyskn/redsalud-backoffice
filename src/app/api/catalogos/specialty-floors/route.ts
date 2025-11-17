import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim().toLowerCase()
  const coll = db.collection("specialty_floors")
  const filter = q ? { especialidad: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}
  const items = await coll.find(filter, { projection: { _id: 0 } }).sort({ especialidad: 1 }).toArray()
  return NextResponse.json(items)
}

