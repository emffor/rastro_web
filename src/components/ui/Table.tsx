import { useMemo, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { DataTable } from "./DataTable";
import { SkeletonTable } from "../skeleton";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  // Nova prop para esconder em mobile
  hideOnMobile?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  className?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  // Nova prop para card view em mobile
  mobileCardRender?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  className,
  emptyMessage = "Nenhum item encontrado",
  isLoading,
  mobileCardRender,
  onRowClick,
}: TableProps<T>) {
  const desktopColumns = useMemo(
    () =>
      columns.map((column) => ({
        key: column.key,
        header: column.header,
        render: column.render,
        className: cn(
          column.className,
          column.hideOnMobile && "hidden md:table-cell",
        ),
      })),
    [columns],
  );

  return (
    <div className={cn("", className)}>
      {/* Mobile Card View */}
      {mobileCardRender && (
        <div className="md:hidden space-y-3 p-4">
          {isLoading ? (
            <SkeletonTable rows={5} columns={2} showMobileCard={true} />
          ) : data.length === 0 ? (
            <div className="text-center text-apple-secondary py-8">
              {emptyMessage}
            </div>
          ) : (
            data.map((item) => (
              <button
                key={keyExtractor(item)}
                type="button"
                className={cn(
                  "block w-full text-left",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {mobileCardRender(item)}
              </button>
            ))
          )}
        </div>
      )}

      {isLoading ? (
        <SkeletonTable
          rows={5}
          columns={desktopColumns.length}
          showMobileCard={false}
          className={cn(mobileCardRender ? "hidden md:block" : "")}
        />
      ) : (
        <DataTable
          data={data}
          columns={desktopColumns}
          keyExtractor={keyExtractor}
          isLoading={false}
          emptyMessage={emptyMessage}
          className={cn(mobileCardRender ? "hidden md:block" : "")}
          onRowClick={onRowClick}
        />
      )}
    </div>
  );
}
