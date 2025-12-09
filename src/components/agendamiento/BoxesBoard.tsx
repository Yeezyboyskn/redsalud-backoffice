"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type Box = { id: number; piso: number; especialidad: string; estado: "disponible" | "bloqueado" }

function Item({ box }: { box: Box }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: box.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border/60 bg-white/90 px-4 py-3 text-sm text-secondary/90 shadow-sm shadow-primary/10 transition ${isDragging ? "opacity-60" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="font-semibold text-secondary">Box {box.id}</div>
      <div className="text-xs text-muted-foreground">Piso {box.piso} - {box.especialidad}</div>
    </div>
  )
}

export default function BoxesBoard() {
  const qc = useQueryClient()
  const { data: boxes = [] } = useQuery<Box[]>({
    queryKey: ["boxes-board"],
    queryFn: () => fetch("/api/boxes").then((r) => r.json()),
  })

  const disponibles = useMemo(() => boxes.filter((b) => b.estado === "disponible"), [boxes])
  const bloqueados = useMemo(() => boxes.filter((b) => b.estado === "bloqueado"), [boxes])

  const patch = useMutation({
    mutationFn: (p: { id: number; estado: "disponible" | "bloqueado" }) =>
      fetch(`/api/boxes/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: p.estado }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boxes-board"] }),
  })

  const onDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id)
    const dest = (e.over?.id as string) || ""
    if (!dest) return
    if (dest === "col-disponible") patch.mutate({ id, estado: "disponible" })
    if (dest === "col-bloqueado") patch.mutate({ id, estado: "bloqueado" })
  }

  useEffect(() => {
    document.querySelectorAll("[data-col]").forEach((n) => n.setAttribute("tabindex", "0"))
  }, [boxes])

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-2">
        <Column id="col-disponible" title="Disponibles" items={disponibles} accent="from-primary/15 to-[#dff4f3]" />
        <Column id="col-bloqueado" title="Bloqueados" items={bloqueados} accent="from-[#fbe7e7] to-[#fef6f6]" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Arrastra un box entre columnas para actualizar su estado dentro de la red.
      </p>
    </DndContext>
  )
}

function Column({ id, title, items, accent }: { id: string; title: string; items: Box[]; accent: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      id={id}
      data-col
      className={`rounded-2xl border border-border/60 bg-linear-to-br ${accent} p-4 shadow-inner shadow-primary/5 transition ${
        isOver ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">{title}</h3>
        <span className="text-xs font-semibold text-secondary/60">{items.length}</span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((b) => (
            <Item key={b.id} box={b} />
          ))}
          {items.length === 0 && <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">Sin boxes</div>}
        </div>
      </SortableContext>
    </div>
  )
}



