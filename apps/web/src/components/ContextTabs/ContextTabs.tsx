// ContextTabs.tsx - Tabs for switching between different keymap contexts.
// Uses global scrollbar style to align with the binding list at the side bar.
import { Tabs, TabList, Tab, useColorModeValue } from '@chakra-ui/react';
import { startTransition } from 'react';
import { useKeymapStore } from '../../store/useKeymapStore';

export const ContextTabs = () => {
  const activeContext = useKeymapStore((state) => state.activeContext);
  const hoveredContext = useKeymapStore((state) => state.hoveredContext);
  const contexts = useKeymapStore((state) => state.contexts);
  const setActiveContext = useKeymapStore((state) => state.setActiveContext);
  const setHoveredContext = useKeymapStore((state) => state.setHoveredContext);

  const handleTabsChange = (index: number) => {
    setActiveContext(contexts[index]);
    startTransition(() => {
      setHoveredContext(null);
    });
  };

  const handleTabMouseEnter = (context: string) => {
    if (context === activeContext) {
      return;
    }
    startTransition(() => {
      setHoveredContext(context);
    });
  };

  const handleTabListMouseLeave = () => {
    startTransition(() => {
      setHoveredContext(null);
    });
  };

  const index = contexts.indexOf(activeContext);
  const safeIndex = index >= 0 ? index : 0;

  const borderColor = useColorModeValue('gray.300', 'gray.700');
  const activeTextColor = useColorModeValue('gray.900', 'gray.100');
  const inactiveTextColor = useColorModeValue('gray.500', 'gray.400');
  const activeTabBg = useColorModeValue('gray.100', 'gray.900');
  const hoverTabBg = useColorModeValue('gray.200', 'gray.800');
  const activeBorderColor = useColorModeValue('gray.900', 'gray.100');
  const previewBorderColor = useColorModeValue('gray.400', 'gray.500');

  return (
    <Tabs
      index={safeIndex}
      onChange={handleTabsChange}
      variant="line"
      size="sm"
      colorScheme="gray"
      w="full"
      h="32px"
      aria-label="Context tabs"
    >
      <TabList
        className="kh-scrollbar"
        overflowX="auto"
        overflowY="hidden"
        borderBottom="none"
        borderColor={borderColor}
        display="flex"
        flexWrap="nowrap"
        h="32px"
        onMouseLeave={handleTabListMouseLeave}
      >
        {contexts.map((context) => {
          const isActive = context === activeContext;
          const isHovered = context === hoveredContext && !isActive;
          return (
            <Tab
              key={context}
              whiteSpace="nowrap"
              px={2}
              py={1}
              h="28px"
              flexShrink={0}
              fontSize="xs"
              borderRadius="none"
              color={isActive || isHovered ? activeTextColor : inactiveTextColor}
              bg={isActive ? activeTabBg : isHovered ? hoverTabBg : 'transparent'}
              borderBottomWidth="2px"
              borderColor={isActive ? activeBorderColor : isHovered ? previewBorderColor : 'transparent'}
              _selected={{
                color: activeTextColor,
                bg: activeTabBg,
                borderColor: activeBorderColor,
              }}
              _hover={{
                color: activeTextColor,
                bg: isActive ? activeTabBg : hoverTabBg,
                borderColor: isActive ? activeBorderColor : previewBorderColor,
              }}
              onMouseEnter={() => handleTabMouseEnter(context)}
              onFocus={() => handleTabMouseEnter(context)}
              onBlur={handleTabListMouseLeave}
            >
              {context}
            </Tab>
          );
        })}
      </TabList>
    </Tabs>
  );
};
