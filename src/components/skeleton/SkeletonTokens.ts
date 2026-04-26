import { cn } from "../../lib/utils";

export const SKELETON_COLORS = {
  baseColor: "var(--color-primary-muted)",
  highlightColor: "color-mix(in srgb, var(--color-primary-muted) 35%, white)",
} as const;

export const skeletonBorderClass = "border border-primary-muted";
export const skeletonBorderColorClass = "border-primary-muted";
export const skeletonSurfaceClass = cn(
  skeletonBorderClass,
  "rounded-xl bg-white",
);
