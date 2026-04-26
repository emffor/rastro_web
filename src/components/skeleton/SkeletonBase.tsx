import type { ReactNode } from "react";
import Skeleton, { type SkeletonProps } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { cn } from "../../lib/utils";
import { SKELETON_COLORS } from "./SkeletonTokens";

interface SkeletonStatusProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function SkeletonStatus({
  label,
  className,
  children,
}: SkeletonStatusProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn(className)}
    >
      {children}
    </div>
  );
}

export function SkeletonBlock({ borderRadius = 8, ...props }: SkeletonProps) {
  return (
    <Skeleton
      baseColor={SKELETON_COLORS.baseColor}
      highlightColor={SKELETON_COLORS.highlightColor}
      borderRadius={borderRadius}
      {...props}
    />
  );
}
