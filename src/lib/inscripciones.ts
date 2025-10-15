export const VENTANA_MINIMA_HORAS = 24

export type DisponibilidadSlot = {
  inicio: string
  fin: string
  requiereAprobacion?: boolean
  motivo?: string
}

export type DisponibilidadBox = {
  id: number
  etiqueta: string
  requiereAprobacion: boolean
  motivos?: string[]
  tramos: DisponibilidadSlot[]
}

export type DisponibilidadDia = {
  fecha: string
  etiqueta: string
  totalBoxes: number
  boxesCompatibles: number
  boxesLibres: number
  conflictos: string[]
  boxes: DisponibilidadBox[]
}

export type DisponibilidadResponse = {
  especialidad: { id: string; nombre: string }
  piso: { id: string; sedeId: string; numero: number; nombre: string; capacidadConcurrente: number; sede?: { id: string; nombre: string } }
  doctor?: { id: number; nombre: string; rut: string }
  rango: { inicio: string; fin: string }
  metadata: {
    bloqueosActualizados: string
    feriadosActualizados: string
    refreshSugeridoMinutos: number
    ventanaMinimaHoras: number
  }
  resumen: { totalBoxesCompatibles: number; diasConDisponibilidad: number }
  dias: DisponibilidadDia[]
}

export type SolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "devuelta"

export type SolicitudInscripcion = {
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
  metadata: {
    ventanaMinimaHoras: number
    conflictos?: string[]
    slaHoras?: number
    slaVenceEnHoras?: number
  }
  doctor?: { id: number; nombre: string; rut: string; especialidades?: string[] }
  especialidad?: { id: string; nombre: string }
  piso?: { id: string; sedeId: string; numero: number; nombre: string }
  box?: { id: number; etiqueta: string }
}

export const ESTADO_CONFIG: Record<SolicitudEstado, { label: string; tone: "pending" | "positive" | "negative" | "warning" }> = {
  pendiente: { label: "Pendiente", tone: "pending" },
  aprobada: { label: "Aprobada", tone: "positive" },
  rechazada: { label: "Rechazada", tone: "negative" },
  devuelta: { label: "Devuelta", tone: "warning" },
}

export const MENSAJES_ERROR = {
  incompatibilidad: "No compatible con la especialidad.",
  bloqueo: "Tramo ocupado o bloqueado.",
  feriado: "Conflicto con feriado de sede.",
  requiereAprobacion: "Requiere aprobacion del equipo de agendamiento.",
  desactualizado: "Datos desactualizados. Actualiza la vista.",
}

export const formatSlotLabel = (slot: { inicio: string; fin: string }) => `${slot.inicio} - ${slot.fin}`

export const formatFechaCorta = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}`
}

export const buildResumenSolicitud = (sol: SolicitudInscripcion) => {
  const fecha = formatFechaCorta(sol.fecha)
  const tramo = formatSlotLabel(sol.tramo)
    const box = sol.box?.etiqueta ? ` - ${sol.box.etiqueta}` : ""
    return `${fecha} - ${tramo}${box}`
}

export const isSlotPast = (fecha: string, slot: { inicio: string }) => {
  const start = new Date(`${fecha}T${slot.inicio}:00Z`)
  return start.getTime() < Date.now()
}

export const sortSolicitudesByPrioridad = (items: SolicitudInscripcion[]) => {
  return [...items].sort((a, b) => {
    const estadoOrden = (estado: SolicitudEstado) =>
      estado === "pendiente" ? 0 : estado === "devuelta" ? 1 : estado === "aprobada" ? 2 : 3
    const byEstado = estadoOrden(a.estado) - estadoOrden(b.estado)
    if (byEstado !== 0) return byEstado
    const slaA = a.metadata.slaVenceEnHoras ?? Number.POSITIVE_INFINITY
    const slaB = b.metadata.slaVenceEnHoras ?? Number.POSITIVE_INFINITY
    if (slaA !== slaB) return slaA - slaB
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}


