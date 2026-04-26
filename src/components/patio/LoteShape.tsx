import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { Lote } from "../../services/PatioService";
import { formatarNumero } from "../../utils/format";

interface LoteShapeProps {
  lote: Lote;
  isSelected?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  onDoubleClick?: () => void;
  onHoverStart?: (lote: Lote, evt: { x: number; y: number }) => void;
  onHoverEnd?: () => void;
  onHoverMove?: (evt: { x: number; y: number }) => void;
  draggable?: boolean;
  scale?: number;
  revertPosition?: boolean;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
}

const STATUS_FILL: Record<string, string> = {
  DISPONIVEL: "#E8F5E9",
  OCUPADO: "#FFEBEE",
  RESERVADO: "#FFF3E0",
  BLOQUEADO: "#F5F5F5",
};

const STATUS_BORDER: Record<string, string> = {
  DISPONIVEL: "#4CAF50",
  OCUPADO: "#E53935",
  RESERVADO: "#FB8C00",
  BLOQUEADO: "#9E9E9E",
};

function getOccupancyColor(percentual: number): string {
  if (percentual >= 90) return "#C62828";
  if (percentual >= 70) return "#E65100";
  if (percentual >= 40) return "#F9A825";
  return "#2E7D32";
}

function LoteShapeInner({
  lote,
  isSelected = false,
  isDragging = false,
  onClick,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  onHoverStart,
  onHoverEnd,
  onHoverMove,
  draggable = true,
  scale = 1,
  revertPosition = false,
  dragBoundFunc,
}: LoteShapeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const groupRef = useRef<Konva.Group>(null);

  const posXRaw = Number(lote.pos_x);
  const posYRaw = Number(lote.pos_y);
  const larguraRaw = Number(lote.largura);
  const alturaRaw = Number(lote.altura);
  const rotacao = Number(lote.rotacao) || 0;

  const posX = Number.isFinite(posXRaw) ? posXRaw : 0;
  const posY = Number.isFinite(posYRaw) ? posYRaw : 0;
  const largura =
    Number.isFinite(larguraRaw) && larguraRaw > 0 ? larguraRaw : 50;
  const altura = Number.isFinite(alturaRaw) && alturaRaw > 0 ? alturaRaw : 30;

  useEffect(() => {
    if (revertPosition && groupRef.current) {
      groupRef.current.x(posX);
      groupRef.current.y(posY);
    }
  }, [revertPosition, posX, posY]);

  const status = lote.status || "DISPONIVEL";
  const percentual = Number(lote.percentual_ocupacao) || 0;
  const volumeOcupado = Number(lote.volume_ocupado) || 0;
  const visualScale = Math.max(scale, 1);

  const fillColor = lote.cor || STATUS_FILL[status] || "#FFFFFF";
  const baseBorderColor = lote.cor_borda || STATUS_BORDER[status] || "#666666";
  const borderColor = isSelected
    ? "#1565C0"
    : isHovered && draggable
      ? "#1976D2"
      : baseBorderColor;
  const borderWidth = isSelected ? 3.5 : isHovered && draggable ? 2.5 : 1.8;
  const statusDotColor = STATUS_BORDER[status] || "#9E9E9E";
  const statusDotRadius = Math.max(1.5, 2.3 / visualScale);
  const statusIsBlocked = status === "BLOQUEADO";
  const showStatusDot =
    largura > statusDotRadius * 4 && altura > statusDotRadius * 4;

  const isRotated = rotacao === 90 || rotacao === -90 || rotacao === 270;
  const visualWidth = isRotated ? altura : largura;
  const visualHeight = isRotated ? largura : altura;

  const isVerticalShape = visualHeight > visualWidth * 1.5;
  const textWidth = isVerticalShape ? visualHeight : visualWidth;

  const fontSize = Math.min(14, Math.max(7, textWidth / 6)) / visualScale;
  const smallFontSize = Math.min(10, Math.max(5, textWidth / 9)) / visualScale;
  const barHeight = Math.max(2, 3 / visualScale);

  const occupancyBarWidth = Math.max(0, textWidth - 12 / visualScale);
  const occupancyFillWidth = occupancyBarWidth * Math.min(1, percentual / 100);
  const occupancyColor = getOccupancyColor(percentual);

  const shortestSide = Math.min(visualWidth, visualHeight);
  const showDetails =
    !isVerticalShape &&
    textWidth / visualScale > 30 &&
    shortestSide / visualScale > 14;

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "grabbing";
      onDragStart?.();
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = draggable ? "move" : "pointer";
      onDragEnd?.({ x: e.target.x(), y: e.target.y() });
    },
    [draggable, onDragEnd],
  );

  const handleMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      setIsHovered(true);
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = draggable ? "move" : "pointer";
      if (!draggable && onHoverStart) {
        const pointer = e.target.getStage()?.getPointerPosition();
        if (pointer) onHoverStart(lote, pointer);
      }
    },
    [draggable, lote, onHoverStart],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!draggable && onHoverMove) {
        const pointer = e.target.getStage()?.getPointerPosition();
        if (pointer) onHoverMove(pointer);
      }
    },
    [draggable, onHoverMove],
  );

  const handleMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      setIsHovered(false);
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "default";
      if (!draggable && onHoverEnd) onHoverEnd();
    },
    [draggable, onHoverEnd],
  );

  return (
    <Group
      ref={groupRef}
      x={posX}
      y={posY}
      rotation={rotacao}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onClick={onClick}
      onTap={onClick}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      opacity={isDragging ? 0.6 : 1}
    >
      {isSelected && (
        <Rect
          x={-3 / visualScale}
          y={-3 / visualScale}
          width={largura + 6 / visualScale}
          height={altura + 6 / visualScale}
          fill="transparent"
          stroke="#1565C0"
          strokeWidth={1.5 / visualScale}
          cornerRadius={6 / visualScale}
          dash={[6 / visualScale, 3 / visualScale]}
          listening={false}
          opacity={0.6}
        />
      )}

      <Rect
        width={largura}
        height={altura}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={borderWidth / visualScale}
        cornerRadius={4 / visualScale}
        shadowColor={isSelected ? "rgba(21,101,192,0.3)" : "rgba(0,0,0,0.12)"}
        shadowBlur={isSelected ? 8 / visualScale : 4 / visualScale}
        shadowOffset={{ x: 1 / visualScale, y: 1 / visualScale }}
      />

      {showStatusDot && (
        <>
          <Circle
            x={largura - statusDotRadius - 3 / visualScale}
            y={statusDotRadius + 3 / visualScale}
            radius={statusDotRadius + 1.2 / visualScale}
            fill="rgba(255,255,255,0.95)"
            stroke="rgba(20,20,20,0.45)"
            strokeWidth={0.8 / visualScale}
            listening={false}
            shadowColor={statusDotColor}
            shadowBlur={4 / visualScale}
            shadowOpacity={0.9}
          />
          <Circle
            x={largura - statusDotRadius - 3 / visualScale}
            y={statusDotRadius + 3 / visualScale}
            radius={statusDotRadius}
            fill={statusDotColor}
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={0.8 / visualScale}
            listening={false}
          />
          {statusIsBlocked && (
            <>
              <Line
                points={[
                  largura - statusDotRadius - 3 / visualScale - statusDotRadius * 0.55,
                  statusDotRadius + 3 / visualScale - statusDotRadius * 0.55,
                  largura - statusDotRadius - 3 / visualScale + statusDotRadius * 0.55,
                  statusDotRadius + 3 / visualScale + statusDotRadius * 0.55,
                ]}
                stroke="#FFFFFF"
                strokeWidth={0.9 / visualScale}
                lineCap="round"
                listening={false}
              />
              <Line
                points={[
                  largura - statusDotRadius - 3 / visualScale + statusDotRadius * 0.55,
                  statusDotRadius + 3 / visualScale - statusDotRadius * 0.55,
                  largura - statusDotRadius - 3 / visualScale - statusDotRadius * 0.55,
                  statusDotRadius + 3 / visualScale + statusDotRadius * 0.55,
                ]}
                stroke="#FFFFFF"
                strokeWidth={0.9 / visualScale}
                lineCap="round"
                listening={false}
              />
            </>
          )}
        </>
      )}

      {lote.capacidade_volume && lote.capacidade_volume > 0 && (
        <Rect
          x={0}
          y={altura - 3 / visualScale}
          width={largura * Math.min(1, percentual / 100)}
          height={3 / visualScale}
          fill={occupancyColor}
          cornerRadius={[0, 0, 4 / visualScale, 4 / visualScale]}
          listening={false}
          opacity={0.8}
        />
      )}

      <Group
        x={largura / 2}
        y={altura / 2}
        rotation={isVerticalShape ? -rotacao + 90 : -rotacao}
      >
        <Rect
          x={-textWidth / 2 + 2 / visualScale}
          y={-fontSize / 2 - 4 / visualScale}
          width={textWidth - 4 / visualScale}
          height={
            showDetails
              ? fontSize + smallFontSize + barHeight + 14 / visualScale
              : fontSize + 8 / visualScale
          }
          fill="rgba(255,255,255,0.92)"
          cornerRadius={3 / visualScale}
          listening={false}
        />

        <Text
          x={-textWidth / 2 + 4 / visualScale}
          y={-fontSize / 2 - (showDetails ? 1 / visualScale : 0)}
          width={textWidth - 8 / visualScale}
          text={lote.nome}
          fontSize={fontSize}
          fontStyle="bold"
          fontFamily="Inter, system-ui, sans-serif"
          fill="#1a1a1a"
          align="center"
          listening={false}
          ellipsis={true}
          wrap="none"
        />

        {showDetails && (
          <>
            <Text
              x={-textWidth / 2 + 4 / visualScale}
              y={fontSize / 2 + 2 / visualScale}
              width={textWidth - 8 / visualScale}
              text={
                volumeOcupado > 0 ? `${formatarNumero(volumeOcupado, 1)} m³` : "Vazio"
              }
              fontSize={smallFontSize}
              fontFamily="Inter, system-ui, sans-serif"
              fill={volumeOcupado > 0 ? "#555" : "#999"}
              align="center"
              listening={false}
              ellipsis={true}
              wrap="none"
            />

            {lote.capacidade_volume && lote.capacidade_volume > 0 && (
              <>
                <Rect
                  x={-occupancyBarWidth / 2}
                  y={fontSize / 2 + smallFontSize + 5 / visualScale}
                  width={occupancyBarWidth}
                  height={barHeight}
                  fill="#E0E0E0"
                  cornerRadius={barHeight / 2}
                  listening={false}
                />
                <Rect
                  x={-occupancyBarWidth / 2}
                  y={fontSize / 2 + smallFontSize + 5 / visualScale}
                  width={occupancyFillWidth}
                  height={barHeight}
                  fill={occupancyColor}
                  cornerRadius={barHeight / 2}
                  listening={false}
                />
              </>
            )}
          </>
        )}
      </Group>

      {draggable && isSelected && (
        <Text
          x={largura / 2 - 6 / visualScale}
          y={-12 / visualScale}
          text="↻"
          fontSize={12 / visualScale}
          fill="#1565C0"
          listening={false}
          fontStyle="bold"
        />
      )}
    </Group>
  );
}

export const LoteShape = memo(LoteShapeInner);
