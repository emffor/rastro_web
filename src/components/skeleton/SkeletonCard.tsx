import { SkeletonBlock, SkeletonStatus } from "./SkeletonBase";
import { skeletonSurfaceClass } from "./SkeletonTokens";

interface SkeletonCardProps {
  count?: number;
}

export function SkeletonCard({ count = 1 }: SkeletonCardProps) {
  return (
    <SkeletonStatus label="Carregando" className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className={`${skeletonSurfaceClass} p-4`}>
          <SkeletonBlock height={16} width="40%" className="mb-3" />
          <SkeletonBlock height={32} width="60%" />
        </div>
      ))}
    </SkeletonStatus>
  );
}
