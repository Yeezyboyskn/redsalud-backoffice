/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { ObjectId } from "mongodb"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const estado = url.searchParams.get("estado")
  const filter: any = {}
  if (estado) filter.estado = estado
  const items = await db.collection("special_requests").find(filter).sort({ createdAt: -1 }).toArray()
  const ruts = Array.from(new Set(items.map((i: any) => i.doctor_rut).filter(Boolean)))
  const doctors = await db.collection("doctors").find({ rut: { $in: ruts } }).toArray()
  const docMap = new Map(doctors.map((d: any) => [d.rut, d]))
  return NextResponse.json({
    items: items.map((d: any) => {
      const doc = docMap.get(d.doctor_rut)
      return {
        id: String(d._id),
        doctor_rut: d.doctor_rut,
        doctorNombre: doc?.nombre ?? "",
        especialidad: doc?.especialidad ?? "",
        tipo: d.tipo,
        detalle: d.detalle,
        estado: d.estado,
        fecha_solicitada: d.fecha_solicitada,
        horario_actual: d.horario_actual,
        horario_solicitado: d.horario_solicitado,
        boxId: d.boxId,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        respuesta: d.respuesta,
      }
    }),
  })
}

