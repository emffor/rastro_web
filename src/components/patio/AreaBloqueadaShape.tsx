import { memo, useCallback, useRef, useEffect, useMemo } from "react";
import { Group, Rect, Text, Line, Transformer } from "react-konva";
import type Konva from "konva";
import type { AreaBloqueada } from "../../services/PatioService";

interface AreaBloqueadaShapeProps {
  area: AreaBloqueada;
  isSelected?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  onResize?: (newSize: {
    largura: number;
    altura: number;
    pos_x: number;
    pos_y: number;
  }) => void;
  draggable?: boolean;
  scale?: number;
  pixelsPorMetro?: number;
  revertPosition?: boolean;
  dragBoundFunc?: (pos: { x: number; y: number }) => { x: number; y: number };
  transformBoundBoxFunc?: (
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
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
}

const MAX_HATCH_LINES = 12;

function AreaBloqueadaShapeInner({
  area,
  isSelected = false,
  isDragging = false,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onResize,
  draggable = false,
  scale = 1,
  pixelsPorMetro = 3,
  revertPosition = false,
  dragBoundFunc,
  transformBoundBoxFunc,
}: AreaBloqueadaShapeProps) {
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const posX = area.pos_x * pixelsPorMetro;
  const posY = area.pos_y * pixelsPorMetro;
  const width = area.largura * pixelsPorMetro;
  const height = area.altura * pixelsPorMetro;
  const visualScale = Math.max(scale, 1);

  useEffect(() => {
    if (revertPosition && rectRef.current) {
      rectRef.current.x(posX);
      rectRef.current.y(posY);
    }
  }, [revertPosition, posX, posY]);

  useEffect(() => {
    if (isSelected && draggable && transformerRef.current && rectRef.current) {
      transformerRef.current.nodes([rectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, draggable]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Rect;
      onDragEnd?.({
        x: node.x(),
        y: node.y(),
      });
    },
    [onDragEnd],
  );

  const handleTransformEnd = useCallback(() => {
    const node = rectRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newWidth = Math.max(pixelsPorMetro, node.width() * scaleX);
    const newHeight = Math.max(pixelsPorMetro, node.height() * scaleY);
    const newX = node.x();
    const newY = node.y();

    const newLargura = Math.round((newWidth / pixelsPorMetro) * 10) / 10;
    const newAltura = Math.round((newHeight / pixelsPorMetro) * 10) / 10;
    const newPosX = Math.round((newX / pixelsPorMetro) * 10) / 10;
    const newPosY = Math.round((newY / pixelsPorMetro) * 10) / 10;

    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);

    if (onResize) {
      onResize({
        largura: newLargura,
        altura: newAltura,
        pos_x: newPosX,
        pos_y: newPosY,
      });
    }
  }, [pixelsPorMetro, onResize]);

  const hatchLines = useMemo(() => {
    const diagonal = Math.sqrt(width * width + height * height);
    const lineCount = Math.min(
      MAX_HATCH_LINES,
      Math.max(3, Math.floor(diagonal / (10 / visualScale))),
    );
    const spacing = (width + height) / (lineCount + 1);
    const lines: number[][] = [];

    for (let i = 1; i <= lineCount; i++) {
      const offset = spacing * i;
      const x1 = Math.max(0, offset - height);
      const y1 = Math.max(0, height - offset);
      const x2 = Math.min(width, offset);
      const y2 = Math.min(height, height - (offset - width));

      if (x1 <= width && y1 <= height && x2 >= 0 && y2 >= 0) {
        lines.push([x1, y1, x2, y2]);
      }
    }
    return lines;
  }, [width, height, visualScale]);

  const isVerticalArea = height > width * 1.5;
  const textDimension = isVerticalArea ? height : width;
  const fontSize = Math.min(14, Math.max(8, textDimension / 8)) / visualScale;

  return (
    <>
      <Rect
        ref={rectRef}
        x={posX}
        y={posY}
        width={width}
        height={height}
        fill={area.cor || "#CCCCCC"}
        stroke={isSelected ? "#E53935" : "#888888"}
        strokeWidth={(isSelected ? 3 : 1.5) / visualScale}
        opacity={isDragging ? 0.6 : 0.8}
        cornerRadius={3 / visualScale}
        draggable={draggable}
        dragBoundFunc={dragBoundFunc}
        onClick={onClick}
        onTap={onClick}
        onDblClick={onDoubleClick}
        onDragStart={onDragStart}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />

      {hatchLines.map((pts, i) => (
        <Line
          key={i}
          x={posX}
          y={posY}
          points={pts}
          stroke="#777777"
          strokeWidth={0.6 / visualScale}
          opacity={0.4}
          listening={false}
        />
      ))}

      <Group
        x={posX + width / 2}
        y={posY + height / 2}
        rotation={isVerticalArea ? 90 : 0}
      >
        {area.nome && (
          <>
            <Rect
              x={-textDimension / 2 + 2 / visualScale}
              y={-fontSize / 2 - 3 / visualScale}
              width={textDimension - 4 / visualScale}
              height={fontSize + 6 / visualScale}
              fill="rgba(255,255,255,0.88)"
              cornerRadius={2 / visualScale}
              listening={false}
            />
            <Text
              x={-textDimension / 2 + 4 / visualScale}
              y={-fontSize / 2}
              width={textDimension - 8 / visualScale}
              text={area.nome}
              fontSize={fontSize}
              fontStyle="bold"
              fontFamily="Inter, system-ui, sans-serif"
              fill="#444444"
              align="center"
              listening={false}
              ellipsis={true}
              wrap="none"
            />
          </>
        )}
      </Group>

      {isSelected && draggable && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          borderStroke="#E53935"
          anchorFill="#ffffff"
          anchorStroke="#E53935"
          anchorSize={8}
          boundBoxFunc={(oldBox, newBox) => {
            const minSize = 10;
            if (newBox.width < minSize || newBox.height < minSize) {
              return oldBox;
            }
            if (transformBoundBoxFunc) {
              return transformBoundBoxFunc(oldBox, newBox);
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

export const AreaBloqueadaShape = memo(AreaBloqueadaShapeInner);
