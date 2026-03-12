// LanguageSwitcher.tsx - Dropdown selector for app interface language
import { Select } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  return (
    <Select
      size="xs"
      h="28px"
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      width="full"
      variant="filled"
      borderRadius="none"
      aria-label={t('settings.language')}
      _focus={{ boxShadow: 'none' }}
    >
      <option value="en">{t('settings.languages.en')}</option>
      <option value="zh-CN">{t('settings.languages.zh-CN')}</option>
      <option value="zh-TW">{t('settings.languages.zh-TW')}</option>
      <option value="es">{t('settings.languages.es')}</option>
      <option value="ja">{t('settings.languages.ja')}</option>
      <option value="fr">{t('settings.languages.fr')}</option>
    </Select>
  );
};
