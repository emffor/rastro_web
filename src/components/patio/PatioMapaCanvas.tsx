import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line } from "react-konva";
import type Konva from "konva";
import { LoteShape } from "./LoteShape";
import { AreaBloqueadaShape } from "./AreaBloqueadaShape";
import type { Lote, Patio, AreaBloqueada } from "../../services/PatioService";
import { formatarNumero, formatarPercentual } from "../../utils/format";
import {
  Move,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit3,
  Plus,
  Trash2,
  Edit,
  RotateCw,
} from "lucide-react";
import {
  hasCollision,
  isInsidePatio,
  toAreaRectMeters,
  toLoteRectMeters,
  type RectMeters,
} from "../../utils/patioLayoutCollision";

interface PatioMapaCanvasProps {
  patio: Patio;
  lotes: Lote[];
  areasBloqueadas?: AreaBloqueada[];
  selectedLoteId?: string | null;
  selectedAreaId?: string | null;
  onLoteClick?: (lote: Lote) => void;
  onLoteDrag?: (loteId: string, pos: { x: number; y: number }) => void;
  onLotesChange?: (lotes: Lote[]) => void;
  onAreaClick?: (area: AreaBloqueada) => void;
  onAreaDoubleClick?: (area: AreaBloqueada) => void;
  onAreaDrag?: (areaId: string, pos: { x: number; y: number }) => void;
  onAreasBloqueadasChange?: (areas: AreaBloqueada[]) => void;
  onAddArea?: () => void;
  onDeleteArea?: (areaId: string) => void;
  editable?: boolean;
  editMode?: "lotes" | "areas";
  onToggleEdit?: () => void;
  onToggleEditMode?: (mode: "lotes" | "areas") => void;
  containerWidth?: number;
  containerHeight?: number;
}

const PIXELS_POR_METRO = 3;

export function PatioMapaCanvas({
  patio,
  lotes,
  areasBloqueadas = [],
  selectedLoteId,
  selectedAreaId,
  onLoteClick,
  onLoteDrag,
  onLotesChange,
  onAreaClick,
  onAreaDoubleClick,
  onAreasBloqueadasChange,
  onAddArea,
  onDeleteArea,
  editable = false,
  editMode = "lotes",
  onToggleEdit,
  onToggleEditMode,
  containerWidth = 800,
  containerHeight = 600,
}: PatioMapaCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [draggingLoteId, setDraggingLoteId] = useState<string | null>(null);
  const [draggingAreaId, setDraggingAreaId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    lote: Lote;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const storageKey = `patio-mapa-zoom-${patio.id}`;

  const getSavedTransform = (): {
    scale: number;
    position: { x: number; y: number };
  } | null => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.scale === "number" && parsed.position) {
          return parsed;
        }
      }
    } catch {
      /* ignora */
    }
    return null;
  };

  const [manualTransform, setManualTransform] = useState<{
    scale: number;
    position: { x: number; y: number };
  } | null>(getSavedTransform);
  const lastValidLotePosRef = useRef<Record<string, { x: number; y: number }>>(
    {},
  );
  const lastValidAreaPosRef = useRef<Record<string, { x: number; y: number }>>(
    {},
  );

  useEffect(() => {
    if (manualTransform) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(manualTransform));
      } catch {
        /* ignora */
      }
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [manualTransform, storageKey]);

  const patioLarguraMetros =
    Number(patio.largura_metros) || Number(patio.largura) / 40 || 100;
  const patioComprimentoMetros =
    Number(patio.comprimento_metros) || Number(patio.altura) / 40 || 100;

  const patioWidth = patioLarguraMetros * PIXELS_POR_METRO;
  const patioHeight = patioComprimentoMetros * PIXELS_POR_METRO;

  const gridLines = useMemo(() => {
    const lines: { points: number[]; isMain: boolean }[] = [];
    const gridStep = 5;
    const mainStep = 10;

    for (let x = 0; x <= patioLarguraMetros; x += gridStep) {
      const px = x * PIXELS_POR_METRO;
      lines.push({
        points: [px, 0, px, patioHeight],
        isMain: x % mainStep === 0,
      });
    }
    for (let y = 0; y <= patioComprimentoMetros; y += gridStep) {
      const py = y * PIXELS_POR_METRO;
      lines.push({
        points: [0, py, patioWidth, py],
        isMain: y % mainStep === 0,
      });
    }
    return lines;
  }, [patioLarguraMetros, patioComprimentoMetros, patioWidth, patioHeight]);

  const getRectsFromOtherLotes = useCallback(
    (loteId: string): RectMeters[] =>
      lotes.filter((l) => l.id !== loteId).map((l) => toLoteRectMeters(l)),
    [lotes],
  );

  const getRectsFromAreas = useCallback(
    (): RectMeters[] => areasBloqueadas.map((a) => toAreaRectMeters(a)),
    [areasBloqueadas],
  );

  const getRectsFromOtherAreas = useCallback(
    (areaId: string): RectMeters[] =>
      areasBloqueadas
        .filter((a) => a.id !== areaId)
        .map((a) => toAreaRectMeters(a)),
    [areasBloqueadas],
  );

  const clamp = useCallback((value: number, min: number, max: number) => {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }, []);

  const getLoteSizeMetros = useCallback((lote: Lote) => {
    const w = Number(lote.largura_metros) || Number(lote.largura) / 40 || 1;
    const h = Number(lote.comprimento_metros) || Number(lote.altura) / 40 || 1;
    return { w, h };
  }, []);

  const getLoteRotacaoNormalizada = useCallback((rotacao: unknown) => {
    const rotRaw = (((Number(rotacao) || 0) % 360) + 360) % 360;
    return (Math.round(rotRaw / 90) * 90 + 360) % 360;
  }, []);

  const clampLoteAnchorMeters = useCallback(
    (lote: Lote, x: number, y: number) => {
      const { w, h } = getLoteSizeMetros(lote);
      const rot = getLoteRotacaoNormalizada(lote.rotacao);

      if (rot === 90) {
        return {
          x: clamp(x, h, patioLarguraMetros),
          y: clamp(y, 0, patioComprimentoMetros - w),
        };
      }
      if (rot === 180) {
        return {
          x: clamp(x, w, patioLarguraMetros),
          y: clamp(y, h, patioComprimentoMetros),
        };
      }
      if (rot === 270) {
        return {
          x: clamp(x, 0, patioLarguraMetros - h),
          y: clamp(y, w, patioComprimentoMetros),
        };
      }
      return {
        x: clamp(x, 0, patioLarguraMetros - w),
        y: clamp(y, 0, patioComprimentoMetros - h),
      };
    },
    [
      clamp,
      getLoteRotacaoNormalizada,
      getLoteSizeMetros,
      patioComprimentoMetros,
      patioLarguraMetros,
    ],
  );

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    const allLoteRects = lotes.map((l) => toLoteRectMeters(l));
    const areaRects = areasBloqueadas.map((a) => toAreaRectMeters(a));
    for (const l of lotes) {
      const xMetros = Number(l.pos_x) / 40 || 0;
      const yMetros = Number(l.pos_y) / 40 || 0;
      const currentRect = toLoteRectMeters(l);
      const others = [
        ...allLoteRects.filter((r) => r.id !== l.id),
        ...areaRects,
      ];
      const valid =
        isInsidePatio(
          currentRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(currentRect, others, l.id);
      if (valid) {
        next[l.id] = {
          x: xMetros * PIXELS_POR_METRO,
          y: yMetros * PIXELS_POR_METRO,
        };
      }
    }
    lastValidLotePosRef.current = next;
  }, [areasBloqueadas, lotes, patioComprimentoMetros, patioLarguraMetros]);

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    const areaRects = areasBloqueadas.map((a) => toAreaRectMeters(a));
    const loteRects = lotes.map((l) => toLoteRectMeters(l));
    for (const a of areasBloqueadas) {
      const currentRect = toAreaRectMeters(a);
      const others = [...areaRects.filter((r) => r.id !== a.id), ...loteRects];
      const valid =
        isInsidePatio(
          currentRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(currentRect, others, a.id);
      if (valid) {
        next[a.id] = {
          x: a.pos_x * PIXELS_POR_METRO,
          y: a.pos_y * PIXELS_POR_METRO,
        };
      }
    }
    lastValidAreaPosRef.current = next;
  }, [areasBloqueadas, lotes, patioComprimentoMetros, patioLarguraMetros]);

  const toLocalMapPosition = useCallback(
    (absolutePos: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return absolutePos;
      const sx = stage.scaleX() || 1;
      const sy = stage.scaleY() || 1;
      return {
        x: (absolutePos.x - stage.x()) / sx,
        y: (absolutePos.y - stage.y()) / sy,
      };
    },
    [],
  );

  const toAbsoluteCanvasPosition = useCallback(
    (localPos: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return localPos;
      const sx = stage.scaleX() || 1;
      const sy = stage.scaleY() || 1;
      return { x: localPos.x * sx + stage.x(), y: localPos.y * sy + stage.y() };
    },
    [],
  );

  const toLocalMapBox = useCallback(
    (box: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }) => {
      const stage = stageRef.current;
      if (!stage) return box;
      const sx = stage.scaleX() || 1;
      const sy = stage.scaleY() || 1;
      return {
        ...box,
        x: (box.x - stage.x()) / sx,
        y: (box.y - stage.y()) / sy,
        width: box.width / sx,
        height: box.height / sy,
      };
    },
    [],
  );

  const toAbsoluteCanvasBox = useCallback(
    (box: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }) => {
      const stage = stageRef.current;
      if (!stage) return box;
      const sx = stage.scaleX() || 1;
      const sy = stage.scaleY() || 1;
      return {
        ...box,
        x: box.x * sx + stage.x(),
        y: box.y * sy + stage.y(),
        width: box.width * sx,
        height: box.height * sy,
      };
    },
    [],
  );

  const constrainLotePosition = useCallback(
    (lote: Lote, desiredAbsolutePosPx: { x: number; y: number }) => {
      const desiredPosPx = toLocalMapPosition(desiredAbsolutePosPx);
      const desiredAnchorMetros = {
        x: desiredPosPx.x / PIXELS_POR_METRO,
        y: desiredPosPx.y / PIXELS_POR_METRO,
      };
      const clampedAnchorMetros = clampLoteAnchorMeters(
        lote,
        desiredAnchorMetros.x,
        desiredAnchorMetros.y,
      );
      const clampedPosPx = {
        x: clampedAnchorMetros.x * PIXELS_POR_METRO,
        y: clampedAnchorMetros.y * PIXELS_POR_METRO,
      };

      const candidateRect = toLoteRectMeters(lote, {
        x: clampedAnchorMetros.x,
        y: clampedAnchorMetros.y,
      });
      const others = [
        ...getRectsFromOtherLotes(lote.id),
        ...getRectsFromAreas(),
      ];
      const valid =
        isInsidePatio(
          candidateRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(candidateRect, others, lote.id);

      if (valid) {
        lastValidLotePosRef.current[lote.id] = clampedPosPx;
        return toAbsoluteCanvasPosition(clampedPosPx);
      }
      return toAbsoluteCanvasPosition(
        lastValidLotePosRef.current[lote.id] || clampedPosPx,
      );
    },
    [
      clampLoteAnchorMeters,
      getRectsFromAreas,
      getRectsFromOtherLotes,
      patioComprimentoMetros,
      patioLarguraMetros,
      toAbsoluteCanvasPosition,
      toLocalMapPosition,
    ],
  );

  const constrainAreaPosition = useCallback(
    (area: AreaBloqueada, desiredAbsolutePosPx: { x: number; y: number }) => {
      const desiredPosPx = toLocalMapPosition(desiredAbsolutePosPx);
      const widthMetros = Number(area.largura) || 1;
      const heightMetros = Number(area.altura) || 1;
      const cx = clamp(
        desiredPosPx.x / PIXELS_POR_METRO,
        0,
        patioLarguraMetros - widthMetros,
      );
      const cy = clamp(
        desiredPosPx.y / PIXELS_POR_METRO,
        0,
        patioComprimentoMetros - heightMetros,
      );
      const clampedPosPx = {
        x: cx * PIXELS_POR_METRO,
        y: cy * PIXELS_POR_METRO,
      };
      const candidateRect = toAreaRectMeters(area, { x: cx, y: cy });
      const others = [
        ...getRectsFromOtherAreas(area.id),
        ...lotes.map((l) => toLoteRectMeters(l)),
      ];
      const valid =
        isInsidePatio(
          candidateRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(candidateRect, others, area.id);

      if (valid) {
        lastValidAreaPosRef.current[area.id] = clampedPosPx;
        return toAbsoluteCanvasPosition(clampedPosPx);
      }
      return toAbsoluteCanvasPosition(
        lastValidAreaPosRef.current[area.id] || clampedPosPx,
      );
    },
    [
      clamp,
      getRectsFromOtherAreas,
      lotes,
      patioComprimentoMetros,
      patioLarguraMetros,
      toAbsoluteCanvasPosition,
      toLocalMapPosition,
    ],
  );

  const constrainAreaResize = useCallback(
    (
      area: AreaBloqueada,
      oldBox: {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
      },
      newBox: {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
      },
    ) => {
      const oldLocalBox = toLocalMapBox(oldBox);
      const newLocalBox = toLocalMapBox(newBox);
      const clampedBox = {
        ...newLocalBox,
        x: clamp(newLocalBox.x, 0, patioWidth - newLocalBox.width),
        y: clamp(newLocalBox.y, 0, patioHeight - newLocalBox.height),
      };
      const candidateRect = toAreaRectMeters(area, {
        x: clampedBox.x / PIXELS_POR_METRO,
        y: clampedBox.y / PIXELS_POR_METRO,
        w: clampedBox.width / PIXELS_POR_METRO,
        h: clampedBox.height / PIXELS_POR_METRO,
      });
      const others = [
        ...getRectsFromOtherAreas(area.id),
        ...lotes.map((l) => toLoteRectMeters(l)),
      ];
      const valid =
        isInsidePatio(
          candidateRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(candidateRect, others, area.id);
      return valid
        ? toAbsoluteCanvasBox(clampedBox)
        : toAbsoluteCanvasBox(oldLocalBox);
    },
    [
      clamp,
      getRectsFromOtherAreas,
      lotes,
      patioComprimentoMetros,
      patioHeight,
      patioLarguraMetros,
      patioWidth,
      toAbsoluteCanvasBox,
      toLocalMapBox,
    ],
  );

  const handleLoteDoubleClick = useCallback(
    (loteId: string) => {
      if (!editable) return;
      const loteIndex = lotes.findIndex((l) => l.id === loteId);
      if (loteIndex === -1) return;

      const currentLote = lotes[loteIndex];
      const currentRotation = Number(currentLote.rotacao) || 0;
      const angulos = [0, 90];
      let prox = angulos[0];
      let menorDif = Infinity;

      for (const ang of angulos) {
        const dif = Math.abs(currentRotation - ang);
        if (dif < menorDif) {
          menorDif = dif;
          prox = ang;
        }
      }
      if (menorDif < 15) {
        const idx = angulos.indexOf(prox);
        prox = angulos[(idx + 1) % angulos.length];
      }

      const candidateRect = toLoteRectMeters(currentLote, { rotacao: prox });
      const others = [
        ...lotes.filter((l) => l.id !== loteId).map((l) => toLoteRectMeters(l)),
        ...areasBloqueadas.map((a) => toAreaRectMeters(a)),
      ];
      const valid =
        isInsidePatio(
          candidateRect,
          patioLarguraMetros,
          patioComprimentoMetros,
        ) && !hasCollision(candidateRect, others, loteId);
      if (!valid) return;

      onLotesChange?.(
        lotes.map((l) => (l.id === loteId ? { ...l, rotacao: prox } : l)),
      );
    },
    [
      areasBloqueadas,
      editable,
      lotes,
      onLotesChange,
      patioComprimentoMetros,
      patioLarguraMetros,
    ],
  );

  const initialTransform = useMemo(() => {
    const scaleX = (containerWidth - 40) / patioWidth;
    const scaleY = (containerHeight - 40) / patioHeight;
    const autoScale = Math.min(scaleX, scaleY);
    const newScale = Math.min(Math.max(autoScale, 0.1), 2.0);
    const offsetX = (containerWidth - patioWidth * newScale) / 2;
    const offsetY = (containerHeight - patioHeight * newScale) / 2;
    return { scale: newScale, position: { x: offsetX, y: offsetY } };
  }, [containerWidth, containerHeight, patioWidth, patioHeight]);

  const scale = manualTransform?.scale ?? initialTransform.scale;
  const position = manualTransform?.position ?? initialTransform.position;
  const visualScale = Math.max(scale, 1);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = direction > 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.max(0.3, Math.min(5, oldScale * factor));

      setManualTransform({
        scale: newScale,
        position: {
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        },
      });
    },
    [scale, position],
  );

  const handleLoteDragEnd = useCallback(
    (loteId: string, pos: { x: number; y: number }) => {
      setDraggingLoteId(null);
      if (!editable) return;

      const posXMetros = pos.x / PIXELS_POR_METRO;
      const posYMetros = pos.y / PIXELS_POR_METRO;

      onLoteDrag?.(loteId, { x: posXMetros, y: posYMetros });

      if (onLotesChange) {
        onLotesChange(
          lotes.map((l) =>
            l.id === loteId
              ? { ...l, pos_x: posXMetros * 40, pos_y: posYMetros * 40 }
              : l,
          ),
        );
      }
    },
    [editable, lotes, onLoteDrag, onLotesChange],
  );

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(5, scale * 1.25);
    setManualTransform({
      scale: newScale,
      position: {
        x: containerWidth / 2 - (patioWidth * newScale) / 2,
        y: containerHeight / 2 - (patioHeight * newScale) / 2,
      },
    });
  }, [scale, containerWidth, containerHeight, patioWidth, patioHeight]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(0.3, scale / 1.25);
    setManualTransform({
      scale: newScale,
      position: {
        x: containerWidth / 2 - (patioWidth * newScale) / 2,
        y: containerHeight / 2 - (patioHeight * newScale) / 2,
      },
    });
  }, [scale, containerWidth, containerHeight, patioWidth, patioHeight]);

  const handleResetView = useCallback(() => {
    setManualTransform(null);
  }, []);

  const selectedLoteObj = useMemo(
    () => (selectedLoteId ? lotes.find((l) => l.id === selectedLoteId) : null),
    [lotes, selectedLoteId],
  );
  const selectedAreaObj = useMemo(
    () =>
      selectedAreaId
        ? areasBloqueadas.find((a) => a.id === selectedAreaId)
        : null,
    [areasBloqueadas, selectedAreaId],
  );

  const lotesRenderizados = useMemo(
    () =>
      lotes.map((lote) => {
        const loteLarguraMetros =
          Number(lote.largura_metros) || Number(lote.largura) / 40 || 1;
        const loteComprimentoMetros =
          Number(lote.comprimento_metros) || Number(lote.altura) / 40 || 1;
        const currentPosXMetros = Number(lote.pos_x) / 40 || 0;
        const currentPosYMetros = Number(lote.pos_y) / 40 || 0;

        return {
          original: lote,
          render: {
            ...lote,
            pos_x: currentPosXMetros * PIXELS_POR_METRO,
            pos_y: currentPosYMetros * PIXELS_POR_METRO,
            largura: loteLarguraMetros * PIXELS_POR_METRO,
            altura: loteComprimentoMetros * PIXELS_POR_METRO,
          },
        };
      }),
    [lotes],
  );

  return (
    <div className="relative">
      {/* Toolbar superior — simplificada */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        {editable ? (
          <div className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg">
            <Move className="h-3.5 w-3.5" />
            Modo Edição — Arraste para mover
            {editMode === "lotes"
              ? ", 2x clique para girar"
              : ", redimensione as áreas"}
          </div>
        ) : (
          <div className="bg-gray-700/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg">
            <MousePointer className="h-3.5 w-3.5" />
            Clique em um lote para ver detalhes
          </div>
        )}

        {!editable && onToggleEdit && (
          <button
            onClick={onToggleEdit}
            className="bg-primary hover:bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Editar Posições
          </button>
        )}

        {editable && onToggleEditMode && (
          <button
            onClick={() =>
              onToggleEditMode(editMode === "lotes" ? "areas" : "lotes")
            }
            className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-colors"
          >
            {editMode === "lotes" ? "Editar Áreas" : "Editar Lotes"}
          </button>
        )}

        {editable && editMode === "areas" && onAddArea && (
          <button
            onClick={onAddArea}
            className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Área
          </button>
        )}
      </div>

      {/* Toolbar contextual flutuante — aparece ao selecionar um item */}
      {editable && (selectedLoteObj || selectedAreaObj) && (
        <div className="absolute top-12 left-2 z-10 flex items-center gap-1.5 bg-white rounded-lg shadow-xl border border-[#d7e5d8] px-2 py-1.5">
          {selectedLoteObj && editMode === "lotes" && (
            <>
              <span className="text-xs font-semibold text-apple-dark px-1">
                {selectedLoteObj.nome}
              </span>
              <div className="w-px h-5 bg-[#d7e5d8]" />
              <button
                onClick={() => handleLoteDoubleClick(selectedLoteObj.id)}
                className="p-1.5 text-primary hover:bg-primary-muted rounded-md transition-colors"
                title="Girar 90° (ou clique 2x no lote)"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {selectedAreaObj && editMode === "areas" && (
            <>
              <span className="text-xs font-semibold text-apple-dark px-1">
                {selectedAreaObj.nome || "Área"}
              </span>
              <div className="w-px h-5 bg-[#d7e5d8]" />
              {onAreaDoubleClick && (
                <button
                  onClick={() => onAreaDoubleClick(selectedAreaObj)}
                  className="p-1.5 text-primary hover:bg-primary-muted rounded-md transition-colors"
                  title="Editar área"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteArea && (
                <button
                  onClick={() => onDeleteArea(selectedAreaObj.id)}
                  className="p-1.5 text-apple-danger hover:bg-apple-danger/10 rounded-md transition-colors"
                  title="Excluir área"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Controles de zoom */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="bg-white hover:bg-apple-gray p-2 rounded-lg shadow-md transition-colors border border-[#e3ede3]"
          title="Aumentar zoom"
        >
          <ZoomIn className="h-4 w-4 text-apple-dark" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-white hover:bg-apple-gray p-2 rounded-lg shadow-md transition-colors border border-[#e3ede3]"
          title="Diminuir zoom"
        >
          <ZoomOut className="h-4 w-4 text-apple-dark" />
        </button>
        <button
          onClick={handleResetView}
          className="bg-white hover:bg-apple-gray p-2 rounded-lg shadow-md transition-colors border border-[#e3ede3]"
          title="Resetar visualização"
        >
          <Maximize2 className="h-4 w-4 text-apple-dark" />
        </button>
      </div>

      {/* Indicador de zoom */}
      <div className="absolute bottom-2 right-2 z-10 bg-white/90 border border-[#d7e5d8] px-2 py-1 rounded-md text-xs font-mono text-apple-secondary shadow-sm">
        {Math.round(scale * 100)}%
      </div>

      {/* Tooltip HTML */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 12, containerWidth - 180),
            top: Math.max(tooltip.y - 80, 4),
          }}
        >
          <div className="bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl min-w-35 max-w-50 backdrop-blur-sm">
            <div className="font-bold mb-1 text-sm">{tooltip.lote.nome}</div>
            <div className="flex items-center gap-1 mb-0.5">
              <span
                className={`relative inline-flex items-center justify-center w-2 h-2 rounded-full ${
                  tooltip.lote.status === "DISPONIVEL"
                    ? "bg-primary-light"
                    : tooltip.lote.status === "OCUPADO"
                      ? "bg-red-400"
                      : tooltip.lote.status === "RESERVADO"
                        ? "bg-orange-400"
                        : "bg-gray-400"
                }`}
              >
                {tooltip.lote.status === "BLOQUEADO" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="absolute w-[6px] h-[1px] bg-white rounded rotate-45" />
                    <span className="absolute w-[6px] h-[1px] bg-white rounded -rotate-45" />
                  </span>
                )}
              </span>
              <span className="capitalize">
                {(tooltip.lote.status || "").toLowerCase()}
              </span>
            </div>
            <div className="text-gray-300">
              {formatarNumero(tooltip.lote.volume_ocupado, 2)} m³
            </div>
            {tooltip.lote.capacidade_volume ? (
              <>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1.5">
                  <div
                    className="h-1.5 rounded-full transition-[width,background-color]"
                    style={{
                      width: `${Math.min(100, Number(tooltip.lote.percentual_ocupacao) || 0)}%`,
                      backgroundColor:
                        (Number(tooltip.lote.percentual_ocupacao) || 0) > 80
                          ? "#ef4444"
                          : (Number(tooltip.lote.percentual_ocupacao) || 0) > 50
                            ? "#f59e0b"
                            : "#22c55e",
                    }}
                  />
                </div>
                <div className="text-right text-apple-secondary mt-0.5">
                  {formatarPercentual(Number(tooltip.lote.percentual_ocupacao) || 0)}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="border border-[#d7e5d8] rounded-xl overflow-hidden bg-apple-gray"
        style={{
          width: containerWidth,
          height: containerHeight,
          cursor: editable ? "crosshair" : "grab",
        }}
      >
        <Stage
          ref={stageRef}
          width={containerWidth}
          height={containerHeight}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          onWheel={handleWheel}
          draggable
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setManualTransform((prev) => ({
                scale: prev?.scale ?? scale,
                position: { x: e.target.x(), y: e.target.y() },
              }));
            }
          }}
        >
          <Layer>
            {/* Pátio de fundo */}
            <Rect
              x={0}
              y={0}
              width={patioWidth}
              height={patioHeight}
              fill={patio.cor_fundo || "#4CAF50"}
              cornerRadius={4 / visualScale}
              shadowColor="rgba(0,0,0,0.2)"
              shadowBlur={12}
              shadowOffset={{ x: 3, y: 3 }}
            />

            {/* Grid visual */}
            {editable &&
              gridLines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={
                    line.isMain
                      ? "rgba(255,255,255,0.35)"
                      : "rgba(255,255,255,0.15)"
                  }
                  strokeWidth={(line.isMain ? 1 : 0.5) / visualScale}
                  listening={false}
                />
              ))}

            {/* Nome do pátio no canto */}
            <Text
              x={4 / visualScale}
              y={4 / visualScale}
              text={patio.nome}
              fontSize={Math.min(16, 14 / visualScale)}
              fontStyle="bold"
              fontFamily="Inter, system-ui, sans-serif"
              fill="rgba(255,255,255,0.8)"
              listening={false}
            />

            {/* Áreas bloqueadas (render antes dos lotes para ficar abaixo) */}
            {areasBloqueadas.map((area) => (
              <AreaBloqueadaShape
                key={area.id}
                area={area}
                isSelected={selectedAreaId === area.id}
                isDragging={draggingAreaId === area.id}
                onClick={() => {
                  if (editable && editMode === "areas") {
                    onAreaClick?.(area);
                  }
                }}
                onDoubleClick={() => {
                  if (editable && editMode === "areas") {
                    onAreaDoubleClick?.(area);
                  }
                }}
                onDragStart={() => setDraggingAreaId(area.id)}
                onDragEnd={(pos) => {
                  setDraggingAreaId(null);
                  if (!editable || editMode !== "areas") return;
                  const pxM = pos.x / PIXELS_POR_METRO;
                  const pyM = pos.y / PIXELS_POR_METRO;
                  if (onAreasBloqueadasChange) {
                    onAreasBloqueadasChange(
                      areasBloqueadas.map((a) =>
                        a.id === area.id ? { ...a, pos_x: pxM, pos_y: pyM } : a,
                      ),
                    );
                  }
                }}
                dragBoundFunc={(pos) => constrainAreaPosition(area, pos)}
                onResize={(newSize) => {
                  if (
                    !editable ||
                    editMode !== "areas" ||
                    !onAreasBloqueadasChange
                  )
                    return;
                  onAreasBloqueadasChange(
                    areasBloqueadas.map((a) =>
                      a.id === area.id
                        ? {
                            ...a,
                            largura: newSize.largura,
                            altura: newSize.altura,
                            pos_x: newSize.pos_x,
                            pos_y: newSize.pos_y,
                          }
                        : a,
                    ),
                  );
                }}
                transformBoundBoxFunc={(oldBox, newBox) =>
                  constrainAreaResize(area, oldBox, newBox)
                }
                draggable={editable && editMode === "areas"}
                scale={scale}
                pixelsPorMetro={PIXELS_POR_METRO}
              />
            ))}

            {/* Lotes (render depois das áreas para ficar acima) */}
            {lotesRenderizados.map(({ original: lote, render: loteRender }) => {
              return (
                <LoteShape
                  key={lote.id}
                  lote={loteRender}
                  isSelected={selectedLoteId === lote.id}
                  isDragging={draggingLoteId === lote.id}
                  onClick={() => onLoteClick?.(lote)}
                  onDragStart={() => setDraggingLoteId(lote.id)}
                  onDragEnd={(pos) => handleLoteDragEnd(lote.id, pos)}
                  dragBoundFunc={(pos) => constrainLotePosition(lote, pos)}
                  onDoubleClick={() => {
                    if (editable && editMode === "lotes") {
                      handleLoteDoubleClick(lote.id);
                    }
                  }}
                  onHoverStart={(hoveredLote, pos) =>
                    setTooltip({ lote: hoveredLote, x: pos.x, y: pos.y })
                  }
                  onHoverMove={(pos) =>
                    setTooltip((prev) =>
                      prev ? { ...prev, x: pos.x, y: pos.y } : null,
                    )
                  }
                  onHoverEnd={() => setTooltip(null)}
                  draggable={editable && editMode === "lotes"}
                  scale={scale}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
