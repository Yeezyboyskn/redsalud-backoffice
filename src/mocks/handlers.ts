
import { http, HttpResponse } from "msw"

type Especialidad = { id: string; nombre: string }
type Sede = { id: string; nombre: string }
type Piso = { id: string; sedeId: string; numero: number; nombre: string; capacidadConcurrente: number }
type Box = {
  id: number
  etiqueta: string
  pisoId: string
  estado: "disponible" | "bloqueado"
  capacidades: string[]
  requiereAprobacionPorDefecto?: boolean
}
type Doctor = {
  id: number
  rut: string
  nombre: string
  especialidades: string[]
  asignaciones: { pisoId: string; boxIds: number[] }[]
}
type AgendaEstructural = {
  id: string
  doctorId: number
  boxId: number
  diaSemana: number
  tramoInicio: string
  tramoFin: string
}
type Bloqueo = {
  id: string
  boxId?: number
  doctorId?: number
  fechaInicio: string
  fechaFin: string
  motivo: string
  fuente: string
}
type Feriado = { id: string; sedeId?: string; fecha: string; tipo: string; descripcion: string }
type ReglaCompatibilidad = {
  id: string
  especialidadId: string
  pisoId?: string
  boxId?: number
  permitido: boolean
  motivo?: string
  requiereAprobacion?: boolean
}
type SolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "devuelta"
type BitacoraEntry = {
  id: string
  estadoAnterior: SolicitudEstado
  estadoNuevo: SolicitudEstado
  usuario: string
  timestamp: string
  comentario?: string
}
type SolicitudInscripcion = {
  id: string
  doctorId: number
  especialidadId: string
  pisoId: string
  boxId?: number
  fecha: string
  tramo: { inicio: string; fin: string }
  estado: SolicitudEstado
  requiereAprobacion: boolean
  motivo?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  bitacora: BitacoraEntry[]
  metadata: {
    ventanaMinimaHoras: number
    conflictos?: string[]
    slaHoras?: number
    slaVenceEnHoras?: number
  }
}
type DisponibilidadSlot = { inicio: string; fin: string; requiereAprobacion?: boolean; motivo?: string }

type Ticket = {
  id: string
  tipo: "bloqueo" | "sistema" | "inscripcion"
  detalle: string
  estado: "abierto" | "cerrado"
  creadoPor: string
  relacionadoCon?: string
}

type SolicitudPayload = {
  doctor_id: number
  especialidad_id: string
  piso_id: string
  box_id?: number
  fecha: string
  tramo: { inicio: string; fin: string }
  motivo?: string
}

type SolicitudAccionPayload = {
  accion: "aprobar" | "rechazar" | "devolver"
  comentario?: string
}

const VENTANA_MINIMA_HORAS = 24
const SLA_HORAS = 24
const REFRESH_DISPONIBILIDAD_MINUTOS = 15

const getNow = () => new Date("2025-10-04T15:00:00Z")

const toISODate = (value: Date) => value.toISOString().slice(0, 10)

const addDays = (value: Date, count: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + count)
  return next
}

const parseDateTime = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00Z`)

const diffHours = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 36e5

const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && startB < endA

const diasSemana = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"]

const weekdayIndex = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay()

const makeBitacoraEntry = (
  sol: SolicitudInscripcion,
  estadoNuevo: SolicitudEstado,
  usuario: string,
  comentario?: string,
): BitacoraEntry => ({
  id: `log-${sol.bitacora.length + 1}-${sol.id}`,
  estadoAnterior: sol.estado,
  estadoNuevo,
  usuario,
  timestamp: getNow().toISOString(),
  comentario,
})

const especialidadesCatalog: Especialidad[] = [
  { id: "med-gen", nombre: "Medicina General" },
  { id: "trauma", nombre: "Traumatologia" },
  { id: "cardio", nombre: "Cardiologia" },
  { id: "derma", nombre: "Dermatologia" },
  { id: "odonto", nombre: "Odontologia" },
  { id: "pedi", nombre: "Pediatria" },
]

const especialidadMap = new Map(especialidadesCatalog.map((e) => [e.id, e]))

const sedesCatalog: Sede[] = [
  { id: "scl-central", nombre: "Centro Medico Santiago" },
  { id: "scl-providencia", nombre: "Clinica Providencia" },
  { id: "scl-la-dehesa", nombre: "Clinica La Dehesa" },
]

const pisosCatalog: Piso[] = [
  { id: "scl-central-1", sedeId: "scl-central", numero: 1, nombre: "Piso 1 - Medicina General", capacidadConcurrente: 6 },
  { id: "scl-central-2", sedeId: "scl-central", numero: 2, nombre: "Piso 2 - Dermatologia", capacidadConcurrente: 4 },
  { id: "scl-central-3", sedeId: "scl-central", numero: 3, nombre: "Piso 3 - Traumatologia", capacidadConcurrente: 5 },
  { id: "scl-central-4", sedeId: "scl-central", numero: 4, nombre: "Piso 4 - Odontologia", capacidadConcurrente: 6 },
  { id: "scl-central-5", sedeId: "scl-central", numero: 5, nombre: "Piso 5 - Cardiologia", capacidadConcurrente: 4 },
  { id: "scl-providencia-6", sedeId: "scl-providencia", numero: 6, nombre: "Piso 6 - Alta Especialidad", capacidadConcurrente: 3 },
]

const pisoMap = new Map(pisosCatalog.map((p) => [p.id, p]))

const boxesCatalog: Box[] = [
  { id: 101, etiqueta: "Box 101", pisoId: "scl-central-1", estado: "disponible", capacidades: ["med-gen"] },
  { id: 102, etiqueta: "Box 102", pisoId: "scl-central-1", estado: "bloqueado", capacidades: ["med-gen"] },
  { id: 201, etiqueta: "Box 201", pisoId: "scl-central-2", estado: "disponible", capacidades: ["derma"] },
  { id: 301, etiqueta: "Box 301", pisoId: "scl-central-3", estado: "disponible", capacidades: ["trauma"] },
  { id: 302, etiqueta: "Box 302", pisoId: "scl-central-3", estado: "disponible", capacidades: ["trauma", "med-gen"], requiereAprobacionPorDefecto: true },
  { id: 401, etiqueta: "Box 401", pisoId: "scl-central-4", estado: "disponible", capacidades: ["odonto"] },
  { id: 402, etiqueta: "Box 402", pisoId: "scl-central-4", estado: "disponible", capacidades: ["odonto"] },
  { id: 501, etiqueta: "Box 501", pisoId: "scl-central-5", estado: "disponible", capacidades: ["cardio"] },
  { id: 502, etiqueta: "Box 502", pisoId: "scl-central-5", estado: "bloqueado", capacidades: ["cardio"] },
  { id: 601, etiqueta: "Box 601", pisoId: "scl-providencia-6", estado: "disponible", capacidades: ["cardio", "pedi"] },
]

const boxMap = new Map(boxesCatalog.map((b) => [b.id, b]))

const doctorsCatalog: Doctor[] = [
  {
    id: 1,
    rut: "11.111.111-1",
    nombre: "Dra. Paz Perez",
    especialidades: ["trauma"],
    asignaciones: [{ pisoId: "scl-central-3", boxIds: [301, 302] }],
  },
  {
    id: 2,
    rut: "22.222.222-2",
    nombre: "Dr. Mateo Soto",
    especialidades: ["odonto"],
    asignaciones: [{ pisoId: "scl-central-4", boxIds: [401, 402] }],
  },
  {
    id: 3,
    rut: "33.333.333-3",
    nombre: "Dr. Martin Rojas",
    especialidades: ["cardio"],
    asignaciones: [{ pisoId: "scl-central-5", boxIds: [501, 502] }],
  },
  {
    id: 4,
    rut: "44.444.444-4",
    nombre: "Dra. Javiera Fuentes",
    especialidades: ["derma"],
    asignaciones: [{ pisoId: "scl-central-2", boxIds: [201] }],
  },
  {
    id: 5,
    rut: "55.555.555-5",
    nombre: "Dr. Ignacio Araya",
    especialidades: ["med-gen"],
    asignaciones: [{ pisoId: "scl-central-1", boxIds: [101, 102] }],
  },
  {
    id: 6,
    rut: "66.666.666-6",
    nombre: "Dra. Sofia Herrera",
    especialidades: ["cardio", "pedi"],
    asignaciones: [{ pisoId: "scl-providencia-6", boxIds: [601] }],
  },
]

const doctorMap = new Map(doctorsCatalog.map((d) => [d.id, d]))

const agendaEstructural: AgendaEstructural[] = [
  { id: "ae-1", doctorId: 1, boxId: 301, diaSemana: 1, tramoInicio: "09:00", tramoFin: "13:00" },
  { id: "ae-2", doctorId: 1, boxId: 302, diaSemana: 3, tramoInicio: "15:00", tramoFin: "18:00" },
  { id: "ae-3", doctorId: 2, boxId: 401, diaSemana: 2, tramoInicio: "09:00", tramoFin: "13:00" },
  { id: "ae-4", doctorId: 3, boxId: 501, diaSemana: 4, tramoInicio: "08:30", tramoFin: "12:30" },
  { id: "ae-5", doctorId: 4, boxId: 201, diaSemana: 1, tramoInicio: "10:00", tramoFin: "14:00" },
  { id: "ae-6", doctorId: 5, boxId: 101, diaSemana: 5, tramoInicio: "09:00", tramoFin: "17:00" },
  { id: "ae-7", doctorId: 6, boxId: 601, diaSemana: 2, tramoInicio: "09:00", tramoFin: "12:00" },
]

const bloqueos: Bloqueo[] = [
  {
    id: "b1",
    boxId: 302,
    fechaInicio: "2025-10-07T11:00:00Z",
    fechaFin: "2025-10-07T14:00:00Z",
    motivo: "Mantencion sillan",
    fuente: "Agendamiento",
  },
  {
    id: "b2",
    boxId: 401,
    fechaInicio: "2025-10-08T09:00:00Z",
    fechaFin: "2025-10-08T13:00:00Z",
    motivo: "Reparacion equipo",
    fuente: "Operaciones",
  },
  {
    id: "b3",
    doctorId: 1,
    fechaInicio: "2025-10-09T00:00:00Z",
    fechaFin: "2025-10-09T23:59:59Z",
    motivo: "Congreso anual",
    fuente: "Doctor",
  },
]

let bloqueosUpdatedAt = "2025-10-03T12:00:00Z"

const feriados: Feriado[] = [
  { id: "f1", sedeId: "scl-central", fecha: "2025-10-10", tipo: "local", descripcion: "Aniversario comuna" },
  { id: "f2", fecha: "2025-12-25", tipo: "nacional", descripcion: "Navidad" },
]

const feriadosUpdatedAt = "2025-09-28T08:00:00Z"

const reglasCompatibilidad: ReglaCompatibilidad[] = [
  { id: "rc-1", especialidadId: "trauma", pisoId: "scl-central-2", permitido: false, motivo: "Camillas no reforzadas" },
  {
    id: "rc-2",
    especialidadId: "trauma",
    boxId: 302,
    permitido: true,
    motivo: "Box compartido requiere aprobacion",
    requiereAprobacion: true,
  },
  {
    id: "rc-3",
    especialidadId: "cardio",
    pisoId: "scl-providencia-6",
    permitido: true,
    motivo: "Cardio habilitado en sede Providencia",
  },
  {
    id: "rc-4",
    especialidadId: "derma",
    pisoId: "scl-central-3",
    permitido: false,
    motivo: "Luz UV incompatible con equipamiento traumatologia",
  },
  {
    id: "rc-5",
    especialidadId: "med-gen",
    pisoId: "scl-central-3",
    permitido: true,
    motivo: "Uso puntual requiere validacion",
    requiereAprobacion: true,
  },
]
const tickets: Ticket[] = [
  { id: "15", tipo: "sistema", detalle: "Actualizacion pendiente de fichas", estado: "abierto", creadoPor: "Soporte" },
  { id: "14", tipo: "bloqueo", detalle: "Solicitud horario extra box 301", estado: "abierto", creadoPor: "Agendamiento" },
  { id: "13", tipo: "bloqueo", detalle: "Revision climatizacion piso 4", estado: "cerrado", creadoPor: "Infraestructura" },
]

const solicitudesInscripcionInicial: SolicitudInscripcion[] = [
  {
    id: "SOL-1001",
    doctorId: 1,
    especialidadId: "trauma",
    pisoId: "scl-central-3",
    boxId: 302,
    fecha: "2025-10-07",
    tramo: { inicio: "18:00", fin: "20:00" },
    estado: "pendiente",
    requiereAprobacion: true,
    motivo: "Extender horario vespertino",
    createdBy: "doctor",
    createdAt: "2025-10-04T11:30:00Z",
    updatedAt: "2025-10-04T11:30:00Z",
    bitacora: [
      {
        id: "log-1-SOL-1001",
        estadoAnterior: "pendiente",
        estadoNuevo: "pendiente",
        usuario: "doctor",
        timestamp: "2025-10-04T11:30:00Z",
        comentario: "Solicitud creada desde portal doctor",
      },
    ],
    metadata: {
      ventanaMinimaHoras: VENTANA_MINIMA_HORAS,
      conflictos: ["Requiere aprobacion por uso compartido"],
      slaHoras: SLA_HORAS,
      slaVenceEnHoras: SLA_HORAS - 4,
    },
  },
  {
    id: "SOL-1002",
    doctorId: 2,
    especialidadId: "odonto",
    pisoId: "scl-central-4",
    boxId: 401,
    fecha: "2025-10-05",
    tramo: { inicio: "09:00", fin: "11:00" },
    estado: "aprobada",
    requiereAprobacion: false,
    motivo: "Reprogramacion por paciente preferente",
    createdBy: "doctor",
    createdAt: "2025-09-29T10:00:00Z",
    updatedAt: "2025-09-30T09:00:00Z",
    bitacora: [
      {
        id: "log-1-SOL-1002",
        estadoAnterior: "pendiente",
        estadoNuevo: "pendiente",
        usuario: "doctor",
        timestamp: "2025-09-29T10:00:00Z",
      },
      {
        id: "log-2-SOL-1002",
        estadoAnterior: "pendiente",
        estadoNuevo: "aprobada",
        usuario: "agendamiento",
        timestamp: "2025-09-30T09:00:00Z",
        comentario: "Se agenda en bloque estructural",
      },
    ],
    metadata: {
      ventanaMinimaHoras: VENTANA_MINIMA_HORAS,
      slaHoras: SLA_HORAS,
      slaVenceEnHoras: 0,
    },
  },
]

const solicitudesInscripcion = [...solicitudesInscripcionInicial]
let solicitudSequence = 1003

const disponibilidadPorBox: Record<number, Record<number, DisponibilidadSlot[]>> = {
  301: {
    1: [
      { inicio: "09:00", fin: "10:30" },
      { inicio: "10:30", fin: "12:00" },
    ],
    2: [
      { inicio: "09:00", fin: "10:30" },
      { inicio: "16:00", fin: "18:00", requiereAprobacion: true, motivo: "Horario extendido" },
    ],
    4: [
      { inicio: "09:00", fin: "10:30" },
      { inicio: "10:30", fin: "12:00" },
    ],
  },
  302: {
    1: [
      { inicio: "08:00", fin: "10:00" },
      { inicio: "10:30", fin: "12:30" },
    ],
    3: [
      { inicio: "15:00", fin: "17:00" },
      { inicio: "17:00", fin: "19:00", requiereAprobacion: true, motivo: "Uso compartido" },
    ],
  },
  401: {
    2: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
    ],
    3: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "14:00", fin: "16:00" },
    ],
  },
  402: {
    1: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
    ],
    5: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
    ],
  },
  501: {
    4: [
      { inicio: "08:30", fin: "10:30" },
      { inicio: "10:30", fin: "12:30" },
    ],
    5: [
      { inicio: "09:00", fin: "11:00" },
    ],
  },
  601: {
    2: [
      { inicio: "09:00", fin: "11:00" },
      { inicio: "11:00", fin: "13:00" },
    ],
    4: [
      { inicio: "15:00", fin: "17:00", requiereAprobacion: true, motivo: "Fuera de jornada pediatria" },
    ],
  },
}

const defaultSlots: DisponibilidadSlot[] = [
  { inicio: "09:00", fin: "11:00" },
  { inicio: "11:00", fin: "13:00" },
]
const normRut = (s: string) => s.replace(/[^0-9kK]/g, "").toUpperCase()

const cleanRutKey = (s: string) => s.replace(/[^0-9kK]/g, "").toLowerCase()

const kpiDoctor: Record<string, { semana: { dia: string; ocupacion: number }[]; proximos: { fecha: string; box: number }[] }> = {
  [cleanRutKey("11.111.111-1")]: {
    semana: [
      { dia: "Lun", ocupacion: 80 },
      { dia: "Mar", ocupacion: 68 },
      { dia: "Mie", ocupacion: 72 },
      { dia: "Jue", ocupacion: 75 },
      { dia: "Vie", ocupacion: 64 },
    ],
    proximos: [
      { fecha: "2025-10-06", box: 301 },
      { fecha: "2025-10-07", box: 301 },
      { fecha: "2025-10-09", box: 302 },
    ],
  },
  [cleanRutKey("22.222.222-2")]: {
    semana: [
      { dia: "Lun", ocupacion: 55 },
      { dia: "Mar", ocupacion: 62 },
      { dia: "Mie", ocupacion: 58 },
      { dia: "Jue", ocupacion: 60 },
      { dia: "Vie", ocupacion: 65 },
    ],
    proximos: [
      { fecha: "2025-10-05", box: 401 },
      { fecha: "2025-10-06", box: 402 },
    ],
  },
  [cleanRutKey("33.333.333-3")]: {
    semana: [
      { dia: "Lun", ocupacion: 92 },
      { dia: "Mar", ocupacion: 85 },
      { dia: "Mie", ocupacion: 88 },
      { dia: "Jue", ocupacion: 90 },
      { dia: "Vie", ocupacion: 94 },
    ],
    proximos: [
      { fecha: "2025-10-04", box: 501 },
      { fecha: "2025-10-07", box: 502 },
    ],
  },
}

const kpiOcupacion = [
  { piso: 1, ocupacion: 65 },
  { piso: 2, ocupacion: 74 },
  { piso: 3, ocupacion: 82 },
  { piso: 4, ocupacion: 59 },
  { piso: 5, ocupacion: 87 },
  { piso: 6, ocupacion: 54 },
]

const kpiInscripcion = {
  ultimaActualizacion: "2025-10-03T09:00:00Z",
  porcentajeBoxesReutilizados: 67,
  tasaAprobacion: 82,
  tiempoPromedioAprobacionHoras: 10.4,
  incidenciasIncompatibilidad: 4,
  adopcion: { movil: 38, escritorio: 62 },
}
const evaluateCompatibilidad = (especialidadId: string, box: Box) => {
  const motivos = new Set<string>()
  let permitido = box.capacidades.includes(especialidadId)
  if (!permitido) motivos.add("Box sin equipamiento compatible")
  let requiereAprobacion = Boolean(box.requiereAprobacionPorDefecto)
  for (const regla of reglasCompatibilidad) {
    if (regla.especialidadId !== especialidadId) continue
    if (regla.boxId && regla.boxId !== box.id) continue
    if (regla.pisoId && regla.pisoId !== box.pisoId) continue
    permitido = regla.permitido
    if (regla.motivo) motivos.add(regla.motivo)
    if (regla.requiereAprobacion) requiereAprobacion = true
  }
  return { permitido, requiereAprobacion, motivos: Array.from(motivos) }
}

const doctorTieneTramo = (doctorId: number, diaSemana: number, inicio: string, fin: string) => {
  const agenda = agendaEstructural.filter((a) => a.doctorId === doctorId && a.diaSemana === diaSemana)
  if (!agenda.length) return false
  return agenda.some((item) => item.tramoInicio <= inicio && item.tramoFin >= fin)
}

const getSlotsForBox = (boxId: number, diaSemana: number) => {
  const slots = disponibilidadPorBox[boxId]?.[diaSemana] ?? defaultSlots
  return slots.map((slot) => ({ ...slot }))
}

const computeSlaRestante = (sol: SolicitudInscripcion) => {
  const sla = sol.metadata.slaHoras
  if (!sla) return undefined
  const transcurridas = diffHours(new Date(sol.createdAt), getNow())
  return Number(Math.max(0, sla - transcurridas).toFixed(1))
}

const enrichedSolicitud = (sol: SolicitudInscripcion) => {
  const doctor = doctorMap.get(sol.doctorId)
  const especialidad = especialidadMap.get(sol.especialidadId)
  const piso = pisoMap.get(sol.pisoId)
  const box = sol.boxId ? boxMap.get(sol.boxId) : undefined
  const slaVenceEnHoras = computeSlaRestante(sol)
  return {
    ...sol,
    doctor: doctor
      ? { id: doctor.id, nombre: doctor.nombre, rut: doctor.rut, especialidades: doctor.especialidades }
      : undefined,
    especialidad,
    piso,
    box,
    metadata: {
      ...sol.metadata,
      slaVenceEnHoras,
    },
  }
}

const findDoctorByRut = (rut: string) => {
  const key = normRut(rut)
  return doctorsCatalog.find((d) => normRut(d.rut) === key)
}

const capacidadPisoDisponible = (piso: Piso, fecha: string, tramo: { inicio: string; fin: string }) => {
  const diaSemana = weekdayIndex(fecha)
  const inicio = parseDateTime(fecha, tramo.inicio)
  const fin = parseDateTime(fecha, tramo.fin)
  const aprobadas = solicitudesInscripcion.filter(
    (s) =>
      s.estado === "aprobada" &&
      s.pisoId === piso.id &&
      s.fecha === fecha &&
      rangesOverlap(inicio, fin, parseDateTime(s.fecha, s.tramo.inicio), parseDateTime(s.fecha, s.tramo.fin)),
  )
  const agenda = agendaEstructural.filter(
    (a) =>
      a.diaSemana === diaSemana &&
      boxMap.get(a.boxId)?.pisoId === piso.id &&
      rangesOverlap(inicio, fin, parseDateTime(fecha, a.tramoInicio), parseDateTime(fecha, a.tramoFin)),
  )
  return Math.max(0, piso.capacidadConcurrente - (aprobadas.length + agenda.length))
}

const hasBloqueo = (fecha: string, boxId: number | undefined, doctorId: number | undefined, inicio: Date, fin: Date) => {
  return bloqueos.some((b) => {
    if (b.boxId && boxId && b.boxId !== boxId) return false
    if (b.doctorId && doctorId && b.doctorId !== doctorId) return false
    const bInicio = new Date(b.fechaInicio)
    const bFin = new Date(b.fechaFin)
    return rangesOverlap(bInicio, bFin, inicio, fin)
  })
}

const buildDisponibilidad = (params: {
  especialidadId: string
  piso: Piso
  doctor?: Doctor
  fechaInicio?: string
}) => {
  const { especialidadId, piso, doctor } = params
  const especialidad = especialidadMap.get(especialidadId)
  if (!especialidad) {
    return HttpResponse.json({ message: "Especialidad no encontrada" }, { status: 404 })
  }

  const rawStart = params.fechaInicio ? new Date(`${params.fechaInicio}T00:00:00Z`) : getNow()
  if (Number.isNaN(rawStart.getTime())) {
    return HttpResponse.json({ message: "Fecha invalida" }, { status: 400 })
  }
  const startDow = rawStart.getUTCDay()
  const offset = (startDow + 6) % 7
  const start = addDays(rawStart, -offset)

  const cajasEnPiso = boxesCatalog.filter((box) => box.pisoId === piso.id && box.estado === "disponible")
  const compatPorBox = new Map<number, ReturnType<typeof evaluateCompatibilidad>>()
  cajasEnPiso.forEach((box) => compatPorBox.set(box.id, evaluateCompatibilidad(especialidadId, box)))
  const totalCompatibles = cajasEnPiso.filter((box) => compatPorBox.get(box.id)?.permitido).length

  const dias = Array.from({ length: 7 }).map((_, idx) => {
    const fecha = toISODate(addDays(start, idx))
    const diaSemana = weekdayIndex(fecha)
    const etiqueta = `${diasSemana[diaSemana].toUpperCase()} ${fecha.slice(5, 7)}/${fecha.slice(8, 10)}`
    const feriado = feriados.find((f) => f.fecha === fecha && (!f.sedeId || f.sedeId === piso.sedeId))
    const conflictos = new Set<string>()
    const boxes = [] as {
      id: number
      etiqueta: string
      requiereAprobacion: boolean
      motivos?: string[]
      tramos: DisponibilidadSlot[]
    }[]

    if (feriado) {
      conflictos.add("Conflicto con feriado de sede")
    } else {
      for (const box of cajasEnPiso) {
        const compat = compatPorBox.get(box.id)
        if (!compat || !compat.permitido) continue
        const slots = getSlotsForBox(box.id, diaSemana)
        const tramos = [] as DisponibilidadSlot[]
        for (const slot of slots) {
          const inicio = parseDateTime(fecha, slot.inicio)
          const fin = parseDateTime(fecha, slot.fin)
          if (fin <= inicio) continue
          if (hasBloqueo(fecha, box.id, doctor?.id, inicio, fin)) {
            conflictos.add("Tramo ocupado o bloqueado")
            continue
          }
          if (doctor && hasBloqueo(fecha, undefined, doctor.id, inicio, fin)) {
            conflictos.add("Doctor con bloqueo activo")
            continue
          }
          const duplicadoPendiente = doctor
            ? solicitudesInscripcion.some(
                (s) =>
                  s.estado === "pendiente" &&
                  s.doctorId === doctor.id &&
                  s.fecha === fecha &&
                  s.boxId === box.id &&
                  s.tramo.inicio === slot.inicio &&
                  s.tramo.fin === slot.fin,
              )
            : false
          if (duplicadoPendiente) continue
          const yaAprobado = doctor
            ? solicitudesInscripcion.some(
                (s) =>
                  s.estado === "aprobada" &&
                  s.doctorId === doctor.id &&
                  s.fecha === fecha &&
                  s.boxId === box.id &&
                  s.tramo.inicio === slot.inicio &&
                  s.tramo.fin === slot.fin,
              )
            : false
          if (yaAprobado) continue
          const yaEnAgenda = doctor
            ? agendaEstructural.some(
                (a) =>
                  a.doctorId === doctor.id &&
                  a.boxId === box.id &&
                  a.diaSemana === diaSemana &&
                  a.tramoInicio <= slot.inicio &&
                  a.tramoFin >= slot.fin,
              )
            : false
          if (yaEnAgenda) continue

          let requiereAprobacion = compat.requiereAprobacion || Boolean(slot.requiereAprobacion)
          const motivos = new Set<string>()
          compat.motivos.forEach((m) => motivos.add(m))
          if (slot.motivo) motivos.add(slot.motivo)

          if (doctor && !doctorTieneTramo(doctor.id, diaSemana, slot.inicio, slot.fin)) {
            requiereAprobacion = true
            motivos.add("Fuera de agenda estructural")
          }

          if (diffHours(getNow(), inicio) < VENTANA_MINIMA_HORAS) {
            requiereAprobacion = true
            motivos.add("Menos de 24 horas de aviso")
          }

          tramos.push({
            inicio: slot.inicio,
            fin: slot.fin,
            requiereAprobacion,
            motivo: motivos.size ? Array.from(motivos).join("; ") : undefined,
          })
        }
        if (tramos.length) {
          boxes.push({
            id: box.id,
            etiqueta: box.etiqueta,
            requiereAprobacion: tramos.every((t) => t.requiereAprobacion),
            motivos: compat.motivos,
            tramos,
          })
        }
      }
    }

    return {
      fecha,
      etiqueta,
      totalBoxes: cajasEnPiso.length,
      boxesCompatibles: totalCompatibles,
      boxesLibres: boxes.length,
      conflictos: Array.from(conflictos),
      boxes,
    }
  })

  return HttpResponse.json({
    especialidad,
    piso: { ...piso, sede: sedesCatalog.find((s) => s.id === piso.sedeId) },
    doctor: doctor ? { id: doctor.id, nombre: doctor.nombre, rut: doctor.rut } : undefined,
    rango: { inicio: toISODate(start), fin: toISODate(addDays(start, 6)) },
    metadata: {
      bloqueosActualizados: bloqueosUpdatedAt,
      feriadosActualizados: feriadosUpdatedAt,
      refreshSugeridoMinutos: REFRESH_DISPONIBILIDAD_MINUTOS,
      ventanaMinimaHoras: VENTANA_MINIMA_HORAS,
    },
    resumen: {
      totalBoxesCompatibles: totalCompatibles,
      diasConDisponibilidad: dias.filter((d) => d.boxesLibres > 0).length,
    },
    dias,
  })
}

const catalogoPisosNumeros = () => Array.from(new Set(pisosCatalog.map((p) => p.numero))).sort((a, b) => a - b)

const catalogoEspecialidadesNombres = () => especialidadesCatalog.map((e) => e.nombre).sort()

const siguienteIdTicket = () => {
  const mayor = tickets.reduce((acc, item) => Math.max(acc, Number(item.id)), 0)
  return String(mayor + 1)
}

const createSolicitud = (payload: SolicitudPayload, doctor: Doctor, piso: Piso, box?: Box) => {
  const fecha = payload.fecha
  const tramo = payload.tramo
  const conflictos = [] as string[]
  const diaSemana = weekdayIndex(fecha)
  const slotInicio = parseDateTime(fecha, tramo.inicio)
  const compat = box ? evaluateCompatibilidad(payload.especialidad_id, box) : { permitido: true, requiereAprobacion: false, motivos: [] as string[] }
  let requiereAprobacion = compat.requiereAprobacion

  if (compat.motivos.length) conflictos.push(...compat.motivos)
  if (doctor && !doctorTieneTramo(doctor.id, diaSemana, tramo.inicio, tramo.fin)) {
    requiereAprobacion = true
    conflictos.push("Fuera de agenda estructural")
  }
  if (diffHours(getNow(), slotInicio) < VENTANA_MINIMA_HORAS) {
    requiereAprobacion = true
    conflictos.push("Menos de 24 horas de aviso")
  }

  const nueva: SolicitudInscripcion = {
    id: `SOL-${solicitudSequence++}`,
    doctorId: doctor.id,
    especialidadId: payload.especialidad_id,
    pisoId: piso.id,
    boxId: box?.id,
    fecha,
    tramo,
    estado: "pendiente",
    requiereAprobacion,
    motivo: payload.motivo,
    createdBy: "doctor",
    createdAt: getNow().toISOString(),
    updatedAt: getNow().toISOString(),
    bitacora: [],
    metadata: {
      ventanaMinimaHoras: VENTANA_MINIMA_HORAS,
      conflictos: conflictos.length ? Array.from(new Set(conflictos)) : undefined,
      slaHoras: SLA_HORAS,
      slaVenceEnHoras: SLA_HORAS,
    },
  }
  nueva.bitacora.push({
    id: `log-1-${nueva.id}`,
    estadoAnterior: "pendiente",
    estadoNuevo: "pendiente",
    usuario: "doctor",
    timestamp: nueva.createdAt,
    comentario: "Solicitud creada desde portal doctor",
  })
  solicitudesInscripcion.unshift(nueva)
  tickets.unshift({
    id: siguienteIdTicket(),
    tipo: "inscripcion",
    detalle: `Solicitud ${nueva.id} pendiente de aprobacion`,
    estado: "abierto",
    creadoPor: "Sistema",
    relacionadoCon: nueva.id,
  })
  return nueva
}

const confirmarInscripcion = (doctor: Doctor, payload: SolicitudPayload, piso: Piso, box: Box) => {
  const diaSemana = weekdayIndex(payload.fecha)
  const agendaRegistro: AgendaEstructural = {
    id: `ae-${agendaEstructural.length + 1}`,
    doctorId: doctor.id,
    boxId: box.id,
    diaSemana,
    tramoInicio: payload.tramo.inicio,
    tramoFin: payload.tramo.fin,
  }
  agendaEstructural.push(agendaRegistro)
  return HttpResponse.json(
    {
      estado: "confirmada",
      mensaje: "Inscripcion confirmada",
      agenda: agendaRegistro,
    },
    { status: 201 },
  )
}

const handlePostSolicitud = async (payload: SolicitudPayload) => {
  const doctor = doctorMap.get(payload.doctor_id)
  if (!doctor) {
    return HttpResponse.json({ message: "Doctor no encontrado" }, { status: 404 })
  }
  const piso = pisoMap.get(payload.piso_id)
  if (!piso) {
    return HttpResponse.json({ message: "Piso no encontrado" }, { status: 404 })
  }
  const especialidad = especialidadMap.get(payload.especialidad_id)
  if (!especialidad) {
    return HttpResponse.json({ message: "Especialidad no encontrada" }, { status: 404 })
  }

  if (!doctor.especialidades.includes(payload.especialidad_id)) {
    return HttpResponse.json({ message: "Especialidad no habilitada para el doctor" }, { status: 403 })
  }

  const capacidadDisponible = capacidadPisoDisponible(piso, payload.fecha, payload.tramo)
  if (capacidadDisponible <= 0) {
    return HttpResponse.json({ message: "Capacidad del piso excedida" }, { status: 409 })
  }

  if (feriados.some((f) => f.fecha === payload.fecha && (!f.sedeId || f.sedeId === piso.sedeId))) {
    return HttpResponse.json({ message: "Conflicto con feriado de sede." }, { status: 409 })
  }

  const slotInicio = parseDateTime(payload.fecha, payload.tramo.inicio)
  const slotFin = parseDateTime(payload.fecha, payload.tramo.fin)
  if (hasBloqueo(payload.fecha, payload.box_id, doctor.id, slotInicio, slotFin)) {
    return HttpResponse.json({ message: "Tramo ocupado o bloqueado." }, { status: 409 })
  }

  if (
    solicitudesInscripcion.some(
      (s) =>
        s.estado === "pendiente" &&
        s.doctorId === doctor.id &&
        s.especialidadId === payload.especialidad_id &&
        s.pisoId === payload.piso_id &&
        s.boxId === payload.box_id &&
        s.fecha === payload.fecha &&
        s.tramo.inicio === payload.tramo.inicio &&
        s.tramo.fin === payload.tramo.fin,
    )
  ) {
    return HttpResponse.json({ message: "Ya existe una solicitud pendiente para el mismo tramo." }, { status: 409 })
  }

  const box = payload.box_id ? boxMap.get(payload.box_id) : undefined
  if (payload.box_id && !box) {
    return HttpResponse.json({ message: "Box no encontrado" }, { status: 404 })
  }
  if (box && box.pisoId !== piso.id) {
    return HttpResponse.json({ message: "El box no pertenece al piso seleccionado" }, { status: 400 })
  }
  if (box) {
    const compat = evaluateCompatibilidad(payload.especialidad_id, box)
    if (!compat.permitido) {
      return HttpResponse.json({ message: "No compatible con la especialidad.", detalles: compat.motivos }, { status: 409 })
    }
  }

  if (diffHours(getNow(), slotInicio) < 0) {
    return HttpResponse.json({ message: "Datos desactualizados. Actualiza la vista." }, { status: 409 })
  }

  const requiereTicket = (() => {
    if (!box) return true
    const compat = evaluateCompatibilidad(payload.especialidad_id, box)
    if (!compat.permitido) return true
    if (compat.requiereAprobacion) return true
    if (!doctorTieneTramo(doctor.id, weekdayIndex(payload.fecha), payload.tramo.inicio, payload.tramo.fin)) return true
    if (diffHours(getNow(), slotInicio) < VENTANA_MINIMA_HORAS) return true
    if (box.requiereAprobacionPorDefecto) return true
    return false
  })()

  if (!requiereTicket && box) {
    return confirmarInscripcion(doctor, payload, piso, box)
  }

  const solicitud = createSolicitud(payload, doctor, piso, box)
  return HttpResponse.json(solicitud, { status: 202 })
}

const catalogoBoxes = () =>
  boxesCatalog.map((box) => {
    const piso = pisoMap.get(box.pisoId)
    const especialidades = box.capacidades
      .map((id) => especialidadMap.get(id)?.nombre || id)
      .join(", ")
    return {
      id: box.id,
      piso: piso?.numero ?? 0,
      pisoId: box.pisoId,
      sedeId: piso?.sedeId,
      especialidad: especialidades.split(", ")[0] || "",
      especialidades,
      estado: box.estado,
    }
  })
const parseRange = (range: string | null | undefined) => {
  if (!range) return undefined
  const [inicio, fin] = range.split(":")
  if (!inicio || !fin) return undefined
  return { inicio: new Date(`${inicio}T00:00:00Z`), fin: new Date(`${fin}T23:59:59Z`) }
}

const filterPorSedes = (items: Bloqueo[], sedesParam: string | null | undefined) => {
  if (!sedesParam) return items
  const sedes = new Set(sedesParam.split(","))
  return items.filter((item) => {
    const pisoId = item.boxId ? boxMap.get(item.boxId)?.pisoId : undefined
    const sedeId = pisoId ? pisoMap.get(pisoId)?.sedeId : undefined
    return sedeId ? sedes.has(sedeId) : true
  })
}

const bloquearTicketRelacionado = (solicitudId: string, estado: "cerrado" | "abierto") => {
  const ticket = tickets.find((t) => t.relacionadoCon === solicitudId && t.estado !== estado)
  if (ticket) ticket.estado = estado
}
export const handlers = [
  http.get("/api/doctors", ({ request }) => {
    const u = new URL(request.url)
    const rut = u.searchParams.get("rut")
    const doctor = rut ? findDoctorByRut(rut) : undefined
    if (rut) {
      if (!doctor) return HttpResponse.json(null)
      const especialidades = doctor.especialidades.map((id) => especialidadMap.get(id)?.nombre || id)
      const asignaciones = doctor.asignaciones.map((a) => ({
        piso: pisoMap.get(a.pisoId),
        boxIds: a.boxIds,
      }))
      return HttpResponse.json({
        id: doctor.id,
        rut: doctor.rut,
        nombre: doctor.nombre,
        especialidadId: doctor.especialidades[0],
        especialidadIds: doctor.especialidades,
        especialidades,
        asignaciones,
      })
    }
    let data = [...doctorsCatalog]
    const esp = u.searchParams.get("especialidad")
    const piso = u.searchParams.get("piso")
    if (esp) data = data.filter((d) => d.especialidades.some((id) => especialidadMap.get(id)?.nombre.toLowerCase() === esp.toLowerCase()))
    if (piso) data = data.filter((d) => d.asignaciones.some((a) => pisoMap.get(a.pisoId)?.numero === Number(piso)))
    return HttpResponse.json(
      data.map((d) => ({
        id: d.id,
        rut: d.rut,
        nombre: d.nombre,
        especialidades: d.especialidades.map((id) => especialidadMap.get(id)?.nombre || id),
        piso: d.asignaciones.map((a) => pisoMap.get(a.pisoId)?.numero)[0],
        boxes: d.asignaciones.flatMap((a) => a.boxIds),
      })),
    )
  }),

  http.get("/api/boxes", ({ request }) => {
    const u = new URL(request.url)
    const estado = u.searchParams.get("estado")
    const esp = u.searchParams.get("especialidad")
    const pisoNumero = u.searchParams.get("piso")
    let data = catalogoBoxes()
    if (estado) data = data.filter((b) => b.estado === estado)
    if (esp) data = data.filter((b) => b.especialidades.toLowerCase().includes(esp.toLowerCase()))
    if (pisoNumero) data = data.filter((b) => String(b.piso) === pisoNumero)
    return HttpResponse.json(data)
  }),

  http.patch("/api/boxes/:id", async ({ params, request }) => {
    const id = Number(params.id)
    const payload = (await request.json()) as { estado: "disponible" | "bloqueado" }
    const box = boxMap.get(id)
    if (!box) return HttpResponse.json({ message: "not found" }, { status: 404 })
    box.estado = payload.estado
    return HttpResponse.json({ ok: true })
  }),

  http.get("/api/bloqueos", ({ request }) => {
    const u = new URL(request.url)
    const range = parseRange(u.searchParams.get("range"))
    const filtered = filterPorSedes(bloqueos, u.searchParams.get("sedes"))
      .filter((b) => {
        if (!range) return true
        const inicio = new Date(b.fechaInicio)
        const fin = new Date(b.fechaFin)
        return rangesOverlap(range.inicio, range.fin, inicio, fin)
      })
      .map((b) => ({
        id: b.id,
        box: b.boxId ?? null,
        doctorId: b.doctorId ?? null,
        fecha: toISODate(new Date(b.fechaInicio)),
        fechaInicio: b.fechaInicio,
        fechaFin: b.fechaFin,
        motivo: b.motivo,
        creadoPor: b.fuente,
      }))
    return HttpResponse.json({ items: filtered, updatedAt: bloqueosUpdatedAt })
  }),

  http.post("/api/bloqueos", async ({ request }) => {
    const body = (await request.json()) as { box?: number; boxId?: number; fecha?: string; fechaInicio?: string; fechaFin?: string; motivo: string }
    const boxId = Number(body.box ?? body.boxId)
    const fecha = body.fecha ?? (body.fechaInicio ? body.fechaInicio.slice(0, 10) : toISODate(getNow()))
    const fechaInicio = body.fechaInicio ?? `${fecha}T00:00:00Z`
    const fechaFin = body.fechaFin ?? `${fecha}T23:59:59Z`
    const nuevo: Bloqueo = {
      id: `b${bloqueos.length + 1}`,
      boxId: Number.isFinite(boxId) ? boxId : undefined,
      fechaInicio,
      fechaFin,
      motivo: body.motivo,
      fuente: "Agendamiento",
    }
    bloqueos.push(nuevo)
    bloqueosUpdatedAt = getNow().toISOString()
    return HttpResponse.json({
      id: nuevo.id,
      box: nuevo.boxId ?? null,
      fecha,
      fechaInicio: nuevo.fechaInicio,
      fechaFin: nuevo.fechaFin,
      motivo: nuevo.motivo,
      creadoPor: nuevo.fuente,
    }, { status: 201 })
  }),

  http.get("/api/tickets", () => HttpResponse.json(tickets)),

  http.post("/api/tickets", async ({ request }) => {
    const { tipo, detalle } = (await request.json()) as { tipo: Ticket["tipo"]; detalle: string }
    const ticket: Ticket = { id: siguienteIdTicket(), tipo, detalle, estado: "abierto", creadoPor: "Agendamiento" }
    tickets.unshift(ticket)
    return HttpResponse.json(ticket, { status: 201 })
  }),

  http.patch("/api/tickets/:id/cerrar", ({ params }) => {
    const ticket = tickets.find((t) => t.id === String(params.id))
    if (ticket) ticket.estado = "cerrado"
    return HttpResponse.json({ ok: true })
  }),
  http.get("/api/kpis/ocupacion", () => HttpResponse.json(kpiOcupacion)),

  http.get("/api/kpis/doctor", ({ request }) => {
    const u = new URL(request.url)
    const rut = cleanRutKey(u.searchParams.get("rut") || "")
    const data = kpiDoctor[rut] ?? { semana: [], proximos: [] }
    return HttpResponse.json(data)
  }),

  http.get("/api/kpis/inscripcion", ({ request }) => {
    const u = new URL(request.url)
    const desde = u.searchParams.get("desde")
    const hasta = u.searchParams.get("hasta")
    return HttpResponse.json({ ...kpiInscripcion, filtro: { desde, hasta } })
  }),

  http.get("/api/catalogos/especialidades", ({ request }) => {
    const u = new URL(request.url)
    if (u.searchParams.get("detalle") === "1") {
      return HttpResponse.json(especialidadesCatalog)
    }
    return HttpResponse.json(catalogoEspecialidadesNombres())
  }),

  http.post("/api/catalogos/especialidades", async ({ request }) => {
    const { value } = (await request.json()) as { value: string }
    const nombre = value?.trim()
    if (!nombre) return HttpResponse.json({ message: "bad" }, { status: 400 })
    if (!especialidadesCatalog.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) {
      const id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      especialidadesCatalog.push({ id, nombre })
      especialidadMap.set(id, { id, nombre })
    }
    return HttpResponse.json({ ok: true })
  }),

  http.delete("/api/catalogos/especialidades/:value", ({ params }) => {
    const value = String(params.value)
    const index = especialidadesCatalog.findIndex((e) => e.id === value || e.nombre === value)
    if (index >= 0) {
      const [removed] = especialidadesCatalog.splice(index, 1)
      especialidadMap.delete(removed.id)
    }
    return HttpResponse.json({ ok: true })
  }),

  http.get("/api/catalogos/pisos", ({ request }) => {
    const u = new URL(request.url)
    if (u.searchParams.get("detalle") === "1") {
      return HttpResponse.json(pisosCatalog)
    }
    return HttpResponse.json(catalogoPisosNumeros())
  }),

  http.post("/api/catalogos/pisos", async ({ request }) => {
    const { value } = (await request.json()) as { value: number | Piso }
    if (typeof value === "number") {
      if (!pisosCatalog.some((p) => p.numero === value)) {
        const nuevo: Piso = {
          id: `custom-${value}`,
          sedeId: "scl-central",
          numero: value,
          nombre: `Piso ${value} - Generico`,
          capacidadConcurrente: 3,
        }
        pisosCatalog.push(nuevo)
        pisoMap.set(nuevo.id, nuevo)
      }
      return HttpResponse.json({ ok: true })
    }
    if (value && typeof value === "object") {
      const exists = pisosCatalog.some((p) => p.id === value.id || p.numero === value.numero)
      if (!exists) {
        pisosCatalog.push(value)
        pisoMap.set(value.id, value)
      }
      return HttpResponse.json({ ok: true })
    }
    return HttpResponse.json({ message: "bad" }, { status: 400 })
  }),

  http.delete("/api/catalogos/pisos/:value", ({ params }) => {
    const value = String(params.value)
    const index = pisosCatalog.findIndex((p) => String(p.numero) === value || p.id === value)
    if (index >= 0) {
      const [removed] = pisosCatalog.splice(index, 1)
      pisoMap.delete(removed.id)
      for (let i = boxesCatalog.length - 1; i >= 0; i -= 1) {
        if (boxesCatalog[i].pisoId === removed.id) {
          boxMap.delete(boxesCatalog[i].id)
          boxesCatalog.splice(i, 1)
        }
      }
    }
    return HttpResponse.json({ ok: true })
  }),

  http.get("/api/catalogos/sedes", () => HttpResponse.json(sedesCatalog)),

  http.get("/api/catalogos/boxes", () => HttpResponse.json(catalogoBoxes())),

  http.post("/api/catalogos/boxes", async ({ request }) => {
    const body = (await request.json()) as { id: number; piso: number; especialidad: string; estado?: "disponible" | "bloqueado" }
    if (!body.id || !body.piso || !body.especialidad) {
      return HttpResponse.json({ message: "faltan campos" }, { status: 400 })
    }
    if (boxMap.has(body.id)) {
      return HttpResponse.json({ message: "box ya existe" }, { status: 409 })
    }
    const piso = pisosCatalog.find((p) => p.numero === Number(body.piso))
    if (!piso) {
      return HttpResponse.json({ message: "piso no encontrado" }, { status: 404 })
    }
    const especialidad = especialidadesCatalog.find((e) => e.nombre.toLowerCase() === body.especialidad.toLowerCase())
    if (!especialidad) {
      return HttpResponse.json({ message: "especialidad no encontrada" }, { status: 404 })
    }
    const nuevo: Box = {
      id: body.id,
      etiqueta: `Box ${body.id}`,
      pisoId: piso.id,
      estado: body.estado ?? "disponible",
      capacidades: [especialidad.id],
    }
    boxesCatalog.push(nuevo)
    boxMap.set(nuevo.id, nuevo)
    return HttpResponse.json({ ok: true }, { status: 201 })
  }),

  http.delete("/api/catalogos/boxes/:id", ({ params }) => {
    const id = Number(params.id)
    const index = boxesCatalog.findIndex((b) => b.id === id)
    if (index >= 0) {
      boxMap.delete(id)
      boxesCatalog.splice(index, 1)
    }
    return HttpResponse.json({ ok: true })
  }),

  http.get("/api/reglas/compatibilidad", ({ request }) => {
    const u = new URL(request.url)
    const especialidadId = u.searchParams.get("especialidad_id")
    const pisoId = u.searchParams.get("piso_id")
    const boxId = u.searchParams.get("box_id")
    let data = [...reglasCompatibilidad]
    if (especialidadId) data = data.filter((r) => r.especialidadId === especialidadId)
    if (pisoId) data = data.filter((r) => !r.pisoId || r.pisoId === pisoId)
    if (boxId) data = data.filter((r) => !r.boxId || r.boxId === Number(boxId))
    return HttpResponse.json(data)
  }),
  http.get("/api/disponibilidad", ({ request }) => {
    const u = new URL(request.url)
    const especialidadId = u.searchParams.get("especialidad_id")
    const pisoId = u.searchParams.get("piso_id")
    const doctorId = u.searchParams.get("doctor_id")
    const fecha = u.searchParams.get("fecha")
    if (!especialidadId || !pisoId) {
      return HttpResponse.json({ message: "Parametros obligatorios" }, { status: 400 })
    }
    const piso = pisoMap.get(pisoId)
    if (!piso) return HttpResponse.json({ message: "Piso no encontrado" }, { status: 404 })
    const doctor = doctorId ? doctorMap.get(Number(doctorId)) : undefined
    return buildDisponibilidad({ especialidadId, piso, doctor, fechaInicio: fecha ?? undefined })
  }),

  http.post("/api/inscripciones", async ({ request }) => {
    const payload = (await request.json()) as SolicitudPayload
    return handlePostSolicitud(payload)
  }),

  http.get("/api/inscripciones", ({ request }) => {
    const u = new URL(request.url)
    const estado = u.searchParams.get("estado")
    const especialidad = u.searchParams.get("especialidad")
    const doctorId = u.searchParams.get("doctor")
    const sede = u.searchParams.get("sede")

    let data = solicitudesInscripcion.map(enrichedSolicitud)
    if (estado) data = data.filter((s) => s.estado === estado)
    if (especialidad) data = data.filter((s) => s.especialidadId === especialidad)
    if (doctorId) data = data.filter((s) => String(s.doctorId) === doctorId)
    if (sede) data = data.filter((s) => pisoMap.get(s.pisoId)?.sedeId === sede)

    return HttpResponse.json({
      items: data,
      total: data.length,
      metadata: {
        slaHoras: SLA_HORAS,
      },
    })
  }),

  http.patch("/api/inscripciones/:id", async ({ params, request }) => {
    const sol = solicitudesInscripcion.find((s) => s.id === String(params.id))
    if (!sol) return HttpResponse.json({ message: "Solicitud no encontrada" }, { status: 404 })
    const body = (await request.json()) as SolicitudAccionPayload
    const accion = body.accion
    if (!accion) return HttpResponse.json({ message: "Accion requerida" }, { status: 400 })
    const comentario = body.comentario

    let nuevoEstado: SolicitudEstado
    if (accion === "aprobar") nuevoEstado = "aprobada"
    else if (accion === "rechazar") nuevoEstado = "rechazada"
    else nuevoEstado = "devuelta"

    if (sol.estado === nuevoEstado) {
      return HttpResponse.json(enrichedSolicitud(sol))
    }

    sol.bitacora.push(makeBitacoraEntry(sol, nuevoEstado, "agendamiento", comentario))
    sol.estado = nuevoEstado
    sol.updatedAt = getNow().toISOString()
    sol.metadata.slaVenceEnHoras = computeSlaRestante(sol)

    if (nuevoEstado === "aprobada") {
      sol.requiereAprobacion = false
      const piso = pisoMap.get(sol.pisoId)
      if (!sol.boxId) {
        const cajaCompat = boxesCatalog.find((c) => c.pisoId === sol.pisoId && evaluateCompatibilidad(sol.especialidadId, c).permitido)
        if (cajaCompat) {
          sol.boxId = cajaCompat.id
        }
      }
      const finalBox = sol.boxId ? boxMap.get(sol.boxId) : undefined
      if (piso && finalBox) {
        agendaEstructural.push({
          id: `ae-${agendaEstructural.length + 1}`,
          doctorId: sol.doctorId,
          boxId: finalBox.id,
          diaSemana: weekdayIndex(sol.fecha),
          tramoInicio: sol.tramo.inicio,
          tramoFin: sol.tramo.fin,
        })
      }
      bloquearTicketRelacionado(sol.id, "cerrado")
    } else if (nuevoEstado === "rechazada") {
      sol.requiereAprobacion = false
      bloquearTicketRelacionado(sol.id, "cerrado")
      if (comentario) {
        sol.metadata.conflictos = [...new Set([...(sol.metadata.conflictos ?? []), comentario])]
      }
    } else if (nuevoEstado === "devuelta") {
      sol.requiereAprobacion = true
      bloquearTicketRelacionado(sol.id, "abierto")
      if (comentario) {
        sol.metadata.conflictos = [...new Set([...(sol.metadata.conflictos ?? []), comentario])]
      }
    }

    return HttpResponse.json(enrichedSolicitud(sol))
  }),

  http.get("/api/feriados", ({ request }) => {
    const u = new URL(request.url)
    const sedes = u.searchParams.get("sedes")
    const range = parseRange(u.searchParams.get("range"))
    let data = [...feriados]
    if (sedes) {
      const allowed = new Set(sedes.split(","))
      data = data.filter((f) => !f.sedeId || allowed.has(f.sedeId))
    }
    if (range) {
      data = data.filter((f) => {
        const fecha = new Date(`${f.fecha}T00:00:00Z`)
        return fecha >= range.inicio && fecha <= range.fin
      })
    }
    return HttpResponse.json({ items: data, updatedAt: feriadosUpdatedAt })
  }),
]

