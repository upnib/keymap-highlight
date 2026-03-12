// LayoutSelector - switch physical keyboard layout via Chakra Select.
import { Select } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { layouts } from '@keymap-highlight/layout-pipeline';
import { useKeymapStore, type LayoutType } from '../../store/useKeymapStore';

const availableLayoutKeys = new Set<LayoutType>(Object.keys(layouts) as LayoutType[]);

export const LayoutSelector = () => {
  const { t } = useTranslation();
  const layoutLabels = useMemo<Record<LayoutType, string>>(() => ({
    'ansi-60': t('settings.layoutOptions.ansi60'),
    'ansi-75': t('settings.layoutOptions.ansi75'),
    'ansi-tkl': t('settings.layoutOptions.ansiTkl'),
    'ansi-full': t('settings.layoutOptions.ansiFull'),
    'iso-60': t('settings.layoutOptions.iso60'),
    'iso-75': t('settings.layoutOptions.iso75'),
    'iso-tkl': t('settings.layoutOptions.isoTkl'),
    'iso-full': t('settings.layoutOptions.isoFull'),
    'jis-60': t('settings.layoutOptions.jis60'),
    'jis-75': t('settings.layoutOptions.jis75'),
    'jis-tkl': t('settings.layoutOptions.jisTkl'),
    'jis-full': t('settings.layoutOptions.jisFull'),
    'apple-macbook-ansi': t('settings.layoutOptions.appleMacbookAnsi'),
    'apple-macbook-iso': t('settings.layoutOptions.appleMacbookIso'),
    'apple-macbook-jis': t('settings.layoutOptions.appleMacbookJis'),
    'apple-macbook-zh-pinyin': t('settings.layoutOptions.appleMacbookZhPinyin'),
    'apple-macbook-zh-zhuyin': t('settings.layoutOptions.appleMacbookZhZhuyin'),
    hhkb: t('settings.layoutOptions.hhkb'),
    'alice-arisu': t('settings.layoutOptions.aliceArisu'),
  }), [t]);

  const layoutGroups = useMemo<Array<{ label: string; keys: LayoutType[] }>>(() => [
    { label: t('settings.layoutGroups.ansi'), keys: ['ansi-60', 'ansi-75', 'ansi-tkl', 'ansi-full'] },
    { label: t('settings.layoutGroups.iso'), keys: ['iso-60', 'iso-75', 'iso-tkl', 'iso-full'] },
    { label: t('settings.layoutGroups.jis'), keys: ['jis-60', 'jis-75', 'jis-tkl', 'jis-full'] },
    {
      label: t('settings.layoutGroups.apple'),
      keys: [
        'apple-macbook-ansi',
        'apple-macbook-iso',
        'apple-macbook-jis',
        'apple-macbook-zh-pinyin',
        'apple-macbook-zh-zhuyin',
      ],
    },
    { label: t('settings.layoutGroups.hhkb'), keys: ['hhkb'] },
    { label: t('settings.layoutGroups.aliceArisu'), keys: ['alice-arisu'] },
  ], [t]);
  const currentLayout = useKeymapStore((s) => s.currentLayout);
  const setCurrentLayout = useKeymapStore((s) => s.setCurrentLayout);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentLayout(event.target.value as LayoutType);
  };

  return (
    <Select
      id="layout-select"
      value={currentLayout}
      onChange={handleChange}
      size="xs"
      h="28px"
      borderRadius="none"
      data-testid="layout-selector"
    >
      {layoutGroups.map((group) => {
        const validKeys = group.keys.filter((layoutKey) => availableLayoutKeys.has(layoutKey));
        if (validKeys.length === 0) return null;

        return (
          <optgroup key={group.label} label={group.label}>
            {validKeys.map((layoutKey) => (
              <option key={layoutKey} value={layoutKey}>
                {layoutLabels[layoutKey] ?? layoutKey}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
};
