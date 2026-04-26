import type { AreaBloqueada, Lote } from "../services/PatioService";

export type PatioLayoutKind = "lote" | "area";

export interface RectMeters {
  id: string;
  nome: string;
  kind: PatioLayoutKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PX_DB_POR_METRO = 40;

function toFinite(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeLoteRectWithRotation(
  rect: Omit<RectMeters, "w" | "h"> & { w: number; h: number; rotacao?: number },
): RectMeters {
  const rotRaw = ((toFinite(rect.rotacao, 0) % 360) + 360) % 360;
  const rot = ((Math.round(rotRaw / 90) * 90) + 360) % 360;

  if (rot === 90) {
    // Konva rotate(90) around group origin shifts visual box to the left by h.
    return {
      id: rect.id,
      nome: rect.nome,
      kind: rect.kind,
      x: rect.x - rect.h,
      y: rect.y,
      w: rect.h,
      h: rect.w,
    };
  }

  if (rot === 180) {
    return {
      id: rect.id,
      nome: rect.nome,
      kind: rect.kind,
      x: rect.x - rect.w,
      y: rect.y - rect.h,
      w: rect.w,
      h: rect.h,
    };
  }

  if (rot === 270) {
    return {
      id: rect.id,
      nome: rect.nome,
      kind: rect.kind,
      x: rect.x,
      y: rect.y - rect.w,
      w: rect.h,
      h: rect.w,
    };
  }

  return {
    id: rect.id,
    nome: rect.nome,
    kind: rect.kind,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  };
}

export function toLoteRectMeters(
  lote: Lote,
  overrides?: Partial<{ x: number; y: number; w: number; h: number; rotacao: number }>,
): RectMeters {
  const baseW = toFinite(lote.largura_metros, NaN);
  const baseH = toFinite(lote.comprimento_metros, NaN);
  const w = Number.isFinite(baseW) ? baseW : toFinite(lote.largura, 40) / PX_DB_POR_METRO;
  const h = Number.isFinite(baseH) ? baseH : toFinite(lote.altura, 40) / PX_DB_POR_METRO;

  const rect = normalizeLoteRectWithRotation({
    id: lote.id,
    nome: lote.nome || `Lote ${lote.id}`,
    kind: "lote",
    x: overrides?.x ?? toFinite(lote.pos_x, 0) / PX_DB_POR_METRO,
    y: overrides?.y ?? toFinite(lote.pos_y, 0) / PX_DB_POR_METRO,
    w: overrides?.w ?? w,
    h: overrides?.h ?? h,
    rotacao: overrides?.rotacao ?? toFinite(lote.rotacao, 0),
  });

  return rect;
}

export function toAreaRectMeters(
  area: AreaBloqueada,
  overrides?: Partial<{ x: number; y: number; w: number; h: number }>,
): RectMeters {
  return {
    id: area.id,
    nome: area.nome || `Área ${area.id}`,
    kind: "area",
    x: overrides?.x ?? toFinite(area.pos_x, 0),
    y: overrides?.y ?? toFinite(area.pos_y, 0),
    w: overrides?.w ?? toFinite(area.largura, 1),
    h: overrides?.h ?? toFinite(area.altura, 1),
  };
}

export function intersects(a: RectMeters, b: RectMeters): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isInsidePatio(
  rect: RectMeters,
  patioWidthMeters: number,
  patioHeightMeters: number,
): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= patioWidthMeters &&
    rect.y + rect.h <= patioHeightMeters
  );
}

export function hasCollision(rect: RectMeters, others: RectMeters[], ignoreId?: string): boolean {
  return others.some((other) => {
    if (other.id === ignoreId || other.id === rect.id) {
      return false;
    }
    return intersects(rect, other);
  });
}
