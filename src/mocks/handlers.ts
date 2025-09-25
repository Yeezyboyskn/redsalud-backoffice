import { http, HttpResponse } from "msw"

const doctors = [
  { id: 1, rut: "11.111.111-1", nombre: "Dra. Pérez", especialidad: "Traumato", piso: 3, boxes: [301, 302] },
  { id: 2, rut: "22.222.222-2", nombre: "Dr. Soto",  especialidad: "Odonto",  piso: 4, boxes: [401] },
  { id: 3, rut: "33.333.333-3", nombre: "Dr. Rojas", especialidad: "Cardio",  piso: 5, boxes: [501] },
]

const boxes = [
  { id: 301, piso: 3, especialidad: "Traumato", estado: "disponible" },
  { id: 302, piso: 3, especialidad: "Traumato", estado: "bloqueado"  },
  { id: 401, piso: 4, especialidad: "Odonto",  estado: "disponible" },
  { id: 501, piso: 5, especialidad: "Cardio",  estado: "disponible" },
]

const bloqueos = [
  { id: "b1", box: 302, fecha: "2025-09-25", motivo: "Mantención", creadoPor: "Jefatura" },
]

const kpiOcupacion = [
  { piso: 3, ocupacion: 72 },
  { piso: 4, ocupacion: 61 },
  { piso: 5, ocupacion: 83 },
]

export const handlers = [
  // Médicos con filtros opcionales ?especialidad=&piso=
http.get("/api/doctors", ({ request }) => {
  const u = new URL(request.url)
  const esp = u.searchParams.get("especialidad")
  const piso = u.searchParams.get("piso")
  const rut = u.searchParams.get("rut")
  const norm = (s: string) => s.replace(/[^0-9kK]/g, "").toUpperCase()

  let data = doctors
  if (rut) {
    const found = data.find(d => norm(d.rut) === norm(rut))
    return HttpResponse.json(found ?? null)
  }
  if (esp) data = data.filter(d => d.especialidad.toLowerCase() === esp.toLowerCase())
  if (piso) data = data.filter(d => String(d.piso) === piso)
  return HttpResponse.json(data)
}),


  // Boxes con filtros ?estado=&especialidad=&piso=
  http.get("/api/boxes", ({ request }) => {
    const u = new URL(request.url)
    const estado = u.searchParams.get("estado")
    const esp = u.searchParams.get("especialidad")
    const piso = u.searchParams.get("piso")
    let data = boxes
    if (estado) data = data.filter(b => b.estado === estado)
    if (esp)    data = data.filter(b => b.especialidad.toLowerCase() === esp.toLowerCase())
    if (piso)   data = data.filter(b => String(b.piso) === piso)
    return HttpResponse.json(data)
  }),

  http.get("/api/bloqueos", () => HttpResponse.json(bloqueos)),

  http.post("/api/bloqueos", async ({ request }) => {
    const body = (await request.json()) as { box:number; fecha:string; motivo:string }
    const nuevo = { id: `b${bloqueos.length+1}`, ...body, creadoPor: "Agendamiento" }
    bloqueos.push(nuevo)
    return HttpResponse.json(nuevo, { status:201 })
  }),

  // KPI ocupación por piso
  http.get("/api/kpis/ocupacion", () => HttpResponse.json(kpiOcupacion)),

http.patch("/api/boxes/:id", async ({ params, request }) => {
  const id = Number(params.id)
  const { estado } = (await request.json()) as { estado: "disponible" | "bloqueado" }
  const i = boxes.findIndex(b => b.id === id)
  if (i === -1) return HttpResponse.json({ message:"not found" }, { status:404 })
  boxes[i] = { ...boxes[i], estado }
  return HttpResponse.json(boxes[i])
}),


]
