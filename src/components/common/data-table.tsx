import type { ReactNode } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { DefaultSkeleton, ErrorState } from "./query-boundary"

/**
 * One column of a `DataTable`. `cell` receives the whole row, so a column can compose
 * several fields without the table needing to know about them.
 */
export interface DataTableColumn<TRow> {
  id: string
  header: ReactNode
  cell: (row: TRow) => ReactNode
  /** Tailwind classes for both the header and body cells in this column. */
  className?: string
  align?: "left" | "right" | "center"
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[]
  rows: TRow[]
  rowKey: (row: TRow) => string
  isLoading?: boolean
  error?: unknown
  /** Rendered in place of the table body when there are no rows. */
  empty?: ReactNode
  onRowClick?: (row: TRow) => void
  className?: string
}

const alignment = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const

/**
 * A typed table for list screens.
 *
 * Deliberately not a headless-table wrapper: these screens need columns, a loading state
 * and an empty state, and nothing else. Sorting and selection are handled by the query
 * layer, so the table stays a rendering concern and every list page looks the same.
 */
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  empty,
  onRowClick,
  className,
}: DataTableProps<TRow>) {
  if (error) {
    return <ErrorState error={error} />
  }

  if (isLoading) {
    return <DefaultSkeleton rows={5} />
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    alignment[column.align ?? "left"],
                    column.className
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      alignment[column.align ?? "left"],
                      column.className
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
