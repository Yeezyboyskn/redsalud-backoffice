"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, Clock, FileText, Send } from "lucide-react"

type SpecialRequest = {
  id: string
  tipo: string
  detalle: string
  estado: "pendiente" | "aprobado" | "rechazado"
  fecha_solicitada?: string | null
  horario_actual?: string | null
  horario_solicitado?: string | null
  boxId?: number | null
  createdAt: string
  respuesta?: string | null
}

export default function SpecialRequestsPanel() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState("reajuste_horario")
  const [detalle, setDetalle] = useState("")
  const [fechaSolicitada, setFechaSolicitada] = useState("")
  const [horarioActual, setHorarioActual] = useState("")
  const [horarioSolicitado, setHorarioSolicitado] = useState("")

  const { data: requests = [], isLoading } = useQuery<{ items: SpecialRequest[] }>({
    queryKey: ["doctor-special-requests"],
    queryFn: () => fetch("/api/doctor/special-requests").then((r) => r.json()),
  })

  const createMut = useMutation({
    mutationFn: (payload: any) =>
      fetch("/api/doctor/special-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error("No se pudo crear la solicitud")
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-special-requests"] })
      toast.success("Solicitud especial enviada a agendamiento")
      setShowForm(false)
      setDetalle("")
      setFechaSolicitada("")
      setHorarioActual("")
      setHorarioSolicitado("")
    },
    onError: () => toast.error("Error al enviar la solicitud"),
  })

  const handleSubmit = () => {
    if (!detalle.trim()) {
      toast.error("El detalle es requerido")
      return
    }
    createMut.mutate({
      tipo,
      detalle,
      fecha_solicitada: fechaSolicitada || null,
      horario_actual: horarioActual || null,
      horario_solicitado: horarioSolicitado || null,
    })
  }

  const estadoBadge = (estado: SpecialRequest["estado"]) => {
    if (estado === "aprobado") return <Badge className="bg-emerald-100 text-emerald-800">Aprobado</Badge>
    if (estado === "rechazado") return <Badge className="bg-rose-100 text-rose-800">Rechazado</Badge>
    return <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-white/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-sm">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70">Solicitudes especiales</p>
          <h2 className="text-2xl font-semibold text-secondary">Reajuste de horario</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Solicita cambios en tu horario de trabajo o reasignación de box. Estas solicitudes se envían manualmente al equipo de agendamiento para revisión.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancelar" : "Nueva solicitud"}
        </Button>
      </header>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nueva solicitud especial</CardTitle>
            <CardDescription>Completa los detalles de tu solicitud de reajuste de horario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de solicitud</Label>
              <select className="h-11 w-full rounded-xl border border-border/60 bg-white px-3 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="reajuste_horario">Reajuste de horario</option>
                <option value="cambio_box">Cambio de box</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha solicitada (opcional)</Label>
                <Input type="date" value={fechaSolicitada} onChange={(e) => setFechaSolicitada(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horario actual (opcional)</Label>
                <Input placeholder="Ej: 09:00 - 13:00" value={horarioActual} onChange={(e) => setHorarioActual(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horario solicitado (opcional)</Label>
              <Input placeholder="Ej: 10:00 - 14:00" value={horarioSolicitado} onChange={(e) => setHorarioSolicitado(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Detalle de la solicitud *</Label>
              <Textarea
                placeholder="Describe tu solicitud de reajuste de horario, cambio de box o cualquier otra necesidad especial..."
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <Button onClick={handleSubmit} disabled={createMut.isPending || !detalle.trim()} className="w-full">
              {createMut.isPending ? "Enviando..." : "Enviar solicitud a agendamiento"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mis solicitudes especiales</CardTitle>
          <CardDescription>Historial de solicitudes enviadas al equipo de agendamiento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>}
          {!isLoading && requests.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No tienes solicitudes especiales registradas.</p>
          )}
          {!isLoading &&
            requests.items.map((req) => (
              <div key={req.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-secondary/60" />
                    <span className="font-semibold text-secondary">{req.tipo.replace(/_/g, " ")}</span>
                  </div>
                  {estadoBadge(req.estado)}
                </div>
                <p className="text-secondary/80">{req.detalle}</p>
                {req.fecha_solicitada && (
                  <div className="flex items-center gap-2 text-xs text-secondary/70">
                    <Calendar className="size-3" />
                    <span>Fecha solicitada: {format(new Date(`${req.fecha_solicitada}T00:00:00`), "d 'de' MMMM yyyy", { locale: es })}</span>
                  </div>
                )}
                {req.horario_actual && (
                  <div className="flex items-center gap-2 text-xs text-secondary/70">
                    <Clock className="size-3" />
                    <span>Horario actual: {req.horario_actual}</span>
                  </div>
                )}
                {req.horario_solicitado && (
                  <div className="flex items-center gap-2 text-xs text-secondary/70">
                    <Clock className="size-3" />
                    <span>Horario solicitado: {req.horario_solicitado}</span>
                  </div>
                )}
                {req.respuesta && (
                  <div className="mt-2 rounded-lg border border-border/60 bg-secondary/5 px-3 py-2 text-xs">
                    <span className="font-semibold text-secondary/70">Respuesta de agendamiento:</span>
                    <p className="mt-1 text-secondary/80">{req.respuesta}</p>
                  </div>
                )}
                <span className="text-[10px] text-secondary/60">
                  Creada: {format(new Date(req.createdAt), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>
    </section>
  )
}

