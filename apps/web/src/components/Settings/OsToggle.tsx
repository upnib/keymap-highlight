// OsToggle.tsx - OS switcher control for applying editor-specific modifier behavior.
// Uses icon-only segmented buttons with localized labels in tooltips and aria attributes.
import { Button, ButtonGroup, Image, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeymapStore, type SupportedOs } from '../../store/useKeymapStore';

export const OsToggle = () => {
  const { t } = useTranslation();
  const os = useKeymapStore((state) => state.os);
  const setOs = useKeymapStore((state) => state.setOs);
  const iconFilter = useColorModeValue('none', 'invert(1)');
  
  const options = useMemo<{ value: SupportedOs; iconSrc: string; label: string }[]>(() => [
    {
      value: 'win',
      iconSrc: 'https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/svgs/brands/windows.svg',
      label: t('settings.osOptions.win'),
    },
    {
      value: 'mac',
      iconSrc: 'https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/svgs/brands/apple.svg',
      label: t('settings.osOptions.mac'),
    },
    {
      value: 'linux',
      iconSrc: 'https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/svgs/brands/linux.svg',
      label: t('settings.osOptions.linux'),
    },
  ], [t]);

  return (
    <ButtonGroup size="xs" isAttached variant="outline" w="full" borderRadius="none">
      {options.map((option) => (
        <Tooltip key={option.value} label={option.label} hasArrow>
          <Button
            size="xs"
            h="28px"
            borderRadius="none"
            variant={os === option.value ? 'solid' : 'ghost'}
            colorScheme="gray"
            onClick={() => setOs(option.value)}
            aria-label={option.label}
            flex={1}
          >
            <Image src={option.iconSrc} boxSize={4} alt={option.label} filter={iconFilter} />
          </Button>
        </Tooltip>
      ))}
    </ButtonGroup>
  );
};
