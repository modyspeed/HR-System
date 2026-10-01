import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListX } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export interface DataColumn<Row> {
  key: keyof Row;
  label: string;
  render?: (row: Row) => ReactNode;
  compare?: (left: Row, right: Row) => number;
}

interface DataTableProps<Row extends { id: string | number }> {
  rows: Row[];
  columns: DataColumn<Row>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<Row extends { id: string | number }>({
  rows,
  columns,
  loading = false,
  emptyTitle = "لا توجد بيانات",
  emptyDescription = "ستظهر البيانات هنا عند توفرها.",
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = useState<keyof Row | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((item) => item.key === sortKey);
    return [...rows].sort((left, right) => {
      const comparison = column?.compare
        ? column.compare(left, right)
        : String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ar");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columns, rows, sortDirection, sortKey]);

  if (loading) {
    return <div aria-label="جارٍ تحميل الجدول" className="ui-table-loading" role="status">
      {[0, 1, 2, 3].map((row) => <Skeleton className="ui-table-skeleton" key={row} lines={1} />)}
    </div>;
  }

  if (rows.length === 0) {
    return <EmptyState icon={ListX} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sortKey === column.key;
              const SortIcon = active ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={String(column.key)} scope="col">
                  <button
                    aria-label={`ترتيب حسب ${column.label}`}
                    className="ui-table-sort"
                    onClick={() => {
                      setSortDirection(active && sortDirection === "asc" ? "desc" : "asc");
                      setSortKey(column.key);
                    }}
                    type="button"
                  >
                    {column.label}<SortIcon aria-hidden="true" size={14} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={String(column.key)}>{column.render ? column.render(row) : String(row[column.key] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}