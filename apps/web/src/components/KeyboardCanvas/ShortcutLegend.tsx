// ShortcutLegend.tsx — Bottom-left canvas overlay explaining shortcut indicator shapes.
// Mirrors ZoomToolbar visual style: same border, shadow, backdrop, and spacing conventions.
import { Box, HStack, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Layer, RegularPolygon, Stage } from 'react-konva';
import {
  CANVAS_INDICATOR_RADIUS,
  CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER,
  CANVAS_SHORTCUT_LEGEND_SHAPE_ICON_SIZE,
} from '../../constants/canvas';
import { RELATED_SHORTCUT_COLORS } from '../../hooks/useRelatedKeys';

type LegendShape = 'dot' | 'triangle' | 'square';

function ShapeIcon({ shape, color }: { shape: LegendShape; color: string }) {
  return (
    <Stage
      width={CANVAS_SHORTCUT_LEGEND_SHAPE_ICON_SIZE}
      height={CANVAS_SHORTCUT_LEGEND_SHAPE_ICON_SIZE}
      style={{ display: 'block', flexShrink: 0 }}
      listening={false}
    >
      <Layer listening={false}>
        {shape === 'dot' ? (
          <Circle
            x={CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER}
            y={CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER}
            radius={CANVAS_INDICATOR_RADIUS}
            fill={color}
            strokeWidth={0}
            shadowColor={color}
            shadowBlur={5}
            shadowOpacity={0.45}
            listening={false}
          />
        ) : (
          <RegularPolygon
            x={CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER}
            y={CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER}
            sides={shape === 'triangle' ? 3 : 4}
            radius={CANVAS_INDICATOR_RADIUS + 0.5}
            fill={color}
            strokeWidth={0}
            rotation={shape === 'square' ? 45 : 0}
            shadowColor={color}
            shadowBlur={5}
            shadowOpacity={0.45}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}

export const ShortcutLegend = memo(function ShortcutLegend() {
  const { t } = useTranslation();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'whiteAlpha.800');
  const legendShapeColors = useMemo(() => {
    const dotColor = RELATED_SHORTCUT_COLORS[8]; // Purple-ish
    const triangleColor = RELATED_SHORTCUT_COLORS[11]; // Green-ish
    const squareColor = RELATED_SHORTCUT_COLORS[7]; // Yellow-ish
    return {
      dots: [dotColor, dotColor],
      triangles: [triangleColor, triangleColor, triangleColor],
      squares: [squareColor, squareColor, squareColor, squareColor],
    };
  }, []);

  return (
    <Box
      position="absolute"
      bottom={{ base: 3, md: 4 }}
      left={{ base: 3, md: 4 }}
      bg={bg}
      borderRadius="none"
      borderWidth="1px"
      borderColor={borderColor}
      boxShadow="sm"
      p={1.5}
      backdropFilter="blur(8px)"
      zIndex={0}
      pointerEvents="none"
      userSelect="none"
      data-testid="shortcut-legend"
    >
      <VStack spacing={1} align="stretch">
        <HStack spacing={1.5}>
          <HStack spacing={0.5} minW="30px">
            <ShapeIcon shape="dot" color={legendShapeColors.dots[0]} />
            <ShapeIcon shape="dot" color={legendShapeColors.dots[1]} />
          </HStack>
          <Text fontSize="xs" color={textColor} lineHeight="short">
            {t('canvas.legendDot', 'Shortcut for pressing two keys')}
          </Text>
        </HStack>
        <HStack spacing={1.5}>
          <HStack spacing={0.5} minW="44px">
            <ShapeIcon shape="triangle" color={legendShapeColors.triangles[0]} />
            <ShapeIcon shape="triangle" color={legendShapeColors.triangles[1]} />
            <ShapeIcon shape="triangle" color={legendShapeColors.triangles[2]} />
          </HStack>
          <Text fontSize="xs" color={textColor} lineHeight="short">
            {t('canvas.legendTriangle', 'Shortcut for pressing three keys')}
          </Text>
        </HStack>
        <HStack spacing={1.5}>
          <HStack spacing={0.5} minW="57px">
            <ShapeIcon shape="square" color={legendShapeColors.squares[0]} />
            <ShapeIcon shape="square" color={legendShapeColors.squares[1]} />
            <ShapeIcon shape="square" color={legendShapeColors.squares[2]} />
            <ShapeIcon shape="square" color={legendShapeColors.squares[3]} />
          </HStack>
          <Text fontSize="xs" color={textColor} lineHeight="short">
            {t('canvas.legendSquare', 'Shortcut for pressing four keys')}
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
});
