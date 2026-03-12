// DemoPresetPicker.tsx - Shared grouped demo preset picker used on the landing page and inside tool-page overlays.
// Renders each editor as a pull-out menu so preset variants stay organized without touching the demo source files.
import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Text,
  useColorModeValue,
  type SimpleGridProps,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { DEMO_PRESET_GROUP_ENTRIES, type DemoPresetId } from '../../constants/editors';

type DemoPresetPickerProps = {
  isLoading?: boolean;
  columns?: SimpleGridProps['columns'];
  minButtonHeight?: string | number;
  onLoadPreset: (presetId: DemoPresetId) => void | Promise<void>;
};

export function DemoPresetPicker({
  isLoading = false,
  columns = { base: 2, sm: 3, md: 4 },
  minButtonHeight = '40px',
  onLoadPreset,
}: DemoPresetPickerProps) {
  const { t } = useTranslation();
  const menuBg = useColorModeValue('white', 'gray.800');
  const menuBorder = useColorModeValue('gray.200', 'whiteAlpha.200');
  const menuHoverBg = useColorModeValue('gray.50', 'whiteAlpha.100');

  const handleLoadPreset = (presetId: DemoPresetId) => {
    void onLoadPreset(presetId);
  };

  return (
    <SimpleGrid columns={columns} spacing={3} w="full">
      {DEMO_PRESET_GROUP_ENTRIES.map((group) => (
        <Menu key={group.editor} placement="bottom-start" gutter={6} matchWidth isLazy>
          <MenuButton
            as={Button}
            size="sm"
            variant="outline"
            borderRadius="none"
            rightIcon={<ChevronDownIcon style={{ width: 14, height: 14 }} />}
            isDisabled={isLoading}
            w="full"
            minH={minButtonHeight}
            whiteSpace="normal"
            lineHeight="short"
          >
            {t(group.labelKey, group.fallback)}
          </MenuButton>
          <MenuList borderRadius="none" bg={menuBg} borderColor={menuBorder} py={0} fontSize="xs">
            {group.presets.map((preset) => (
              <MenuItem
                key={preset.id}
                onClick={() => handleLoadPreset(preset.id)}
                h="28px"
                minH="28px"
                px={3}
                py={0}
                fontSize="xs"
                whiteSpace="nowrap"
                lineHeight="normal"
                _hover={{ bg: menuHoverBg }}
                _focus={{ bg: menuHoverBg }}
              >
                <Text fontSize="xs" noOfLines={1}>{t(preset.labelKey, preset.fallback)}</Text>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      ))}
    </SimpleGrid>
  );
}
