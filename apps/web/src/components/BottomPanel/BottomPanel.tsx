// BottomPanel.tsx - Compact command dock for settings, uploads, and export controls.
// Keeps frequently used actions near the canvas while routing demo loading through a centered shared picker overlay.
import { Suspense, lazy, useState } from 'react';
import { Box, Button, HStack, Text, Tooltip, VStack, useColorModeValue, useColorMode, Flex } from '@chakra-ui/react';
import { ArrowsRightLeftIcon, ArrowDownTrayIcon, DocumentArrowUpIcon, MoonIcon, SunIcon, ArrowLeftStartOnRectangleIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import type { ConfigParserControls } from '../../hooks/useConfigParser';
import { useKeymapStore } from '../../store/useKeymapStore';
import { FileUploader } from '../Uploader/FileUploader';
import { ContextTabs } from '../ContextTabs/ContextTabs';
import { DemoPresetModal } from '../DemoPresetPicker/DemoPresetModal';
import { LanguageSwitcher } from '../Settings/LanguageSwitcher';
import { InputLayoutSelector } from '../Settings/InputLayoutSelector';
import { LayoutSelector } from '../Settings/LayoutSelector';
import { OsToggle } from '../Settings/OsToggle';
import { PROJECT_CONFIG } from '../../constants/project';

const CheatsheetModal = lazy(() => import('../Export/CheatsheetModal').then(module => ({ default: module.CheatsheetModal })));

type BottomPanelProps = {
  parser: ConfigParserControls;
};

export function BottomPanel({ parser }: BottomPanelProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false);
  const [isDemoPresetModalOpen, setIsDemoPresetModalOpen] = useState(false);
  const uploadedFilename = useKeymapStore((state) => state.uploadedFilename);
  const uploadedFormat = useKeymapStore((state) => state.uploadedFormat);
  const uploadedOs = useKeymapStore((state) => state.uploadedOs);
  const toggleSidebarPosition = useKeymapStore((state) => state.toggleSidebarPosition);
  const setParseResult = useKeymapStore((state) => state.setParseResult);
  const setRawConfig = useKeymapStore((state) => state.setRawConfig);
  const setParsedOs = useKeymapStore((state) => state.setParsedOs);
  const setUploadedConfig = useKeymapStore((state) => state.setUploadedConfig);

  const sectionBorder = useColorModeValue('gray.300', 'whiteAlpha.300');
  const metaColor = useColorModeValue('gray.600', 'gray.400');
  const noticeColor = useColorModeValue('orange.700', 'orange.300');
  const { colorMode, toggleColorMode } = useColorMode();

  const { isParsing, handleLoadDemo, handleUpload } = parser;

  const handleBackToIndex = () => {
    setParseResult(null);
    setRawConfig(null);
    setParsedOs(null);
    setUploadedConfig(null, null, null);
    setLocation('/index');
  };

  const statusNotices: string[] = [];
  if (uploadedFilename && uploadedFormat === 'unknown') {
    statusNotices.push(t('bottomPanel.loadedConfigEditorUnknown'));
  }
  if (uploadedFilename && uploadedOs === 'unknown') {
    statusNotices.push(t('bottomPanel.loadedConfigOsUnspecified'));
  }

  return (
    <>
      <VStack spacing={0} h="full" w="full" align="stretch">
        <Box px={2} py={0} borderBottom="1px" borderColor={sectionBorder} h="33px" flexShrink={0}>
          <ContextTabs />
        </Box>
        <Flex
          flex="1"
          px={3}
          py={2}
          overflow="auto"
          align={{ base: 'stretch', md: 'flex-start' }}
          justify={{ base: 'flex-start', md: 'space-between' }}
          gap={{ base: 2, md: 3 }}
          wrap="wrap"
          alignContent="flex-start"
          sx={{
            scrollbarWidth: 'none',
            '::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <HStack spacing={3} align="flex-start" flexShrink={0} wrap="wrap" gap={3}>
            <Box>
              <Text fontSize="2xs" mb={0.5} color={metaColor} textTransform="uppercase">{t('settings.os') || 'OS'}</Text>
              <OsToggle />
            </Box>
            <Box>
              <Text fontSize="2xs" mb={0.5} color={metaColor} textTransform="uppercase">{t('settings.layout') || 'Layout'}</Text>
              <LayoutSelector />
            </Box>
            <Box>
              <Text fontSize="2xs" mb={0.5} color={metaColor} textTransform="uppercase">{t('settings.inputLayout') || 'Input'}</Text>
              <InputLayoutSelector />
            </Box>
            <Box>
              <Text fontSize="2xs" mb={0.5} color={metaColor} textTransform="uppercase">{t('settings.themeLang') || 'Theme / Lang'}</Text>
              <HStack align="center" spacing={1} minW="180px">
                <Button
                  flex={1}
                  leftIcon={colorMode === 'dark' ? <SunIcon style={{ width: 14 }} /> : <MoonIcon style={{ width: 14 }} />}
                  variant="outline"
                  onClick={toggleColorMode}
                  size="xs"
                  h="28px"
                  borderRadius="none"
                  aria-label={colorMode === 'dark' ? t('app.switchToLightMode') : t('app.switchToDarkMode')}
                >
                  {colorMode === 'dark' ? t('app.themeLight') : t('app.themeDark')}
                </Button>
                <Box width="100px">
                  <LanguageSwitcher />
                </Box>
              </HStack>
            </Box>
          </HStack>

          <Box flexShrink={0} minW={0}>
            <Text
              fontSize="2xs"
              mb={0.5}
              lineHeight="short"
              visibility="hidden"
              userSelect="none"
              aria-hidden="true"
            >
              &nbsp;
            </Text>
            <Flex align="center" justify="flex-end" gap={3} wrap="wrap">
              {statusNotices.length > 0 && (
                <Text
                  fontSize="2xs"
                  color={noticeColor}
                  fontFamily="mono"
                  letterSpacing="tight"
                  lineHeight="short"
                  textAlign={{ base: 'left', md: 'right' }}
                  maxW={{ base: '100%', md: '360px' }}
                >
                  {statusNotices.join(' · ')}
                </Text>
              )}
              <Text
                fontSize="2xs"
                color={metaColor}
                fontFamily="mono"
                letterSpacing="tight"
                lineHeight="short"
                whiteSpace="nowrap"
              >
                v{PROJECT_CONFIG.APP_VERSION}
              </Text>
              <HStack spacing={1} align="center">
                <FileUploader onUpload={handleUpload}>
                  <Tooltip label={t('sidebar.loadTooltip')} hasArrow placement="top">
                    <Button
                      variant="outline"
                      isLoading={isParsing}
                      size="xs"
                      w="28px"
                      h="28px"
                      p={0}
                      borderRadius="none"
                      aria-label={t('sidebar.loadTooltip')}
                    >
                      <DocumentArrowUpIcon style={{ width: 14, height: 14 }} />
                    </Button>
                  </Tooltip>
                </FileUploader>

                <Button
                  variant="outline"
                  isDisabled={isParsing}
                  size="xs"
                  h="28px"
                  borderRadius="none"
                  onClick={() => setIsDemoPresetModalOpen(true)}
                >
                  {t('sidebar.loadDemo')}
                </Button>

                <Tooltip label={t('pdf.generateCheatsheet')} hasArrow placement="top-end">
                  <Button
                    variant="outline"
                    size="xs"
                    w="28px"
                    h="28px"
                    p={0}
                    borderRadius="none"
                    aria-label={t('pdf.generateCheatsheet')}
                    onClick={() => setIsCheatsheetOpen(true)}
                  >
                    <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
                  </Button>
                </Tooltip>

                <Tooltip label={t('settings.toggleSidebarTooltip')} hasArrow placement="top-end">
                  <Button
                    variant="outline"
                    size="xs"
                    w="28px"
                    h="28px"
                    p={0}
                    borderRadius="none"
                    onClick={toggleSidebarPosition}
                    aria-label={t('settings.toggleSidebarTooltip')}
                  >
                    <ArrowsRightLeftIcon style={{ width: 14, height: 14 }} />
                  </Button>
                </Tooltip>

                <Tooltip label={t('app.backToIndex')} hasArrow placement="top-end">
                  <Button
                    variant="outline"
                    size="xs"
                    w="28px"
                    h="28px"
                    p={0}
                    borderRadius="none"
                    colorScheme="red"
                    onClick={handleBackToIndex}
                    aria-label={t('app.backToIndex')}
                  >
                    <ArrowLeftStartOnRectangleIcon style={{ width: 14, height: 14 }} />
                  </Button>
                </Tooltip>
              </HStack>
            </Flex>
          </Box>
        </Flex>
      </VStack>

      <Suspense fallback={null}>
        {isCheatsheetOpen && <CheatsheetModal isOpen={isCheatsheetOpen} onClose={() => setIsCheatsheetOpen(false)} />}
      </Suspense>
      <DemoPresetModal
        isOpen={isDemoPresetModalOpen}
        isLoading={isParsing}
        onClose={() => setIsDemoPresetModalOpen(false)}
        onLoadPreset={handleLoadDemo}
      />
    </>
  );
}
