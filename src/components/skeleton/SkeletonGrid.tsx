import { SkeletonBlock, SkeletonStatus } from "./SkeletonBase";
import { skeletonSurfaceClass } from "./SkeletonTokens";

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 6 }: SkeletonGridProps) {
  return (
    <SkeletonStatus
      label="Carregando grid"
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className={`${skeletonSurfaceClass} overflow-hidden`}>
          <SkeletonBlock height={144} width="100%" borderRadius={0} />

          <div className="space-y-3 p-4">
            <SkeletonBlock height={24} width="70%" />
            <SkeletonBlock height={16} width="90%" />
            <SkeletonBlock height={16} width="80%" />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="space-y-1">
                <SkeletonBlock height={12} width="50%" />
                <SkeletonBlock height={20} width="60%" />
              </div>
              <div className="space-y-1">
                <SkeletonBlock height={12} width="50%" />
                <SkeletonBlock height={20} width="60%" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <SkeletonBlock height={36} width="100%" />
              <SkeletonBlock height={36} width={36} />
              <SkeletonBlock height={36} width={36} />
            </div>
          </div>
        </div>
      ))}
    </SkeletonStatus>
  );
}
