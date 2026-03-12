// Key.tsx — Renders an individual key on the Konva canvas.
// Supports light and dark color modes. Highlights keys on selection or conflict.
import { memo, useMemo } from 'react';
import { Group, Rect, Text, Shape } from 'react-konva';
import { useTranslation } from 'react-i18next';
import {
  KEY_COMMAND_LEGEND_ENABLED,
  KEY_MODIFIER_STYLE_SPECIAL_KEYS,
  KEY_UNIT_SIZE,
  KEY_UNIT_SPACING,
} from '../../constants/canvas';
import { getKeyType } from '@keymap-highlight/layout-pipeline';
import { lookupActionNameForSource } from '../../utils/editor-helpers';
import type { KeyColors } from './KeyboardCanvas';

interface MappedKey {
  command?: string;
  isConflict?: boolean;
  source?: string;
  sourceEditor?: string;
  bindings?: { command: string }[];
}

interface KeyProps {
  keyCode: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  w2?: number;
  h2?: number;
  x2?: number;
  y2?: number;
  label: string;
  isConflict?: boolean;
  isActive?: boolean;
  isSelected?: boolean;
  mappedKeyCommand?: string;
  source?: string;
  mapped?: MappedKey | null;
  onClick?: (code: string) => void;
  onMouseEnter?: (code: string) => void;
  onMouseLeave?: () => void;
  colors: KeyColors;
}

export const Key = memo(function Key({
  keyCode,
  x,
  y,
  w,
  h,
  width,
  height,
  w2,
  h2,
  x2,
  y2,
  label,
  isActive,
  isSelected,
  mappedKeyCommand,
  source,
  mapped,
  onClick,
  onMouseEnter,
  onMouseLeave,
  colors,
}: KeyProps) {
  const { i18n } = useTranslation();

  const resolvedCommand = mappedKeyCommand ?? mapped?.command;
  const resolvedSource = source ?? mapped?.source ?? mapped?.sourceEditor;

  const keyType = getKeyType(label);
  const isModifier = keyType === 'modifier';
  const primaryLabel = useMemo(() => {
    const [head = ''] = label.split('\n');
    return head.trim().toLowerCase();
  }, [label]);
  const usesModifierVisualStyle = isModifier || KEY_MODIFIER_STYLE_SPECIAL_KEYS.has(primaryLabel);

  const displayCommand = useMemo(() => {
    if (!resolvedCommand) {
      return undefined;
    }

    return lookupActionNameForSource(resolvedSource, resolvedCommand, i18n.language);
  }, [resolvedCommand, resolvedSource, i18n.language]);

  let fill = colors.standard.fill;
  let stroke = colors.standard.stroke;
  let textFill = colors.standard.text;

  if (isSelected) {
    fill = colors.action.fill;
    stroke = colors.action.stroke;
    textFill = colors.action.text;
  } else if (isModifier && isActive) {
    fill = colors.modifier.activeFill;
    stroke = colors.modifier.stroke;
    textFill = colors.modifier.activeText;
  } else if (usesModifierVisualStyle) {
    fill = colors.modifier.fill;
    stroke = colors.modifier.stroke;
    textFill = colors.modifier.text;
  }

  const unitWidth = w ?? width ?? 1;
  const unitHeight = h ?? height ?? 1;
  const keyWidth = Math.max(0, unitWidth * KEY_UNIT_SIZE - KEY_UNIT_SPACING);
  const keyHeight = Math.max(0, unitHeight * KEY_UNIT_SIZE - KEY_UNIT_SPACING);

  const longestLabelLineLength = useMemo(() => {
    return label
      .split('\n')
      .reduce((maxLength, line) => Math.max(maxLength, line.trim().length), 0);
  }, [label]);

  const labelFontSize = useMemo(() => {
    if (longestLabelLineLength <= 1) {
      return 14;
    }

    const canUseMediumFont =
      longestLabelLineLength <= 6 || (unitWidth > 1 && longestLabelLineLength <= 7);

    return canUseMediumFont ? 12 : 10;
  }, [longestLabelLineLength, unitWidth]);

  const isLShaped = w2 !== undefined || h2 !== undefined || x2 !== undefined || y2 !== undefined;
  const keyWidth2 = isLShaped ? Math.max(0, (w2 ?? 1) * KEY_UNIT_SIZE - KEY_UNIT_SPACING) : 0;
  const keyHeight2 = isLShaped ? Math.max(0, (h2 ?? 1) * KEY_UNIT_SIZE - KEY_UNIT_SPACING) : 0;
  const kx2 = isLShaped ? (x2 ?? 0) * KEY_UNIT_SIZE : 0;
  const ky2 = isLShaped ? (y2 ?? 0) * KEY_UNIT_SIZE : 0;

  let lShapePts: { x: number; y: number }[] = [];
  if (isLShaped) {
    const r1 = { x: 0, y: 0, r: keyWidth, b: keyHeight };
    const r2 = { x: kx2, y: ky2, r: kx2 + keyWidth2, b: ky2 + keyHeight2 };

    const minX = Math.min(r1.x, r2.x);
    const minY = Math.min(r1.y, r2.y);
    const maxX = Math.max(r1.r, r2.r);
    const maxY = Math.max(r1.b, r2.b);

    const eps = 1;
    const inR1 = (x: number, y: number) => x >= r1.x - eps && x <= r1.r + eps && y >= r1.y - eps && y <= r1.b + eps;
    const inR2 = (x: number, y: number) => x >= r2.x - eps && x <= r2.r + eps && y >= r2.y - eps && y <= r2.b + eps;
    const isInside = (x: number, y: number) => inR1(x, y) || inR2(x, y);

    const c1 = isInside(minX, minY);
    const c2 = isInside(maxX, minY);
    const c3 = isInside(maxX, maxY);
    const c4 = isInside(minX, maxY);

    const innerX1 = Math.max(r1.x, r2.x);
    const innerX2 = Math.min(r1.r, r2.r);
    const innerY1 = Math.max(r1.y, r2.y);
    const innerY2 = Math.min(r1.b, r2.b);

    if (!c4) { // Bottom-Left missing (e.g. JIS Enter)
      lShapePts = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: innerX1, y: maxY },
        { x: innerX1, y: innerY2 },
        { x: minX, y: innerY2 },
      ];
    } else if (!c1) { // Top-Left missing
      lShapePts = [
        { x: innerX1, y: innerY1 },
        { x: innerX1, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: innerY1 },
      ];
    } else if (!c2) { // Top-Right missing
      lShapePts = [
        { x: minX, y: minY },
        { x: innerX2, y: minY },
        { x: innerX2, y: innerY1 },
        { x: maxX, y: innerY1 },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    } else if (!c3) { // Bottom-Right missing
      lShapePts = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: innerY2 },
        { x: innerX2, y: innerY2 },
        { x: innerX2, y: maxY },
        { x: minX, y: maxY },
      ];
    } else {
      lShapePts = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    }
  }

  const showCommandLegend = KEY_COMMAND_LEGEND_ENABLED;
  const labelParts = label.split('\n');

  return (
    <Group
      x={x * KEY_UNIT_SIZE}
      y={y * KEY_UNIT_SIZE}
      onClick={() => onClick?.(keyCode)}
      onTap={() => onClick?.(keyCode)}
      onMouseEnter={() => onMouseEnter?.(keyCode)}
      onMouseLeave={onMouseLeave}
      listening={true}
    >
      {isLShaped && lShapePts.length > 0 ? (
        <Shape
          sceneFunc={(context, shape) => {
            context.beginPath();
            const last = lShapePts[lShapePts.length - 1];
            const first = lShapePts[0];
            if (last && first) {
              context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
            }
            for (let i = 0; i < lShapePts.length; i++) {
              const p_curr = lShapePts[i];
              const p_next = lShapePts[(i + 1) % lShapePts.length];
              if (p_curr && p_next) {
                context.arcTo(p_curr.x, p_curr.y, p_next.x, p_next.y, 4);
              }
            }
            context.closePath();
            context.fillStrokeShape(shape);
          }}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 1.5 : 1}
          shadowColor="transparent"
          shadowBlur={0}
          shadowOpacity={0}
        />
      ) : (
        <Rect
          width={keyWidth}
          height={keyHeight}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 1.5 : 1}
          cornerRadius={4}
          shadowColor="transparent"
          shadowBlur={0}
          shadowOpacity={0}
        />
      )}
      {labelParts.map((part, index) => {
        const keyTextId = `label-${keyCode}-${part}-${index}`;
        return (
        <Text
          key={keyTextId}
          text={part}
          width={keyWidth}
          height={showCommandLegend ? keyHeight / 2 : keyHeight}
          fontSize={labelFontSize}
          fill={textFill}
          align={labelParts.length > 1 && index > 0 ? "right" : "center"}
          verticalAlign={showCommandLegend ? 'bottom' : 'middle'}
          fontFamily="IBM Plex Sans, sans-serif"
          padding={4}
          opacity={showCommandLegend ? 0.7 : 1}
          x={labelParts.length > 1 && index > 0 ? -10 : (labelParts.length > 1 && index === 0 ? -4 : 0)}
          y={(showCommandLegend ? -2 : 0) + (labelParts.length > 1 && index > 0 ? labelFontSize * 1.1 : 0) - (labelParts.length > 1 ? labelFontSize * 0.55 : 0)}
        />
        );
      })}
      {showCommandLegend ? (
        <Text
          text={displayCommand}
          y={keyHeight / 2}
          width={keyWidth}
          height={keyHeight / 2}
          fontSize={10}
          fill={textFill}
          align="center"
          verticalAlign="top"
          fontFamily="IBM Plex Sans, sans-serif"
          padding={2}
          wrap="word"
        />
      ) : null}
    </Group>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.keyCode === nextProps.keyCode &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.w === nextProps.w &&
    prevProps.h === nextProps.h &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.label === nextProps.label &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.mappedKeyCommand === nextProps.mappedKeyCommand &&
    prevProps.source === nextProps.source &&
    prevProps.colors === nextProps.colors &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onMouseEnter === nextProps.onMouseEnter &&
    prevProps.onMouseLeave === nextProps.onMouseLeave &&
    (prevProps.mapped === nextProps.mapped ||
      (prevProps.mapped?.command === nextProps.mapped?.command &&
       prevProps.mapped?.isConflict === nextProps.mapped?.isConflict &&
       prevProps.mapped?.source === nextProps.mapped?.source &&
       prevProps.mapped?.bindings?.length === nextProps.mapped?.bindings?.length &&
       prevProps.mapped?.bindings?.[0]?.command === nextProps.mapped?.bindings?.[0]?.command
      )
    )
  );
});

Key.displayName = 'Key';
