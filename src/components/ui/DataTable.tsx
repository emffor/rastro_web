import { useCallback, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (item: T) => string | number;
  className?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  className,
  emptyMessage = "Nenhum item encontrado",
  isLoading,
  onRowClick,
}: DataTableProps<T>) {
  const getValue = (item: T, key: string) => {
    const keys = key.split(".");
    let value: unknown = item;
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }
    return value;
  };

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, item: T) => {
      if (!onRowClick) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowClick(item);
      }
    },
    [onRowClick],
  );

  const alignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  return (
    <div className={cn("overflow-x-auto overscroll-x-contain", className)}>
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr className="border-b border-primary-muted">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-apple-secondary whitespace-nowrap",
                  alignClass(column.align),
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-apple-secondary">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Carregando...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-apple-secondary"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  "border-b border-primary-muted/50 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-apple-gray/40",
                )}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => handleRowKeyDown(event, item)
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={`${keyExtractor(item)}-${String(column.key)}`}
                    className={cn(
                      "px-3 py-2.5 text-[11px] text-apple-dark whitespace-nowrap [&_*]:!text-[11px]",
                      alignClass(column.align),
                      column.className,
                    )}
                  >
                    {column.render
                      ? column.render(item)
                      : String(getValue(item, String(column.key)) ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
