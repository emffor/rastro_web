import { cn } from "../../lib/utils";

export const SKELETON_COLORS = {
  baseColor: "#e3ede3",
  highlightColor: "#f5f8f5",
} as const;

export const skeletonBorderClass = "border border-[#e3ede3]";
export const skeletonBorderColorClass = "border-[#e3ede3]";
export const skeletonSurfaceClass = cn(
  skeletonBorderClass,
  "rounded-xl bg-white",
);
