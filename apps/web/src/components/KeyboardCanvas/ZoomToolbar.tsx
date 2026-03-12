// ZoomToolbar.tsx — Fixed overlay toolbar providing zoom controls (slider, +/-, fit-to-screen) for KeyboardCanvas.
import { Box, Button, ButtonGroup, Text, HStack, Slider, SliderFilledTrack, SliderThumb, SliderTrack, useColorModeValue } from '@chakra-ui/react';
import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid';
import { memo, useCallback } from 'react';
import { useKeymapStore } from '../../store/useKeymapStore';
import { useTranslation } from 'react-i18next';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_LEVEL_STEP } from '../../constants/canvas';

interface ZoomToolbarProps {
  onFit?: () => void;
  keyCount?: number;
}

export const ZoomToolbar = memo(function ZoomToolbar({ onFit, keyCount }: ZoomToolbarProps) {
  const { t } = useTranslation();
  const zoomLevel = useKeymapStore((state) => state.zoomLevel);
  const setZoomLevel = useKeymapStore((state) => state.setZoomLevel);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const countColor = useColorModeValue('gray.600', 'whiteAlpha.700');

  const handleZoomIn = useCallback(() => {
    setZoomLevel(Math.min(MAX_ZOOM_LEVEL, zoomLevel + ZOOM_LEVEL_STEP));
  }, [zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(Math.max(MIN_ZOOM_LEVEL, zoomLevel - ZOOM_LEVEL_STEP));
  }, [zoomLevel, setZoomLevel]);

  const handleFit = useCallback(() => {
    onFit?.();
  }, [onFit]);

  const handleSliderChange = useCallback((value: number) => {
    setZoomLevel(value);
  }, [setZoomLevel]);

  return (
    <Box
      position="absolute"
      bottom={{ base: 3, md: 4 }}
      right={{ base: 3, md: 4 }}
      bg={bg}
      borderRadius="none"
      borderWidth="1px"
      borderColor={borderColor}
      boxShadow="sm"
      p={1.5}
      backdropFilter="blur(8px)"
      zIndex={10}
      data-testid="zoom-toolbar"
    >
      <HStack spacing={1.5}>
        <ButtonGroup size="sm" isAttached variant="outline" colorScheme="gray" borderRadius="none">
          <Button onClick={handleZoomOut} aria-label={t('canvas.zoomOut')} borderRadius="none" w="32px" p={0}>
            <MinusIcon width={16} height={16} />
          </Button>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            px={1}
            borderTopWidth="1px"
            borderBottomWidth="1px"
            borderColor={borderColor}
            minW="104px"
          >
            <Slider
              aria-label={t('canvas.zoomLevel')}
              min={MIN_ZOOM_LEVEL}
              max={MAX_ZOOM_LEVEL}
              step={0.05}
              value={zoomLevel}
              onChange={handleSliderChange}
              w="72px"
              size="sm"
              colorScheme="gray"
              focusThumbOnChange={false}
            >
              <SliderTrack borderRadius="none">
                <SliderFilledTrack borderRadius="none" />
              </SliderTrack>
              <SliderThumb boxSize={3} borderRadius="none" />
            </Slider>
            <Text fontSize="xs" fontWeight="bold" color={textColor} ml={2} minW="36px" textAlign="right">
              {Math.round(zoomLevel * 100)}%
            </Text>
          </Box>
          <Button onClick={handleZoomIn} aria-label={t('canvas.zoomIn')} borderRadius="none" w="32px" p={0}>
            <PlusIcon width={16} height={16} />
          </Button>
        </ButtonGroup>
        <Button size="sm" variant="outline" colorScheme="gray" onClick={handleFit} borderRadius="none">
          {t('canvas.fitScreen')}
        </Button>
        {keyCount !== undefined && (
          <Text
            fontSize="xs"
            color={countColor}
            data-testid="canvas-key-count"
          >
            {t('canvas.keyCount', { count: keyCount })}
          </Text>
        )}
      </HStack>
    </Box>
  );
});
