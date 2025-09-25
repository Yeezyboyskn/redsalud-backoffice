import { http, HttpResponse } from "msw"

/* =========================
 *   Datos base (mock)
 * ========================= */
const doctors = [
  { id: 1, rut: "11.111.111-1", nombre: "Dra. Pérez", especialidad: "Traumato", piso: 3, boxes: [301, 302] },
  { id: 2, rut: "22.222.222-2", nombre: "Dr. Soto",  especialidad: "Odonto",  piso: 4, boxes: [401] },
  { id: 3, rut: "33.333.333-3", nombre: "Dr. Rojas", especialidad: "Cardio",  piso: 5, boxes: [501] },
] as const

const boxes: { id:number; piso:number; especialidad:string; estado:"disponible"|"bloqueado" }[] = [
  { id: 301, piso: 3, especialidad: "Traumato", estado: "disponible" },
  { id: 302, piso: 3, especialidad: "Traumato", estado: "bloqueado"  },
  { id: 401, piso: 4, especialidad: "Odonto",  estado: "disponible" },
  { id: 501, piso: 5, especialidad: "Cardio",  estado: "disponible" },
]

let especialidades = Array.from(new Set([
  ...doctors.map(d => d.especialidad),
  ...boxes.map(b => b.especialidad),
])).sort()

let pisos = Array.from(new Set(boxes.map(b => b.piso))).sort((a,b)=>a-b)

const bloqueos: { id:string; box:number; fecha:string; motivo:string; creadoPor:string }[] = [
  { id: "b1", box: 302, fecha: "2025-09-25", motivo: "Mantención", creadoPor: "Jefatura" },
]

const tickets: { id:string; tipo:"bloqueo"|"sistema"; detalle:string; estado:"abierto"|"cerrado"; creadoPor:string }[] = []

const kpiOcupacion = [
  { piso: 3, ocupacion: 72 },
  { piso: 4, ocupacion: 61 },
  { piso: 5, ocupacion: 83 },
]

const kpiDoctor: Record<string, { semana:{dia:string; ocupacion:number}[]; proximos:{fecha:string; box:number}[] }> = {
  "111111111": {
    semana: [
      { dia:"Lun", ocupacion: 80 },
      { dia:"Mar", ocupacion: 65 },
      { dia:"Mié", ocupacion: 70 },
      { dia:"Jue", ocupacion: 75 },
      { dia:"Vie", ocupacion: 60 },
    ],
    proximos: [
      { fecha:"2025-10-01", box:301 },
      { fecha:"2025-10-02", box:301 },
      { fecha:"2025-10-04", box:302 },
    ],
  },
}

/* Utils */
const normRut = (s: string) => s.replace(/[^0-9kK]/g, "").toUpperCase()
const clean = (s:string) => s.replace(/[^0-9kK]/g,"").toLowerCase()

/* =========================
 *       Handlers
 * ========================= */
export const handlers = [

  /* ---- Doctors ---- */
  http.get("/api/doctors", ({ request }) => {
    const u = new URL(request.url)
    const esp = u.searchParams.get("especialidad")
    const piso = u.searchParams.get("piso")
    const rut  = u.searchParams.get("rut")

    let data = [...doctors]
    if (rut) {
      const found = data.find(d => normRut(d.rut) === normRut(rut))
      return HttpResponse.json(found ?? null)
    }
    if (esp) data = data.filter(d => d.especialidad.toLowerCase() === esp.toLowerCase())
    if (piso) data = data.filter(d => String(d.piso) === piso)
    return HttpResponse.json(data)
  }),

  /* ---- Boxes list + filter ---- */
  http.get("/api/boxes", ({ request }) => {
    const u = new URL(request.url)
    const estado = u.searchParams.get("estado")
    const esp    = u.searchParams.get("especialidad")
    const piso   = u.searchParams.get("piso")
    let data = [...boxes]
    if (estado) data = data.filter(b => b.estado === estado)
    if (esp)    data = data.filter(b => b.especialidad.toLowerCase() === esp.toLowerCase())
    if (piso)   data = data.filter(b => String(b.piso) === piso)
    return HttpResponse.json(data)
  }),

  /* ---- Boxes patch estado ---- */
  http.patch("/api/boxes/:id", async ({ params, request }) => {
    const id = Number(params.id)
    const { estado } = (await request.json()) as { estado: "disponible" | "bloqueado" }
    const i = boxes.findIndex(b => b.id === id)
    if (i === -1) return HttpResponse.json({ message: "not found" }, { status: 404 })
    boxes[i] = { ...boxes[i], estado }
    return HttpResponse.json(boxes[i])
  }),

  /* ---- Bloqueos ---- */
  http.get("/api/bloqueos", () => HttpResponse.json(bloqueos)),
  http.post("/api/bloqueos", async ({ request }) => {
    const body = (await request.json()) as { box:number; fecha:string; motivo:string }
    const nuevo = { id: `b${bloqueos.length + 1}`, ...body, creadoPor: "Agendamiento" }
    bloqueos.push(nuevo)
    return HttpResponse.json(nuevo, { status: 201 })
  }),

  /* ---- Tickets ---- */
  http.get("/api/tickets", () => HttpResponse.json(tickets)),
  http.post("/api/tickets", async ({ request }) => {
    const { tipo, detalle } = (await request.json()) as { tipo:"bloqueo"|"sistema"; detalle:string }
    const t = { id:String(tickets.length+1), tipo, detalle, estado:"abierto" as const, creadoPor:"Agendamiento" }
    tickets.unshift(t)
    return HttpResponse.json(t, { status:201 })
  }),
  http.patch("/api/tickets/:id/cerrar", ({ params }) => {
    const i = tickets.findIndex(t=>t.id===String(params.id))
    if (i>=0) tickets[i].estado = "cerrado"
    return HttpResponse.json({ ok:true })
  }),

  /* ---- KPIs ---- */
  http.get("/api/kpis/ocupacion", () => HttpResponse.json(kpiOcupacion)),
  http.get("/api/kpis/doctor", ({ request }) => {
    const u = new URL(request.url)
    const rut = u.searchParams.get("rut") || ""
    const data = kpiDoctor[clean(rut)] ?? { semana:[], proximos:[] }
    return HttpResponse.json(data)
  }),

  /* ---- Catálogo: Especialidades ---- */
  http.get("/api/catalogos/especialidades", () => HttpResponse.json(especialidades)),
  http.post("/api/catalogos/especialidades", async ({ request }) => {
    const { value } = (await request.json()) as { value:string }
    const v = value?.trim()
    if (!v) return HttpResponse.json({ message:"bad" }, { status:400 })
    if (!especialidades.includes(v)) especialidades.push(v)
    especialidades.sort()
    return HttpResponse.json({ ok:true })
  }),
  http.delete("/api/catalogos/especialidades/:value", ({ params }) => {
    const v = String(params.value)
    especialidades = especialidades.filter(e => e !== v)
    return HttpResponse.json({ ok:true })
  }),

  /* ---- Catálogo: Pisos ---- */
  http.get("/api/catalogos/pisos", () => HttpResponse.json(pisos)),
  http.post("/api/catalogos/pisos", async ({ request }) => {
    const { value } = (await request.json()) as { value:number }
    const n = Number(value)
    if (!Number.isFinite(n)) return HttpResponse.json({ message:"bad" }, { status:400 })
    if (!pisos.includes(n)) pisos.push(n)
    pisos.sort((a,b)=>a-b)
    return HttpResponse.json({ ok:true })
  }),
  http.delete("/api/catalogos/pisos/:value", ({ params }) => {
    const n = Number(params.value)
    pisos = pisos.filter(p => p !== n)
    // Opcional: eliminar boxes del piso borrado
    for (let i = boxes.length - 1; i >= 0; i--) if (boxes[i].piso === n) boxes.splice(i, 1)
    return HttpResponse.json({ ok:true })
  }),

  /* ---- Catálogo: Boxes CRUD ---- */
  http.get("/api/catalogos/boxes", () => HttpResponse.json(boxes)),
  http.post("/api/catalogos/boxes", async ({ request }) => {
    const { id, piso, especialidad, estado } = (await request.json()) as {
      id:number; piso:number; especialidad:string; estado?:"disponible"|"bloqueado"
    }
    if (!id || !piso || !especialidad?.trim()) {
      return HttpResponse.json({ message:"faltan campos" }, { status:400 })
    }
    if (boxes.some(b => b.id === id)) {
      return HttpResponse.json({ message:"box ya existe" }, { status:409 })
    }
    if (!pisos.includes(piso)) pisos.push(piso)
    if (!especialidades.includes(especialidad)) especialidades.push(especialidad)
    boxes.push({ id, piso, especialidad, estado: estado ?? "disponible" })
    return HttpResponse.json({ ok:true }, { status:201 })
  }),
  http.delete("/api/catalogos/boxes/:id", ({ params }) => {
    const id = Number(params.id)
    const i = boxes.findIndex(b=>b.id===id)
    if (i>=0) boxes.splice(i,1)
    return HttpResponse.json({ ok:true })
  }),
]
