"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type Box = { id:number; piso:number; especialidad:string; estado:"disponible"|"bloqueado" }

function Item({ box }: { box: Box }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: box.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border p-2 text-sm bg-background ${isDragging ? "opacity-60" : ""}`}
      {...attributes} {...listeners}
    >
      <div className="font-medium">Box {box.id}</div>
      <div className="text-muted-foreground">Piso {box.piso} · {box.especialidad}</div>
    </div>
  )
}

export default function BoxesBoard() {
  const qc = useQueryClient()
  const { data: boxes = [] } = useQuery<Box[]>({
    queryKey:["boxes-board"],
    queryFn:()=>fetch("/api/boxes").then(r=>r.json()),
  })

  const disponibles = useMemo(()=>boxes.filter(b=>b.estado==="disponible"),[boxes])
  const bloqueados  = useMemo(()=>boxes.filter(b=>b.estado==="bloqueado"), [boxes])

  const patch = useMutation({
    mutationFn: (p:{id:number; estado:"disponible"|"bloqueado"}) =>
      fetch(`/api/boxes/${p.id}`,{
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ estado:p.estado })
      }).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey:["boxes-board"] }),
  })

  const onDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id)
    const dest = (e.over?.id as string) || ""
    if (!dest) return
    if (dest === "col-disponible") patch.mutate({ id, estado:"disponible" })
    if (dest === "col-bloqueado")  patch.mutate({ id, estado:"bloqueado"  })
  }

  useEffect(()=>{ document.querySelectorAll("[data-col]").forEach(n=>n.setAttribute("tabindex","0")) },[boxes])

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="grid md:grid-cols-2 gap-4">
        <Column id="col-disponible" title="Disponibles" items={disponibles}/>
        <Column id="col-bloqueado"  title="Bloqueados"  items={bloqueados}/>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Arrastra un box entre columnas para cambiar su estado.
      </div>
    </DndContext>
  )
}

function Column({ id, title, items }: { id:string; title:string; items:Box[] }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      id={id}
      data-col
      className={`rounded border p-3 bg-muted/20 min-h-64 ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <SortableContext items={items.map(i=>i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map(b => <Item key={b.id} box={b} />)}
          {items.length === 0 && <div className="text-xs text-muted-foreground">Sin items</div>}
        </div>
      </SortableContext>
    </div>
  )
}
