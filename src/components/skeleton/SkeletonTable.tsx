import { cn } from "../../lib/utils";
import {
  SkeletonBlock,
  SkeletonStatus,
} from "./SkeletonBase";
import {
  skeletonBorderColorClass,
  skeletonSurfaceClass,
} from "./SkeletonTokens";

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showMobileCard?: boolean;
  className?: string;
}

interface SkeletonTableLayoutProps {
  rows: number;
  columns: number;
  showMobileCard?: boolean;
}

const normalizeCount = (value: number, minimum: number) =>
  Math.max(minimum, Math.floor(value));

export function SkeletonTableLayout({
  rows,
  columns,
  showMobileCard = false,
}: SkeletonTableLayoutProps) {
  const rowCount = normalizeCount(rows, 0);
  const columnCount = normalizeCount(columns, 1);

  return (
    <>
      <div className="hidden md:block">
        <div className="space-y-3 p-4">
          <div className={`flex gap-3 border-b pb-3 ${skeletonBorderColorClass}`}>
            {Array.from({ length: columnCount }).map((_, idx) => (
              <SkeletonBlock
                key={`header-${idx}`}
                height={20}
                width="100%"
                containerClassName="min-w-0 flex-1"
              />
            ))}
          </div>

          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <div key={`row-${rowIdx}`} className="flex gap-3 py-2">
              {Array.from({ length: columnCount }).map((_, colIdx) => (
                <SkeletonBlock
                  key={`cell-${rowIdx}-${colIdx}`}
                  height={20}
                  width="100%"
                  containerClassName="min-w-0 flex-1"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {showMobileCard && (
        <div className="space-y-3 p-4 md:hidden">
          {Array.from({ length: rowCount }).map((_, idx) => (
            <div
              key={`mobile-${idx}`}
              className={`${skeletonSurfaceClass} space-y-3 p-4`}
            >
              <SkeletonBlock height={20} width="60%" />
              <SkeletonBlock height={16} width="80%" />
              <SkeletonBlock height={16} width="40%" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 5,
  showMobileCard = false,
  className,
}: SkeletonTableProps) {
  return (
    <SkeletonStatus
      label="Carregando tabela"
      className={cn(className)}
    >
      <SkeletonTableLayout
        rows={rows}
        columns={columns}
        showMobileCard={showMobileCard}
      />
    </SkeletonStatus>
  );
}
