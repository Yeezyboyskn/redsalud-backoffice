"use client"
import { useState } from "react"
import {
  ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, SortingState, useReactTable,
} from "@tanstack/react-table"

export default function DataTable<T>({ columns, data }: { columns: ColumnDef<T, any>[]; data: T[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data, columns, state:{ sorting }, onSortingChange:setSorting,
    getCoreRowModel:getCoreRowModel(), getSortedRowModel:getSortedRowModel(), getPaginationRowModel:getPaginationRowModel(),
  })
  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map(hg=>(
            <tr key={hg.id} className="border-b">
              {hg.headers.map(h=>(
                <th key={h.id} className="text-left py-2 px-2 cursor-pointer" onClick={h.column.getToggleSortingHandler()}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(r=>(
            <tr key={r.id} className="border-b">
              {r.getVisibleCells().map(c=>(
                <td key={c.id} className="py-2 px-2">{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 py-2">
        <button onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</button>
        <button onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()}>Next</button>
      </div>
    </div>
  )
}
