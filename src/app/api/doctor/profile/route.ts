/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

const sanitizeRut = (s?: string | null) => (s ? s.toUpperCase().replace(/[^0-9K]/g, "") : "")

export async function GET(req: NextRequest) {
  const db = await getDb()
  const url = new URL(req.url)
  const rutQuery = url.searchParams.get("rut") || req.cookies.get("rut")?.value || ""
  const rutSan = sanitizeRut(rutQuery)

  const docs = await db.collection("doctors").find({}, { projection: { _id: 0 } }).toArray()
  let doc: any | undefined
  if (rutSan) {
    doc = docs.find((d: any) => sanitizeRut(d.rut) === rutSan)
  } else {
    doc = undefined
  }
  if (!doc) {
    return NextResponse.json({ message: "Perfil no encontrado" }, { status: 404 })
  }

  const boxes = Array.isArray(doc.boxes)
    ? doc.boxes
        .map((b: any) => ({ id: Number(b), etiqueta: `Box ${b}` }))
        .filter((b: any) => !Number.isNaN(b.id))
    : []

  const payload = {
    rut: doc.rut,
    nombre: doc.nombre ?? "",
    especialidad: doc.especialidad ?? "",
    correo: doc.correo ?? "",
    telefono: doc.telefono ?? "",
    pisos: Array.isArray(doc.pisos) ? doc.pisos : [],
    boxes,
  }
  return NextResponse.json(payload)
}
