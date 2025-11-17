"use client"
import { useQuery } from "@tanstack/react-query"

type Profile = { nombre: string; rut: string; especialidad: string; boxes: { id: number; etiqueta: string }[] }

export default function DoctorProfileCard() {
  const query = useQuery<Profile>({
    queryKey: ["doctor-profile"],
    queryFn: async () => {
      const res = await fetch("/api/doctor/profile")
      return res.json()
    },
  })

  const p = query.data
  return (
    <section className="rounded-2xl border border-border/60 bg-white/95 p-6 shadow-xl shadow-primary/10 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-secondary/60">Perfil profesional</span>
          <h1 className="text-2xl font-semibold text-secondary">{p?.nombre ?? "Cargando..."}</h1>
          <p className="text-sm text-secondary/80">RUT {p?.rut}</p>
          <p className="text-sm text-secondary/80">Especialidad: <span className="font-medium">{p?.especialidad}</span></p>
        </div>
        <div className="text-xs text-muted-foreground">
          {p?.boxes?.length ? <span>{p.boxes.length} box(es) asignados</span> : <span>Sin boxes asignados</span>}
        </div>
      </div>
    </section>
  )
}

