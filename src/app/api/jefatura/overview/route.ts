/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    requireRole(req as any, ["jefatura", "admin"])
  } catch (res) {
    return res as any
  }
  const db = await getDb()
  const blocks = await db.collection("block_requests").find({}).toArray()
  const extras = await db.collection("extra_hours").find({}).toArray()
  const weekly = await db.collection("weekly_slots_import").find({}).toArray()

  const resumen = {
    totalBloqueos: blocks.length,
    pendientes: blocks.filter((b: any) => b.estado === "pendiente").length,
    aprobados: blocks.filter((b: any) => b.estado === "aprobado").length,
    rechazados: blocks.filter((b: any) => b.estado === "rechazado").length,
    horasExtra: extras.length,
    horasExtraCompartidas: extras.filter((e: any) => e.audience === "especialidad").length,
    tramosContrato: weekly.length,
  }

  const recientes = blocks
    .slice()
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 6)
    .map((b: any) => ({
      id: String(b._id),
      fecha: b.fecha,
      inicio: b.inicio,
      fin: b.fin,
      estado: b.estado,
      motivo: b.motivo,
      rut: b.doctor_rut,
      boxId: b.boxId,
    }))

  return NextResponse.json({ resumen, recientes })
}
