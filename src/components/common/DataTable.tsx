"use client"
import { useState } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"

export default function DataTable<T>({ columns, data }: { columns: ColumnDef<T, any>[]; data: T[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })
  return (
    <div className="w-full overflow-auto rounded-2xl border border-border/70 bg-white/80 shadow-sm shadow-primary/10 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-secondary">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border/60">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="text-left py-3 px-4 uppercase text-xs font-semibold tracking-[0.16em] text-secondary/80 cursor-pointer"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 last:border-b-0 hover:bg-accent/40">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="py-3 px-4 text-secondary/90">
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/40">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70 disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="h-3 w-px bg-border/70" aria-hidden />
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary/70 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}


