import { cn } from "../../lib/utils";
import { SkeletonBlock, SkeletonStatus } from "./SkeletonBase";
import { skeletonBorderColorClass } from "./SkeletonTokens";

interface SkeletonFormProps {
  fields?: number;
  columns?: 1 | 2;
}

export function SkeletonForm({ fields = 6, columns = 2 }: SkeletonFormProps) {
  return (
    <SkeletonStatus
      label="Carregando formulário"
      className="space-y-6 p-4 sm:p-6"
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:gap-6",
          columns === 2 && "md:grid-cols-2",
        )}
      >
        {Array.from({ length: fields }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            <SkeletonBlock height={16} width="30%" />
            <SkeletonBlock height={44} width="100%" />
          </div>
        ))}
      </div>

      <div className={`flex gap-3 border-t pt-4 ${skeletonBorderColorClass}`}>
        <SkeletonBlock height={44} width={120} />
        <SkeletonBlock height={44} width={120} />
      </div>
    </SkeletonStatus>
  );
}
