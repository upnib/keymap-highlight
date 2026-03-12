// AppLayout.tsx - Main viewport shell with resizable sidebar and draggable bottom details panel.
// The sidebar height and overflow are constrained so its bottom edge always aligns with the top of the bottom panel.
import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useState } from 'react';
import { Box, Flex, useColorModeValue } from '@chakra-ui/react';
import { useKeymapStore } from '../../store/useKeymapStore';

interface AppLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  bottomPanel?: ReactNode;
}

const MIN_BOTTOM_PANEL_HEIGHT = 60;
const MAX_BOTTOM_PANEL_HEIGHT = 800;
const MOBILE_BOTTOM_PANEL_HEIGHT = 150;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 1000;
const DEFAULT_SIDEBAR_WIDTH_PERCENT = 0.27;
const DEFAULT_BOTTOM_PANEL_HEIGHT_PERCENT = 0.18;

const getBottomPanelViewportMax = () =>
  Math.min(MAX_BOTTOM_PANEL_HEIGHT, Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.floor(window.innerHeight * 0.80)));

const clampBottomPanelHeight = (height: number) =>
  Math.min(getBottomPanelViewportMax(), Math.max(MIN_BOTTOM_PANEL_HEIGHT, height));

const getSidebarViewportMax = () =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.80)));

const clampSidebarWidth = (width: number) =>
  Math.min(getSidebarViewportMax(), Math.max(MIN_SIDEBAR_WIDTH, width));

export function AppLayout({ children, sidebar, bottomPanel }: AppLayoutProps) {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.300', 'gray.700');
  const gripIndicatorColor = useColorModeValue('gray.300', 'gray.600');
  const resizeRailColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const resizeRailHover = useColorModeValue('gray.400', 'whiteAlpha.400');
  const sidebarWidth = useKeymapStore((state) => state.sidebarWidth);
  const setSidebarWidth = useKeymapStore((state) => state.setSidebarWidth);
  const bottomPanelHeight = useKeymapStore((state) => state.bottomPanelHeight);
  const setBottomPanelHeight = useKeymapStore((state) => state.setBottomPanelHeight);
  const sidebarPosition = useKeymapStore((state) => state.sidebarPosition);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);
  const isSidebarLeft = sidebarPosition === 'left';

  useEffect(() => {
    const applyViewportClamp = () => {
      const { sidebarWidth: currentSidebarWidth, bottomPanelHeight: currentBottomPanelHeight } = useKeymapStore.getState();

      let targetSidebarWidth = currentSidebarWidth;
      if (currentSidebarWidth === 0) {
        targetSidebarWidth = Math.floor(window.innerWidth * DEFAULT_SIDEBAR_WIDTH_PERCENT);
      }
      const clampedSidebarWidth = clampSidebarWidth(targetSidebarWidth);
      if (clampedSidebarWidth !== currentSidebarWidth) {
        setSidebarWidth(clampedSidebarWidth);
      }

      let targetBottomPanelHeight = currentBottomPanelHeight;
      if (currentBottomPanelHeight === 0) {
        targetBottomPanelHeight = Math.floor(window.innerHeight * DEFAULT_BOTTOM_PANEL_HEIGHT_PERCENT);
      }
      const clampedBottomPanelHeight = clampBottomPanelHeight(targetBottomPanelHeight);
      if (clampedBottomPanelHeight !== currentBottomPanelHeight) {
        setBottomPanelHeight(clampedBottomPanelHeight);
      }
    };

    applyViewportClamp();
    let resizeFrame: number;
    const debouncedResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(applyViewportClamp);
    };
    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      cancelAnimationFrame(resizeFrame);
    };
  }, [setBottomPanelHeight, setSidebarWidth]);

  const handleBottomPanelResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    setIsResizingBottomPanel(true);
    const startY = event.clientY;
    const startHeight = bottomPanelHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const nextHeight = clampBottomPanelHeight(startHeight + deltaY);

      setBottomPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBottomPanel(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSidebarResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    setIsResizingSidebar(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = isSidebarLeft ? moveEvent.clientX : window.innerWidth - moveEvent.clientX;
      const clamped = clampSidebarWidth(nextWidth);
      setSidebarWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const canvasPane = (
    <Box
      flex="1"
      display={{ base: 'none', md: 'flex' }}
      flexDirection="column"
      overflow="hidden"
      borderRight={isSidebarLeft ? '0' : '1px'}
      borderLeft={isSidebarLeft ? '1px' : '0'}
      borderColor={borderColor}
    >
      <Box flex="1" position="relative" overflow="hidden" px={{ md: 2, lg: 3 }} py={{ md: 2, lg: 3 }}>
        {children}
      </Box>
    </Box>
  );

  const sidebarRail = (
    <Box
      display={{ base: 'none', md: 'block' }}
      w="4px"
      cursor="col-resize"
      onMouseDown={handleSidebarResizeStart}
      bg={isResizingSidebar ? resizeRailHover : resizeRailColor}
      transition="background-color 0.05s ease"
      _hover={{ bg: resizeRailHover }}
    />
  );

  const sidebarPane = (
    <Box
      w={{ base: '100%', md: `${sidebarWidth}px` }}
      h={{ base: '100%', md: bottomPanel ? `calc(100dvh - ${bottomPanelHeight}px)` : '100%' }}
      bg={sidebarBg}
      borderLeft={isSidebarLeft ? '0' : '1px'}
      borderRight={isSidebarLeft ? '1px' : '0'}
      borderColor={borderColor}
      overflowY={{ base: 'auto', md: 'hidden' }}
      overflowX="hidden"
      zIndex={10}
      shadow="none"
    >
      {sidebar}
    </Box>
  );

  return (
    <Flex direction="column" h="100dvh" w="100vw" overflow="hidden" bg={bg}>
      <Flex flex="1" minH={0} overflow="hidden">
        {isSidebarLeft ? (
          <>
            {sidebarPane}
            {sidebarRail}
            {canvasPane}
          </>
        ) : (
          <>
            {canvasPane}
            {sidebarRail}
            {sidebarPane}
          </>
        )}
      </Flex>
      {bottomPanel && (
        <Box
          h={{ base: `${MOBILE_BOTTOM_PANEL_HEIGHT}px`, md: `${bottomPanelHeight}px` }}
          borderTop="1px"
          borderColor={borderColor}
          bg={sidebarBg}
          flexShrink={0}
          display="flex"
          flexDirection="column"
          data-testid="bottom-panel"
        >
          <Box
            h="4px"
            cursor="row-resize"
            onMouseDown={handleBottomPanelResizeStart}
            display={{ base: 'none', md: 'flex' }}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
            bg={isResizingBottomPanel ? resizeRailHover : resizeRailColor}
            transition="background-color 0.05s ease"
            _hover={{ bg: resizeRailHover }}
          >
            <Box h="3px" w="24px" borderRadius="none" bg={gripIndicatorColor} />
          </Box>
          <Box 
            flex="1" 
            overflowY="auto"
            sx={{
              scrollbarWidth: 'none',
              '::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {bottomPanel}
          </Box>
        </Box>
      )}
    </Flex>
  );
}
