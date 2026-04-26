import { SkeletonBlock, SkeletonStatus } from "./SkeletonBase";
import { SkeletonTableLayout } from "./SkeletonTable";
import { skeletonSurfaceClass } from "./SkeletonTokens";

export function SkeletonDashboard() {
  return (
    <SkeletonStatus label="Carregando dashboard" className="space-y-6">
      <div className={`${skeletonSurfaceClass} space-y-4 p-4 sm:p-5`}>
        <div className="max-w-3xl space-y-2">
          <SkeletonBlock height={16} width="20%" />
          <SkeletonBlock height={36} width="70%" />
          <SkeletonBlock height={16} width="90%" />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonBlock key={idx} height={16} width={150} />
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <SkeletonBlock height={16} width={200} />
            <SkeletonBlock height={16} width={80} />
          </div>
          <SkeletonBlock height={6} width="100%" borderRadius={999} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={`${skeletonSurfaceClass} p-4`}>
            <SkeletonBlock height={16} width="40%" className="mb-3" />
            <SkeletonBlock height={32} width="60%" />
          </div>
        ))}
      </div>

      <div className={`${skeletonSurfaceClass} overflow-hidden`}>
        <div className="flex items-center justify-between gap-4 p-4 pb-0 sm:p-5 sm:pb-0">
          <SkeletonBlock height={24} width={200} />
          <SkeletonBlock height={32} width={100} />
        </div>
        <SkeletonTableLayout rows={5} columns={6} showMobileCard />
      </div>
    </SkeletonStatus>
  );
}
