import { z } from "zod"

export const boxSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  codigo: z.union([z.string(), z.number()]).optional(),
  piso: z.number(),
  especialidad: z.string().trim(),
  estado: z.enum(["disponible", "bloqueado", "mantencion"]).default("disponible"),
})

export const bloqueoOperativoSchema = z.object({
  boxId: z.union([z.string(), z.number()]),
  fecha: z.string(),
  inicio: z.string(),
  fin: z.string(),
  motivo: z.string().trim(),
  doctorRut: z.string().optional(),
})

export const ticketSchema = z.object({
  tipo: z.enum(["bloqueo", "sistema"]).default("bloqueo"),
  detalle: z.string().min(3),
})

export const updateTicketSchema = z.object({
  id: z.string(),
})

export const blockRequestSchema = z.object({
  fecha: z.string(),
  inicio: z.string(),
  fin: z.string(),
  motivo: z.string(),
  boxId: z.union([z.number(), z.null()]).optional(),
  rut: z.string().optional(),
})

export const blockRequestStatusSchema = z.object({
  id: z.string(),
  estado: z.enum(["pendiente", "aprobado", "rechazado"]),
})

export const extraHourSchema = z.object({
  fecha: z.string(),
  inicio: z.string(),
  fin: z.string(),
  boxId: z.union([z.number(), z.null()]).optional(),
  audience: z.enum(["especialidad"]).optional(),
  especialidad: z.string().optional(),
})
