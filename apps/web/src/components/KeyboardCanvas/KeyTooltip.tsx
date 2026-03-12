// KeyTooltip.tsx — Hover tooltip for keyboard keys with localized binding metadata.
import { Group, Rect, Text, Circle, RegularPolygon } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  CANVAS_TOOLTIP_INDICATOR_SIZE,
  CANVAS_TOOLTIP_MAX_RELATED_INDICATORS,
  CANVAS_TOOLTIP_PADDING,
  CANVAS_TOOLTIP_THEME,
  CANVAS_TOOLTIP_WIDTH,
} from '../../constants/canvas';
import type { MappedKeyInfo } from '../../hooks/useKeymapMapper';
import type { RelatedKeyIndicator } from '../../hooks/useRelatedKeys';
import { lookupActionNameForSource } from '../../utils/editor-helpers';

interface KeyTooltipProps {
  x: number;
  y: number;
  label: string;
  mappedInfo?: MappedKeyInfo;
  relatedIndicators?: RelatedKeyIndicator[];
  stageWidth: number;
  stageHeight: number;
  zoomLevel: number;
  colorMode: 'light' | 'dark';
}

function estimateTextHeight(text: string, fontSize: number, bold: boolean): number {
  const width = CANVAS_TOOLTIP_WIDTH - CANVAS_TOOLTIP_PADDING * 2;
  const charWidth = fontSize * (bold ? 0.6 : 0.52);
  const maxCharsPerLine = Math.max(1, Math.floor(width / charWidth));
  let linesCount = 1;
  let currentLine = 0;
  
  const words = text.split(' ');
  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (currentLine > 0) linesCount++;
      linesCount += Math.floor(word.length / maxCharsPerLine);
      currentLine = (word.length % maxCharsPerLine) + 1;
    } else if (currentLine + word.length > maxCharsPerLine) {
      linesCount++;
      currentLine = word.length + 1;
    } else {
      currentLine += word.length + 1;
    }
  }
  return Math.ceil(linesCount * fontSize * 1.2);
}

interface TooltipLine {
  id: string;
  type: 'text' | 'divider' | 'indicator';
  text?: string;
  color?: string;
  size?: number;
  bold?: boolean;
  shape?: string;
  indicatorColor?: string;
  height: number;
}

export function KeyTooltip({ x, y, label, mappedInfo, relatedIndicators, stageWidth, stageHeight, zoomLevel, colorMode }: KeyTooltipProps) {
  const { i18n, t } = useTranslation();
  const palette = CANVAS_TOOLTIP_THEME[colorMode];

    const content = useMemo(() => {
    const primaryBinding = mappedInfo?.bindings?.[0];
    const lines: TooltipLine[] = [];

    const displayLabel = label.replace(/\n/g, ' / ');
    const titleText = `${t('tooltip.keyLabel', 'Key')}: ${displayLabel}`;
    lines.push({ id: `title`, type: 'text', text: titleText, color: palette.text, size: 14, bold: true, height: estimateTextHeight(titleText, 14, true) });

    if (!mappedInfo || (!mappedInfo.command && !mappedInfo.isConflict)) {
      if (!relatedIndicators || relatedIndicators.length === 0) {
        const text = t('tooltip.noBinding', 'No binding');
        lines.push({ id: `no-binding`, type: 'text', text, color: palette.subtext, size: 12, height: estimateTextHeight(text, 12, false) });
      }
    } else {
      if (mappedInfo.command) {
        const humanName = lookupActionNameForSource(mappedInfo.source, mappedInfo.command, i18n.language);
        lines.push({ id: `name`, type: 'text', text: humanName, color: palette.text, size: 13, bold: true, height: estimateTextHeight(humanName, 13, true) });
        if (humanName !== mappedInfo.command) {
          lines.push({ id: `cmd`, type: 'text', text: mappedInfo.command, color: palette.subtext, size: 10, height: estimateTextHeight(mappedInfo.command, 10, false) });
        }
      }

      if (primaryBinding?.when && primaryBinding.when !== '*') {
        const whenText = `${t('tooltip.whenLabel', 'When')}: ${primaryBinding.when}`;
        lines.push({ id: `when`, type: 'text', text: whenText, color: palette.context, size: 11, height: estimateTextHeight(whenText, 11, false) });
      }

    }

    if (relatedIndicators && relatedIndicators.length > 0) {
      if (lines.length > 1) {
        lines.push({ id: `div1`, type: 'divider', height: 9 });
      }
      const relatedTitle = t('tooltip.relatedShortcuts', 'Related Shortcuts') + ':';
      lines.push({ id: `related-title`, type: 'text', text: relatedTitle, color: palette.subtext, size: 11, bold: true, height: estimateTextHeight(relatedTitle, 11, true) });
      
      const displayIndicators = relatedIndicators.slice(0, CANVAS_TOOLTIP_MAX_RELATED_INDICATORS);
      
      displayIndicators.forEach((indicator, idx) => {
        const humanName = lookupActionNameForSource(indicator.sourceEditor, indicator.shortcutCommand, i18n.language);
        const displayText = humanName !== indicator.shortcutCommand ? humanName : indicator.shortcutCommand;
        lines.push({
          id: `ind-${idx}-${indicator.shortcutCommand}`,
          type: 'indicator',
          text: displayText,
          color: palette.text,
          size: 11,
          shape: indicator.shape,
          indicatorColor: indicator.color,
          height: Math.max(12, estimateTextHeight(displayText, 11, false)),
        });
      });

      if (relatedIndicators.length > CANVAS_TOOLTIP_MAX_RELATED_INDICATORS) {
        const moreText = `+ ${relatedIndicators.length - CANVAS_TOOLTIP_MAX_RELATED_INDICATORS} more...`;
        lines.push({ id: `more`, type: 'text', text: moreText, color: palette.subtext, size: 10, height: estimateTextHeight(moreText, 10, false) });
      }
    }

    return lines;
  }, [label, mappedInfo, relatedIndicators, i18n.language, palette, t]);

  const linesWithOffsets = useMemo(() => {
    let currentY = CANVAS_TOOLTIP_PADDING;
    return content.map((line, i) => {
      const gap = i > 0 && line.type !== 'divider' ? 4 : 0;
      currentY += gap;
      const y = currentY;
      currentY += line.height;
      return { ...line, y };
    });
  }, [content]);

  const totalHeight = linesWithOffsets.length > 0
    ? linesWithOffsets[linesWithOffsets.length - 1].y + linesWithOffsets[linesWithOffsets.length - 1].height + CANVAS_TOOLTIP_PADDING
    : CANVAS_TOOLTIP_PADDING * 2;

  const inverseScale = 1 / zoomLevel;
  const scaledWidth = CANVAS_TOOLTIP_WIDTH * inverseScale;
  const scaledHeight = totalHeight * inverseScale;
  const offsetX = 15 * inverseScale;
  const offsetY = 30 * inverseScale;

  const maxX = Math.max(0, stageWidth / zoomLevel - scaledWidth - offsetX);
  const maxY = Math.max(0, stageHeight / zoomLevel - scaledHeight - offsetY);
  let finalX = Math.min(maxX, x + offsetX);
  let finalY = Math.min(maxY, y + offsetY);
  finalX = Math.max(0, finalX);
  finalY = Math.max(0, finalY);

  return (
    <Group
      x={finalX}
      y={finalY}
      scaleX={inverseScale}
      scaleY={inverseScale}
      listening={false}
      opacity={0.8}
    >
      <Rect
        width={CANVAS_TOOLTIP_WIDTH}
        height={totalHeight}
        fill={palette.background}
        stroke={palette.border}
        strokeWidth={1}
        cornerRadius={0}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.4}
        shadowOffset={{ x: 2, y: 2 }}
      />
      {linesWithOffsets.map((line) => {
        const lineY = line.y;

        if (line.type === 'divider') {
          return (
            <Rect
              key={line.id}
               x={CANVAS_TOOLTIP_PADDING}
               y={lineY + 4}
               width={CANVAS_TOOLTIP_WIDTH - CANVAS_TOOLTIP_PADDING * 2}
               height={1}
               fill={palette.divider}
             />
          );
        }

        if (line.type === 'indicator') {
          const isDot = line.shape === 'dot';
          const sides = line.shape === 'triangle' ? 3 : line.shape === 'square' ? 4 : 5;
           const radius = CANVAS_TOOLTIP_INDICATOR_SIZE / 2;
          
          return (
             <Group key={line.id} x={CANVAS_TOOLTIP_PADDING} y={lineY}>
              {isDot ? (
                <Circle
                  x={radius}
                  y={line.height! / 2 + 1}
                  radius={radius}
                  fill={line.indicatorColor}
                />
              ) : (
                <RegularPolygon
                  x={radius}
                  y={line.height! / 2 + 1}
                  sides={sides}
                  radius={radius + 1}
                  rotation={line.shape === 'square' ? 45 : 0}
                  fill={line.indicatorColor}
                />
              )}
              <Text
                 x={CANVAS_TOOLTIP_INDICATOR_SIZE + 6}
                y={0}
                text={line.text}
                fontSize={line.size}
                fontFamily="IBM Plex Sans, sans-serif"
                fill={line.color}
                 width={CANVAS_TOOLTIP_WIDTH - CANVAS_TOOLTIP_PADDING * 2 - CANVAS_TOOLTIP_INDICATOR_SIZE - 6}
                 wrap="none"
                 ellipsis={true}
                 lineHeight={1.2}
              />
            </Group>
          );
        }

        return (
          <Text
            key={line.id}
             x={CANVAS_TOOLTIP_PADDING}
             y={lineY}
             text={line.text}
            fontSize={line.size}
            fontFamily="IBM Plex Sans, sans-serif"
            fontStyle={line.bold ? 'bold' : 'normal'}
            fill={line.color}
             width={CANVAS_TOOLTIP_WIDTH - CANVAS_TOOLTIP_PADDING * 2}
             wrap="word"
             lineHeight={1.2}
           />
        );
      })}
    </Group>
  );
}
