/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { ObjectId } from "mongodb"

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["doctor", "admin", "agendamiento"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const rut = sanitizeRut(url.searchParams.get("rut") || req.cookies.get("rut")?.value || "")
  const filter: any = {}
  if (rut) filter.doctor_rut = rut
  const items = await db.collection("special_requests").find(filter).sort({ createdAt: -1 }).toArray()
  return NextResponse.json({
    items: items.map((d: any) => ({
      id: String(d._id),
      doctor_rut: d.doctor_rut,
      tipo: d.tipo,
      detalle: d.detalle,
      estado: d.estado,
      fecha_solicitada: d.fecha_solicitada,
      horario_actual: d.horario_actual,
      horario_solicitado: d.horario_solicitado,
      boxId: d.boxId,
      especialidad: d.especialidad,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      respuesta: d.respuesta,
    })),
  })
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["doctor", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  const rut = sanitizeRut(req.cookies.get("rut")?.value || body.rut || "")
  if (!rut) return NextResponse.json({ message: "RUT requerido" }, { status: 400 })
  if (!body.detalle || !body.tipo) {
    return NextResponse.json({ message: "detalle y tipo son requeridos" }, { status: 400 })
  }
  const doctor = await db.collection("doctors").findOne({ rut })
  const doc = {
    doctor_rut: rut,
    tipo: body.tipo, // "reajuste_horario" | "cambio_box" | "otro"
    detalle: body.detalle,
    estado: "pendiente",
    fecha_solicitada: body.fecha_solicitada || null,
    horario_actual: body.horario_actual || null,
    horario_solicitado: body.horario_solicitado || null,
    boxId: body.boxId || null,
    especialidad: doctor?.especialidad || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const res = await db.collection("special_requests").insertOne(doc as any)
  await logAudit({ actorRut: rut, action: "create", entity: "special_requests", entityId: String(res.insertedId), details: doc })
  try {
    const { sendEmail } = await import("@/lib/mailer")
    await sendEmail({
      subject: "Nueva solicitud especial de reajuste de horario",
      html: `<p>Se registró una nueva solicitud especial.</p><ul><li>RUT: ${rut}</li><li>Tipo: ${doc.tipo}</li><li>Detalle: ${doc.detalle}</li><li>Fecha solicitada: ${doc.fecha_solicitada || "N/A"}</li><li>Horario actual: ${doc.horario_actual || "N/A"}</li><li>Horario solicitado: ${doc.horario_solicitado || "N/A"}</li></ul>`,
    })
  } catch {}
  return NextResponse.json({ id: String(res.insertedId), ...doc }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  try {
    requireRole(req, ["agendamiento", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await req.json()
  if (!body.id || !body.estado) return NextResponse.json({ message: "id y estado requeridos" }, { status: 400 })
  const _id = new ObjectId(body.id)
  const update: any = { estado: body.estado, updatedAt: new Date().toISOString() }
  if (body.respuesta) update.respuesta = body.respuesta
  const res = await db.collection("special_requests").findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" })
  if (!res.value) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  const d: any = res.value
  await logAudit({ actorRut: req.cookies.get("rut")?.value, action: "change_status", entity: "special_requests", entityId: body.id, details: { estado: body.estado } })
  try {
    const { sendEmail } = await import("@/lib/mailer")
    await sendEmail({
      subject: `Solicitud especial ${body.estado}`.toUpperCase(),
      html: `<p>Se actualizó una solicitud especial.</p><ul><li>RUT: ${d.doctor_rut}</li><li>Tipo: ${d.tipo}</li><li>Estado: ${body.estado}</li><li>Respuesta: ${body.respuesta || "N/A"}</li></ul>`,
    })
  } catch {}
  return NextResponse.json({ id: String(d._id), ...d, estado: body.estado, respuesta: body.respuesta || d.respuesta })
}

