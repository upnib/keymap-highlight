// KeyboardCanvas.tsx - Interactive Konva-based canvas for physical keyboard layouts.
// Supports Ctrl+Wheel zoom, pinch-to-zoom on touch devices, drag-to-pan, and fit.
// When os === 'mac', applies a semantic layout transform only for non-Apple layouts
// to remap PC modifier keys to Apple physical positions without rewriting native Apple labels.
// Dynamically maps physical keys to logical input layouts (e.g. QWERTY -> Colemak) for correct selection, hover grouping, and shortcut binding lookups.
// Supports full remapping of keys including secondary/help characters (e.g. Japanese Kana on JIS layouts) based on the mapped layout.
// Displays and organizes grouping visualization shapes for related shortcuts dynamically positioned on keys.
import { Box, Center, Text, useColorModeValue, useColorMode, useToken } from '@chakra-ui/react';
import type { ParsedKleKeyGeometry, ParsedKleLayout } from '@keymap-highlight/file-parsers';
import type { KonvaEventObject } from 'konva/lib/Node';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, RegularPolygon, Stage } from 'react-konva';
import {
  createBindingSignature,
  INPUT_LAYOUT_MAPPINGS,
  resolveBindingDisplayKey,
} from '@keymap-highlight/layout-pipeline';
import {
  CANVAS_FIT_PADDING_X,
  CANVAS_FIT_PADDING_Y,
  CANVAS_INDICATOR_FADE_DURATION_MS,
  CANVAS_INDICATOR_OFFSET_X,
  CANVAS_INDICATOR_OFFSET_Y,
  CANVAS_INDICATOR_RADIUS,
  CANVAS_MAC_LAYOUT_MODIFIER_CODES,
  CANVAS_INDICATOR_STACK_GAP,
  CANVAS_RELATED_INDICATOR_MAX_PER_KEY,
  KEY_UNIT_SIZE,
  KEY_UNIT_SPACING,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  MODIFIER_DISPLAY_LABELS,
  RELATED_INDICATOR_SHAPE_ORDER,
  ZOOM_LEVEL_STEP,
} from '../../constants/canvas';
import { useKeymapMapper } from '../../hooks/useKeymapMapper';
import { useRelatedKeys, type RelatedIndicatorShape } from '../../hooks/useRelatedKeys';
import { useKeymapStore, type SupportedOs } from '../../store/useKeymapStore';
import { Key } from './Key';
import { KeyTooltip } from './KeyTooltip';
import { ZoomToolbar } from './ZoomToolbar';
import { ShortcutLegend } from './ShortcutLegend';

interface KeyboardCanvasProps {
  layout?: ParsedKleLayout;
}

type CanvasModifier = 'ctrl' | 'shift' | 'alt' | 'meta' | 'menu';
type ActiveModifierKeyMap = Partial<Record<CanvasModifier, string>>;

export interface KeyColors {
  standard: { fill: string; stroke: string; text: string };
  modifier: { fill: string; stroke: string; text: string; activeFill: string; activeText: string };
  action: { fill: string; stroke: string; text: string };
  conflict: { stroke: string; shadow: string };
}

const normalizeLabelToken = (label: string) => label.toLowerCase().replace(/\s+/g, '');

const getDisplayLabelForOs = (label: string, os: SupportedOs) => {
  const osMapping = MODIFIER_DISPLAY_LABELS[normalizeLabelToken(label)];
  return osMapping?.[os] ?? label;
};

const resolveModifierKindFromCode = (code: string): CanvasModifier | null => {
  const lower = code.toLowerCase();
  if (lower.includes('control') || lower.includes('ctrl')) return 'ctrl';
  if (lower.includes('shift')) return 'shift';
  if (lower.includes('alt') || lower.includes('option') || lower === 'opt') return 'alt';
  if (lower.includes('menu')) return 'menu';
  if (
    lower.includes('meta') ||
    lower.includes('gui') ||
    lower.includes('super') ||
    lower.includes('win') ||
    lower.includes('cmd') ||
    lower.includes('command')
  ) {
    return 'meta';
  }
  return null;
};

function applyMacLayoutTransform(layout: ParsedKleLayout): ParsedKleLayout {
  const getPrimaryToken = (label: string) => {
    const [primary = ''] = label.split('\n');
    return primary.trim().toLowerCase();
  };

  const isSpacebarLabel = (label: string) => getPrimaryToken(label) === 'space';

  const spaceKey = layout
    .filter((k) => isSpacebarLabel(k.label))
    .sort((a, b) => a.x - b.x)[0];

  if (!spaceKey) return layout;

  const spaceRowY = spaceKey.y;
  const spaceStartX = spaceKey.x;

  const isWinMetaCmd = (token: string) => {
    return token === 'win' || token === 'windows' || token === 'meta' || token === 'super' || token === 'gui' || token === 'cmd' || token === 'command';
  };

  const isAltOpt = (token: string) => {
    return token === 'alt' || token === 'altgr' || token === 'option' || token === 'opt';
  };

  return layout.map((key) => {
    const keyToken = getPrimaryToken(key.label);
    const isSameRowAsSpace = Math.abs(key.y - spaceRowY) < 0.01;
    const isLeftOfSpace = key.x < spaceStartX;

    if (isSameRowAsSpace && isLeftOfSpace && !isSpacebarLabel(key.label) && CANVAS_MAC_LAYOUT_MODIFIER_CODES.has(keyToken)) {
      if (isWinMetaCmd(keyToken)) {
        return { ...key, label: 'Alt', code: 'Alt' };
      }

      if (isAltOpt(keyToken)) {
        return { ...key, label: 'Win', code: 'Win' };
      }
    }

    return key;
  });
}

interface IndicatorRenderItem {
  key: string;
  x: number;
  y: number;
  color: string;
  shape: RelatedIndicatorShape;
}

const resolvePolygonSides = (shape: RelatedIndicatorShape): number => {
  if (shape === 'triangle') return 3;
  if (shape === 'square') return 4;
  return 5;
};

const IndicatorLayer = memo(function IndicatorLayer({
  relatedKeys,
  layoutKeyLookup,
}: {
  relatedKeys: Map<string, { color: string; shape: RelatedIndicatorShape; shortcutCommand: string }[]>;
  layoutKeyLookup: Map<string, ParsedKleKeyGeometry[]>;
}) {
  const [visibleRelatedKeys, setVisibleRelatedKeys] = useState(relatedKeys);
  const [indicatorOpacity, setIndicatorOpacity] = useState(0);
  const indicatorOpacityRef = useRef(0);
  const indicatorAnimationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (indicatorAnimationFrameRef.current !== null) {
      cancelAnimationFrame(indicatorAnimationFrameRef.current);
      indicatorAnimationFrameRef.current = null;
    }

    const targetOpacity = relatedKeys.size > 0 ? 1 : 0;
    if (relatedKeys.size > 0) {
      setVisibleRelatedKeys(relatedKeys);
    }

    const startOpacity = indicatorOpacityRef.current;
    if (Math.abs(targetOpacity - startOpacity) < 0.001) {
      indicatorOpacityRef.current = targetOpacity;
      setIndicatorOpacity(targetOpacity);
      if (targetOpacity === 0 && relatedKeys.size === 0) {
        setVisibleRelatedKeys((current) => (current.size === 0 ? current : new Map()));
      }
      return;
    }

    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / CANVAS_INDICATOR_FADE_DURATION_MS, 1);
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const nextOpacity = startOpacity + (targetOpacity - startOpacity) * easedProgress;

      indicatorOpacityRef.current = nextOpacity;
      setIndicatorOpacity(nextOpacity);

      if (progress < 1) {
        indicatorAnimationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      indicatorAnimationFrameRef.current = null;
      if (targetOpacity === 0 && relatedKeys.size === 0) {
        setVisibleRelatedKeys((current) => (current.size === 0 ? current : new Map()));
      }
    };

    indicatorAnimationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (indicatorAnimationFrameRef.current !== null) {
        cancelAnimationFrame(indicatorAnimationFrameRef.current);
        indicatorAnimationFrameRef.current = null;
      }
    };
  }, [relatedKeys]);

  const indicatorRenderItems = useMemo(() => {
    const items: IndicatorRenderItem[] = [];

    for (const [keyCode, indicators] of visibleRelatedKeys.entries()) {
      const layoutKeys = layoutKeyLookup.get(keyCode);
      if (!layoutKeys) {
        continue;
      }

      const sortedIndicators = [...indicators].sort(
        (a, b) => RELATED_INDICATOR_SHAPE_ORDER[a.shape] - RELATED_INDICATOR_SHAPE_ORDER[b.shape]
      );

      for (const layoutKey of layoutKeys) {
        const keyWidth = (layoutKey.w ?? 1) * KEY_UNIT_SIZE - KEY_UNIT_SPACING;
        const indicatorBaseX = layoutKey.x * KEY_UNIT_SIZE + keyWidth - CANVAS_INDICATOR_OFFSET_X;
        const indicatorBaseY = layoutKey.y * KEY_UNIT_SIZE + CANVAS_INDICATOR_OFFSET_Y;

        const displayIndicators = sortedIndicators.slice(0, CANVAS_RELATED_INDICATOR_MAX_PER_KEY);

        displayIndicators.forEach((indicator, indicatorIndex) => {
          const col = indicatorIndex % 4;
          const row = Math.floor(indicatorIndex / 4);
          
          items.push({
            key: `${keyCode}-${layoutKey.x}-${layoutKey.y}-${indicator.shortcutCommand}-${indicator.shape}-${indicator.color}-${indicatorIndex}`,
            x: indicatorBaseX - col * CANVAS_INDICATOR_STACK_GAP,
            y: indicatorBaseY + row * CANVAS_INDICATOR_STACK_GAP,
            color: indicator.color,
            shape: indicator.shape,
          });
        });
      }
    }

    return items;
  }, [layoutKeyLookup, visibleRelatedKeys]);

  return (
    <Layer listening={false} opacity={indicatorOpacity}>
      {indicatorRenderItems.map((indicator) => (
        <Group key={indicator.key} x={indicator.x} y={indicator.y} listening={false}>
          {indicator.shape === 'dot' ? (
            <Circle
              radius={CANVAS_INDICATOR_RADIUS}
              fill={indicator.color}
              strokeWidth={0}
              shadowColor={indicator.color}
              shadowBlur={5}
              shadowOpacity={0.45}
            />
          ) : (
            <RegularPolygon
              sides={resolvePolygonSides(indicator.shape)}
              radius={CANVAS_INDICATOR_RADIUS + 0.5}
              fill={indicator.color}
              strokeWidth={0}
              rotation={indicator.shape === 'square' ? 45 : 0}
              shadowColor={indicator.color}
              shadowBlur={5}
              shadowOpacity={0.45}
            />
          )}
        </Group>
      ))}
    </Layer>
  );
});

const KeysLayer = memo(function KeysLayer({
  layout,
  os,
  mappedKeys,
  activeModifiers,
  activeModifierKeyIds,
  selectedKey,
  colorMode,
  remapKeyLabel,
  onKeyClick,
  onKeyMouseEnter,
  onKeyMouseLeave,
}: {
  layout: ParsedKleLayout;
  os: SupportedOs;
  mappedKeys: ReturnType<typeof useKeymapMapper>['mappedKeys'];
  activeModifiers: string[];
  activeModifierKeyIds: ActiveModifierKeyMap;
  selectedKey: string | null;
  colorMode: 'light' | 'dark';
  remapKeyLabel: (label: string) => string;
  onKeyClick: (code: string, keyInstanceId: string) => void;
  onKeyMouseEnter: (code: string) => void;
  onKeyMouseLeave: () => void;
}) {
  const [
    standardFillLight, standardFillDark,
    standardStrokeLight, standardStrokeDark,
    standardTextLight, standardTextDark,
    modifierFillLight, modifierFillDark,
    modifierStrokeLight, modifierStrokeDark,
    modifierTextLight, modifierTextDark,
    modifierActiveFill, modifierActiveText,
    actionFillLight, actionFillDark,
    actionStrokeLight, actionStrokeDark,
    actionTextLight, actionTextDark,
    conflictStrokeLight, conflictStrokeDark,
    conflictShadowLight, conflictShadowDark,
  ] = useToken('colors', [
    'key.standardLight', 'key.standardDark',
    'key.standardStrokeLight', 'key.standardStrokeDark',
    'key.standardTextLight', 'key.standardTextDark',
    'key.modifierLight', 'key.modifierDark',
    'key.modifierStrokeLight', 'key.modifierStrokeDark',
    'key.modifierTextLight', 'key.modifierTextDark',
    'key.modifierActiveFill', 'key.modifierActiveText',
    'key.actionFillLight', 'key.actionFillDark',
    'key.actionStrokeLight', 'key.actionStrokeDark',
    'key.actionTextLight', 'key.actionTextDark',
    'key.conflictStrokeLight', 'key.conflictStrokeDark',
    'key.conflictShadowLight', 'key.conflictShadowDark',
  ]);

  const resolvedColors: KeyColors = useMemo(() => (
    colorMode === 'light'
      ? {
          standard: { fill: standardFillLight, stroke: standardStrokeLight, text: standardTextLight },
          modifier: { fill: modifierFillLight, stroke: modifierStrokeLight, text: modifierTextLight, activeFill: modifierActiveFill, activeText: modifierActiveText },
          action:   { fill: actionFillLight,   stroke: actionStrokeLight,   text: actionTextLight },
          conflict: { stroke: conflictStrokeLight, shadow: conflictShadowLight },
        }
      : {
          standard: { fill: standardFillDark, stroke: standardStrokeDark, text: standardTextDark },
          modifier: { fill: modifierFillDark, stroke: modifierStrokeDark, text: modifierTextDark, activeFill: modifierActiveFill, activeText: modifierActiveText },
          action:   { fill: actionFillDark,   stroke: actionStrokeDark,   text: actionTextDark },
          conflict: { stroke: conflictStrokeDark, shadow: conflictShadowDark },
        }
  ), [colorMode, standardFillLight, standardFillDark, standardStrokeLight, standardStrokeDark, standardTextLight, standardTextDark, modifierFillLight, modifierFillDark, modifierStrokeLight, modifierStrokeDark, modifierTextLight, modifierTextDark, modifierActiveFill, modifierActiveText, actionFillLight, actionFillDark, actionStrokeLight, actionStrokeDark, actionTextLight, actionTextDark, conflictStrokeLight, conflictStrokeDark, conflictShadowLight, conflictShadowDark]);

  const normalizedActiveModifiers = useMemo(
    () => Array.from(new Set(activeModifiers)),
    [activeModifiers]
  );

  const selectedModifierKind = useMemo(
    () => (selectedKey ? resolveModifierKindFromCode(selectedKey) : null),
    [selectedKey]
  );

  return (
    <Layer>
      {layout.map((key, i) => {
        const keyInstanceId = `${i}-${key.x}-${key.y}`;
        const originalCode = key.code || key.label;
        const originalLabel = getDisplayLabelForOs(key.label, os);
        const logicalCode = remapKeyLabel(originalLabel);
        const mappingCode = logicalCode.split('\n')[0] ?? logicalCode;
        
        const mappedInfo = mappedKeys.get(mappingCode);

        let isActive = false;
        const modifierKind = resolveModifierKindFromCode(originalCode);
        if (modifierKind && normalizedActiveModifiers.includes(modifierKind)) {
          const activeKeyId = activeModifierKeyIds[modifierKind];
          isActive = activeKeyId ? activeKeyId === keyInstanceId : true;
        }

        let isSelected = selectedKey === mappingCode;
        if (modifierKind && selectedModifierKind === modifierKind) {
          const selectedModifierKeyId = activeModifierKeyIds[modifierKind];
          isSelected = selectedModifierKeyId ? selectedModifierKeyId === keyInstanceId : false;
        }

        return (
          <Key
            key={keyInstanceId}
            keyCode={mappingCode}
            x={key.x}
            y={key.y}
            w={key.w}
            h={key.h}
            w2={key.w2}
            h2={key.h2}
            x2={key.x2}
            y2={key.y2}
            label={logicalCode}
            mapped={mappedInfo}
            isActive={isActive}
            isSelected={isSelected}
            isConflict={mappedInfo?.isConflict}
            onClick={(clickedCode) => onKeyClick(clickedCode, keyInstanceId)}
            onMouseEnter={onKeyMouseEnter}
            onMouseLeave={onKeyMouseLeave}
            colors={resolvedColors}
          />
        );
      })}
    </Layer>
  );
});

export function KeyboardCanvas({ layout = [] }: KeyboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stagePosRef = useRef(stagePos);
  const [hasFitted, setHasFitted] = useState(false);
  const [activeModifierKeyIds, setActiveModifierKeyIds] = useState<ActiveModifierKeyMap>({});

  useEffect(() => {
    stagePosRef.current = stagePos;
  }, [stagePos]);

  useEffect(() => {
    void layout;
    setHasFitted(false);
  }, [layout]);

  const zoomLevel = useKeymapStore((state) => state.zoomLevel);
  const setZoomLevel = useKeymapStore((state) => state.setZoomLevel);
  const selectedKey = useKeymapStore((state) => state.selectedKey);
  const setSelectedKey = useKeymapStore((state) => state.setSelectedKey);
  const hoveredKey = useKeymapStore((state) => state.hoveredKey);
  const setHoveredKey = useKeymapStore((state) => state.setHoveredKey);
  const hoveredBindingSignature = useKeymapStore((state) => state.hoveredBindingSignature);
  const bindings = useKeymapStore((state) => state.bindings);
  const activeContext = useKeymapStore((state) => state.activeContext);
  const hoveredContext = useKeymapStore((state) => state.hoveredContext);
  const activeModifiers = useKeymapStore((state) => state.activeModifiers);
  const os = useKeymapStore((state) => state.os);
  const currentLayout = useKeymapStore((state) => state.currentLayout);
  const toggleModifier = useKeymapStore((state) => state.toggleModifier);
  const inputLayout = useKeymapStore((state) => state.inputLayout);
  const customInputMapping = useKeymapStore((state) => state.customInputMapping);

  const activeInputMapping = useMemo(() => {
    if (inputLayout === 'custom') {
      return customInputMapping;
    }

    return INPUT_LAYOUT_MAPPINGS[inputLayout];
  }, [inputLayout, customInputMapping]);

  const { mappedKeys } = useKeymapMapper();
  const contextForPreview = hoveredContext ?? activeContext;
  const derivedHoveredKeyFromBinding = useMemo(() => {
    if (!hoveredBindingSignature) {
      return null;
    }

    const hoveredBinding = bindings.find((binding) => createBindingSignature(binding) === hoveredBindingSignature);
    if (!hoveredBinding) {
      return null;
    }

    return (
      resolveBindingDisplayKey(hoveredBinding.key, os, activeInputMapping)
      ?? hoveredBinding.key.split('+').pop()?.trim().toUpperCase()
      ?? hoveredBinding.key
    );
  }, [activeInputMapping, bindings, hoveredBindingSignature, os]);
  const effectiveHoveredKey = hoveredKey ?? derivedHoveredKeyFromBinding;
  const relatedKeys = useRelatedKeys({
    hoveredKey: effectiveHoveredKey,
    hoveredBindingSignature: hoveredKey ? null : hoveredBindingSignature,
    bindings,
    activeContext: contextForPreview,
    activeModifiers,
    os,
  });
  const bg = useColorModeValue('gray.50', 'gray.900');
  const { colorMode } = useColorMode();

  const shouldApplyMacLayoutTransform = os === 'mac' && typeof currentLayout === 'string' && !currentLayout.startsWith('apple-');

  const effectiveLayout = useMemo(
    () => (shouldApplyMacLayoutTransform ? applyMacLayoutTransform(layout) : layout),
    [layout, shouldApplyMacLayoutTransform],
  );

  useEffect(() => {
    const normalizedActiveModifierSet = new Set(activeModifiers);

    setActiveModifierKeyIds((current) => {
      let hasChange = false;
      const next: ActiveModifierKeyMap = {};

      for (const [modifier, keyId] of Object.entries(current) as [CanvasModifier, string][]) {
        if (normalizedActiveModifierSet.has(modifier)) {
          next[modifier] = keyId;
        } else {
          hasChange = true;
        }
      }

      return hasChange ? next : current;
    });
  }, [activeModifiers]);

  const baseLabelToFullLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of effectiveLayout) {
      const osLabel = getDisplayLabelForOs(key.label, os);
      const parts = osLabel.split('\n');
      const base = parts[0] ?? '';
      if (base) {
        map.set(base.toLowerCase(), osLabel);
      }
    }
    return map;
  }, [effectiveLayout, os]);

  const remapKeyLabel = useCallback((label: string) => {
    const parts = label.split('\n');
    const base = parts[0] ?? '';
    const lower = base.toLowerCase();
    const mappedLabel = activeInputMapping[lower];

    if (mappedLabel !== undefined) {
      const fullMappedLabel = baseLabelToFullLabel.get(mappedLabel.toLowerCase());
      if (fullMappedLabel) {
        return fullMappedLabel;
      }

      const remappedBase = mappedLabel.length === 1 && /[a-z]/.test(mappedLabel) ? mappedLabel.toUpperCase() : mappedLabel;
      return [remappedBase, ...parts.slice(1)].join('\n');
    }

    return label;
  }, [activeInputMapping, baseLabelToFullLabel]);

  const layoutKeyLookup = useMemo(() => {
    const lookup = new Map<string, ParsedKleKeyGeometry[]>();

    for (const key of effectiveLayout) {
      const originalLabel = getDisplayLabelForOs(key.label, os);
      const logicalCode = remapKeyLabel(originalLabel);
      const mappingCode = logicalCode.split('\n')[0] ?? logicalCode;
      
      const existingKeys = lookup.get(mappingCode);
      if (existingKeys) {
        existingKeys.push(key);
      } else {
        lookup.set(mappingCode, [key]);
      }
    }

    return lookup;
  }, [effectiveLayout, os, remapKeyLabel]);

  const hoveredLayoutKey = useMemo(() => {
    if (!effectiveHoveredKey) {
      return null;
    }

    return layoutKeyLookup.get(effectiveHoveredKey)?.[0] ?? null;
  }, [effectiveHoveredKey, layoutKeyLookup]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchCenterRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2) {
      lastPinchDistRef.current = null;
      lastPinchCenterRef.current = null;
      return;
    }

    e.preventDefault();

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const centerX = (t1.clientX + t2.clientX) / 2;
    const centerY = (t1.clientY + t2.clientY) / 2;

    if (lastPinchDistRef.current !== null && lastPinchCenterRef.current !== null) {
      const scaleFactor = dist / lastPinchDistRef.current;
      const currentZoom = useKeymapStore.getState().zoomLevel;
      const newZoom = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, currentZoom * scaleFactor));

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const pointerX = centerX - rect.left;
        const pointerY = centerY - rect.top;
        const { x: stageX, y: stageY } = stagePosRef.current;

        const mousePointTo = {
          x: (pointerX - stageX) / currentZoom,
          y: (pointerY - stageY) / currentZoom,
        };

        setZoomLevel(newZoom);
        const nextStagePos = {
          x: pointerX - mousePointTo.x * newZoom,
          y: pointerY - mousePointTo.y * newZoom,
        };
        stagePosRef.current = nextStagePos;
        setStagePos(nextStagePos);
      }
    }

    lastPinchDistRef.current = dist;
    lastPinchCenterRef.current = { x: centerX, y: centerY };
  }, [setZoomLevel]);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
    lastPinchCenterRef.current = null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  const layoutBounds = useMemo(() => {
    if (!effectiveLayout.length) return { width: 0, height: 0 };
    
    let maxX = 0;
    let maxY = 0;

    effectiveLayout.forEach((key) => {
      const w = key.w ?? 1;
      const h = key.h ?? 1;
      const keyMaxX = key.x + w;
      const keyMaxY = key.y + h;
      
      if (keyMaxX > maxX) maxX = keyMaxX;
      if (keyMaxY > maxY) maxY = keyMaxY;
    });

    return {
      width: maxX * KEY_UNIT_SIZE,
      height: maxY * KEY_UNIT_SIZE,
    };
  }, [effectiveLayout]);

  useEffect(() => {
    if (stageSize.width === 0 || layoutBounds.width === 0 || hasFitted) return;

    const availableWidth = Math.max(0, stageSize.width - CANVAS_FIT_PADDING_X);
    const availableHeight = Math.max(0, stageSize.height - CANVAS_FIT_PADDING_Y);

    const scale = Math.min(
      availableWidth / layoutBounds.width,
      availableHeight / layoutBounds.height
    );
    const clampedScale = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, scale));
    setZoomLevel(clampedScale);
    const x = (stageSize.width - layoutBounds.width * clampedScale) / 2;
    const y = (stageSize.height - layoutBounds.height * clampedScale) / 2;
    const nextStagePos = { x, y };
    stagePosRef.current = nextStagePos;
    setStagePos(nextStagePos);
    setHasFitted(true);
  }, [layoutBounds, stageSize.width, stageSize.height, hasFitted, setZoomLevel]);

  const handleCanvasWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    if (!e.evt.ctrlKey && !e.evt.metaKey) {
      return;
    }

    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = useKeymapStore.getState().zoomLevel;
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, oldScale + direction * ZOOM_LEVEL_STEP));

    setZoomLevel(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stagePosRef.current = newPos;
    setStagePos(newPos);
  }, [setZoomLevel]);

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const nextStagePos = {
      x: e.target.x(),
      y: e.target.y(),
    };
    stagePosRef.current = nextStagePos;
    setStagePos(nextStagePos);
  }, []);

  const handleKeyClick = useCallback((code: string, keyInstanceId: string) => {
    if (!code) return;

    const modifierKind = resolveModifierKindFromCode(code);
    if (modifierKind) {
      const isModifierActive = activeModifiers.includes(modifierKind);
      const isSameKeyActive = activeModifierKeyIds[modifierKind] === keyInstanceId;

      if (isModifierActive && isSameKeyActive) {
        toggleModifier(modifierKind);
        setActiveModifierKeyIds((current) => {
          if (!current[modifierKind]) {
            return current;
          }
          const next = { ...current };
          delete next[modifierKind];
          return next;
        });

        if (useKeymapStore.getState().selectedKey === modifierKind) {
          setSelectedKey(null);
        }
        return;
      }

      if (!isModifierActive) {
        toggleModifier(modifierKind);
      }

      setActiveModifierKeyIds((current) => ({
        ...current,
        [modifierKind]: keyInstanceId,
      }));
      setSelectedKey(modifierKind);
      return;
    }

    setSelectedKey(code === useKeymapStore.getState().selectedKey ? null : code);
  }, [activeModifierKeyIds, activeModifiers, setSelectedKey, toggleModifier]);

  const handleKeyMouseEnter = useCallback((code: string) => {
    setHoveredKey(code);
  }, [setHoveredKey]);

  const handleKeyMouseLeave = useCallback(() => {
    setHoveredKey(null);
  }, [setHoveredKey]);

  const handleFit = useCallback(() => {
    const availableWidth = Math.max(0, stageSize.width - CANVAS_FIT_PADDING_X);
    const availableHeight = Math.max(0, stageSize.height - CANVAS_FIT_PADDING_Y);

    const scale = Math.min(
      availableWidth / layoutBounds.width,
      availableHeight / layoutBounds.height
    );
    const clampedScale = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, scale));
    setZoomLevel(clampedScale);
    const x = (stageSize.width - layoutBounds.width * clampedScale) / 2;
    const y = (stageSize.height - layoutBounds.height * clampedScale) / 2;
    const nextStagePos = { x, y };
    stagePosRef.current = nextStagePos;
    setStagePos(nextStagePos);
  }, [layoutBounds.height, layoutBounds.width, setZoomLevel, stageSize.height, stageSize.width]);

  if (!effectiveLayout.length) {
    return (
      <Center h="full" bg={bg}>
        <Text color="gray.500">No layout loaded</Text>
      </Center>
    );
  }

  return (
    <Box
      ref={containerRef}
      h="full"
      w="full"
      bg={bg}
      position="relative"
      overflow="hidden"
      sx={{ touchAction: 'none', overscrollBehavior: 'none' }}
      data-testid="keyboard-canvas"
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        draggable
        onWheel={handleCanvasWheel}
        onDragEnd={handleDragEnd}
        scale={{ x: zoomLevel, y: zoomLevel }}
        x={stagePos.x}
        y={stagePos.y}
        style={{ zIndex: 1, position: 'relative' }}
      >
        <KeysLayer
          layout={effectiveLayout}
          os={os}
          mappedKeys={mappedKeys}
          activeModifiers={activeModifiers}
          activeModifierKeyIds={activeModifierKeyIds}
          selectedKey={selectedKey}
          colorMode={colorMode}
          remapKeyLabel={remapKeyLabel}
          onKeyClick={handleKeyClick}
          onKeyMouseEnter={handleKeyMouseEnter}
          onKeyMouseLeave={handleKeyMouseLeave}
        />
        <IndicatorLayer relatedKeys={relatedKeys} layoutKeyLookup={layoutKeyLookup} />
        {effectiveHoveredKey && hoveredLayoutKey && (
          <Layer listening={false}>
            <KeyTooltip
              x={hoveredLayoutKey.x * KEY_UNIT_SIZE}
              y={hoveredLayoutKey.y * KEY_UNIT_SIZE}
              label={remapKeyLabel(getDisplayLabelForOs(hoveredLayoutKey.label, os))}
              mappedInfo={mappedKeys.get(effectiveHoveredKey)}
              relatedIndicators={relatedKeys.get(effectiveHoveredKey)}
              stageWidth={stageSize.width}
              stageHeight={stageSize.height}
              zoomLevel={zoomLevel}
              colorMode={colorMode}
            />
          </Layer>
        )}
      </Stage>
      <ZoomToolbar onFit={handleFit} keyCount={effectiveLayout.length} />
      <ShortcutLegend />
    </Box>
  );
}
