/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const estado = url.searchParams.get("estado")
   const fecha = url.searchParams.get("fecha")
  const filter: any = {}
  if (estado) filter.estado = estado
  if (fecha) filter.fecha = fecha
  const items = await db.collection("block_requests").find(filter).sort({ createdAt: -1 }).toArray()
  const ruts = Array.from(new Set(items.map((i: any) => i.doctor_rut).filter(Boolean)))
  const doctors = await db.collection("doctors").find({ rut: { $in: ruts } }).toArray()
  const docMap = new Map(doctors.map((d: any) => [d.rut, d]))

  return NextResponse.json({
    items: items.map((d: any) => {
      const doc = docMap.get(d.doctor_rut)
      return {
        id: String(d._id),
        rut: d.doctor_rut,
        fecha: d.fecha,
        inicio: d.inicio,
        fin: d.fin,
        motivo: d.motivo,
        boxId: d.boxId,
        estado: d.estado,
        createdAt: d.createdAt,
        doctorNombre: doc?.nombre ?? "",
        especialidad: doc?.especialidad ?? "",
      }
    }),
  })
}

export async function PUT(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin", "jefatura"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (!body.id || !body.estado) return NextResponse.json({ message: "id y estado requeridos" }, { status: 400 })
  const _id = new ObjectId(body.id)
  const res = await db.collection("block_requests").findOneAndUpdate({ _id }, { $set: { estado: body.estado, updatedAt: new Date().toISOString() } }, { returnDocument: "after" })
  if (!res.value) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  const d: any = res.value
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "change_status", entity: "block_requests", entityId: body.id, details: { estado: body.estado } })
  try {
  const { sendEmail } = await import("@/lib/mailer")
  await sendEmail({
    subject: `Solicitud de bloqueo ${body.estado}`.toUpperCase(),
    html: `<p>Se actualizo una solicitud de bloqueo.</p><ul><li>RUT: ${d.doctor_rut}</li><li>Fecha: ${d.fecha}</li><li>Horario: ${d.inicio} - ${d.fin}</li><li>Box: ${d.boxId ?? "N/A"}</li><li>Motivo: ${d.motivo}</li><li>Estado: ${body.estado}</li></ul>`,
  })
  } catch {}
  return NextResponse.json({
    id: String(d._id),
    rut: d.doctor_rut,
    fecha: d.fecha,
    inicio: d.inicio,
    fin: d.fin,
    motivo: d.motivo,
    boxId: d.boxId,
    estado: d.estado,
  })
}


