/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { requireRole } from "@/lib/auth"

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

const parseBody = async (req: NextRequest) => {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  try {
    requireRole(req, ["doctor", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const url = new URL(req.url)
  const rutQuery = url.searchParams.get("rut") || req.cookies.get("rut")?.value || ""
  const from = url.searchParams.get("from") || "0000-01-01"
  const to = url.searchParams.get("to") || "9999-12-31"
  
  const rutSan = sanitizeRut(rutQuery)
  const items = await db
    .collection("block_requests")
    .find({ doctor_rut: rutSan, fecha: { $gte: from, $lte: to } })
    .sort({ fecha: 1, inicio: 1 })
    .toArray()
  return NextResponse.json({
    items: items.map((d: any) => ({ id: String(d._id), rut: rutQuery, fecha: d.fecha, inicio: d.inicio, fin: d.fin, motivo: d.motivo, boxId: d.boxId, estado: d.estado })),
  })
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req, ["doctor", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await parseBody(req)
  if (!body.fecha || !body.inicio || !body.fin || !body.motivo) {
    return NextResponse.json({ message: "fecha, inicio, fin y motivo son requeridos" }, { status: 400 })
  }
  const rutQuery = req.cookies.get("rut")?.value || body.rut || ""
  const doc = {
    doctor_rut: sanitizeRut(rutQuery),
    fecha: body.fecha,
    inicio: body.inicio,
    fin: body.fin,
    motivo: body.motivo,
    boxId: body.boxId ?? null,
    estado: "pendiente",
    createdAt: new Date().toISOString(),
  }
  const res = await db.collection("block_requests").insertOne(doc as any)
  try {
    const { logAudit } = await import("@/lib/audit")
    await logAudit({ actorRut: rutQuery, action: "create", entity: "block_requests", entityId: String(res.insertedId), details: doc })
  } catch {}
  try {
    const { sendEmail } = await import("@/lib/mailer")
    await sendEmail({
      subject: "Nueva solicitud de bloqueo",
      html: `<p>Se registro una nueva solicitud de bloqueo.</p><ul><li>RUT: ${rutQuery}</li><li>Fecha: ${doc.fecha}</li><li>Horario: ${doc.inicio} - ${doc.fin}</li><li>Box: ${doc.boxId ?? "N/A"}</li><li>Motivo: ${doc.motivo}</li></ul>`,
    })
  } catch {}

  // Si el doctor tiene especialidad, publicamos la hora liberada como extra para colegas de la misma especialidad.
  const doctorDocs = await db.collection("doctors").find({ rut: doc.doctor_rut }).limit(1).toArray()
  const doctorProfile: any = doctorDocs[0]
  const especialidad = doctorProfile?.especialidad ?? null
  if (especialidad) {
    const sharedExtra = {
      doctor_rut: doc.doctor_rut,
      owner_rut: doc.doctor_rut,
      especialidad,
      audience: "especialidad",
      source_block_id: res.insertedId,
      fecha: doc.fecha,
      inicio: doc.inicio,
      fin: doc.fin,
      boxId: doc.boxId ?? null,
      createdAt: new Date().toISOString(),
    }
    await db.collection("extra_hours").insertOne(sharedExtra as any)
  }
  return NextResponse.json({ id: String(res.insertedId), rut: rutQuery, fecha: doc.fecha, inicio: doc.inicio, fin: doc.fin, motivo: doc.motivo, boxId: doc.boxId, estado: doc.estado }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  try {
    requireRole(req, ["doctor", "agendamiento", "admin"])
  } catch (res) {
    return res as NextResponse
  }
  const db = await getDb()
  const body = await parseBody(req)
  if (!body.id) return NextResponse.json({ message: "id requerido" }, { status: 400 })
  const _id = new ObjectId(body.id)
  const update: any = {}
  for (const k of ["fecha", "inicio", "fin", "motivo", "estado", "boxId"]) {
    if (k in body) update[k] = body[k]
  }
  const res: any = await db.collection("block_requests").findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" })
  const d: any = res?.value
  if (!d) return NextResponse.json({ message: "no encontrado" }, { status: 404 })
  return NextResponse.json({ id: String(d._id), rut: d.doctor_rut, fecha: d.fecha, inicio: d.inicio, fin: d.fin, motivo: d.motivo, boxId: d.boxId, estado: d.estado })
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ message: "id requerido" }, { status: 400 })
  const res = await db.collection("block_requests").deleteOne({ _id: new ObjectId(id) })
  return NextResponse.json({ removed: res.deletedCount === 1 })
}


