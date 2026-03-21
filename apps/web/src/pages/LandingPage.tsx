// LandingPage.tsx — Landing page with file upload, drag-drop, paste text, and the shared grouped demo picker.
// Adapts to light/dark color mode via useColorModeValue for all surface and text colors, and includes a theme toggle.
import {
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Image,
  Select,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useColorMode,
  useDisclosure,
} from '@chakra-ui/react';
import { DocumentArrowUpIcon, SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import type { ParseResult } from '@keymap-highlight/file-parsers';
import { DemoPresetPicker } from '../components/DemoPresetPicker/DemoPresetPicker';
import { LanguageSwitcher } from '../components/Settings/LanguageSwitcher';
import { PROJECT_CONFIG } from '../constants/project';
import { useConfigParser } from '../hooks/useConfigParser';
import { FileUploader } from '../components/Uploader/FileUploader';
import { useKeymapStore } from '../store/useKeymapStore';

const SUPPORTED_EDITORS = [
  { value: 'vscode', labelKey: 'parsers.vscode', hint: 'keybindings.json' },
  { value: 'jetbrains', labelKey: 'parsers.jetbrains', hint: 'keymap.xml' },
  { value: 'vim', labelKey: 'parsers.vim', hint: '.vimrc' },
  { value: 'neovim', labelKey: 'parsers.neovim', hint: 'init.lua' },
  { value: 'zed', labelKey: 'parsers.zed', hint: 'keymap.json' },
  { value: 'nano', labelKey: 'parsers.nano', hint: '.nanorc' },
  { value: 'krita', labelKey: 'parsers.krita', hint: '.shortcuts' },
  { value: 'illustrator', labelKey: 'parsers.illustrator', hint: 'Defaults.txt' },
  { value: 'blender', labelKey: 'parsers.blender', hint: '.py' },
  { value: 'emacs', labelKey: 'parsers.emacs', hint: '.el / .emacs', experimental: true },
];

export function LandingPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { isOpen: isPasteOpen, onToggle: onPasteToggle } = useDisclosure();
  const [rawText, setRawText] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<ParseResult['metadata']['sourceEditor']>('vscode');
  const wasParsingRef = useRef(false);
  const parsingStartParsedAtRef = useRef<string | null>(null);
  const bindings = useKeymapStore((state) => state.bindings);
  const parsedAt = useKeymapStore((state) => state.parsedMetadata?.parsedAt ?? null);

  const { isParsing, handleLoadDemo, handleUpload } = useConfigParser();
  const { colorMode, toggleColorMode } = useColorMode();

  useEffect(() => {
    if (isParsing) {
      if (!wasParsingRef.current) {
        parsingStartParsedAtRef.current = parsedAt;
      }
      wasParsingRef.current = true;
      return;
    }

    if (!wasParsingRef.current) {
      return;
    }

    wasParsingRef.current = false;

    if (parsedAt !== null && parsedAt !== parsingStartParsedAtRef.current && bindings.length > 0) {
      setLocation('/');
    }
  }, [isParsing, bindings.length, parsedAt, setLocation]);

  const handlePasteSubmit = () => {
    if (!rawText.trim()) return;
    const extMap: Record<string, string> = {
      vscode: 'json',
      jetbrains: 'xml',
      vim: 'vim',
      neovim: 'lua',
      zed: 'json',
      nano: 'nanorc',
      krita: 'shortcuts',
      illustrator: 'txt',
      blender: 'py',
      emacs: 'el',
    };
    const ext = extMap[selectedFormat] || 'txt';
    const filename = `pasted-config.${ext}`;
    handleUpload(rawText, filename, selectedFormat);
    setLocation('/');
  };

  const descriptionColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'whiteAlpha.200');
  const dividerBg = useColorModeValue('gray.200', 'whiteAlpha.200');
  const inputBg = useColorModeValue('gray.50', 'gray.900');
  const inputBorder = useColorModeValue('gray.300', 'whiteAlpha.200');
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const noticeColor = useColorModeValue('orange.700', 'orange.300');
  const githubLogoFilter = useColorModeValue('none', 'invert(1)');

  return (
    <Center h="full" w="full" px={{ base: 6, md: 10 }} py={{ base: 10, md: 14 }}>
      <VStack spacing={8} w="full" maxW="3xl" textAlign="center">
        <VStack spacing={4} w="full">
          <Heading as="h1" size={{ base: 'lg', md: 'xl' }} fontFamily="mono">
            {t('app.name')}
          </Heading>
          <Text color={descriptionColor} fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
            {t('landingPage.description')}
          </Text>
          <Text fontSize={{ base: 'md', md: 'lg' }} color={noticeColor} display={{ base: 'block', md: 'none' }} maxW="2xl">
            {t('mobile.notice')}
          </Text>
        </VStack>

        <Box
          w="full"
          borderWidth="1px"
          borderColor={cardBorder}
          borderRadius="none"
          bg={cardBg}
          p={{ base: 5, md: 6 }}
        >
          <VStack spacing={4} align="stretch">
            <FileUploader onUpload={(content, filename) => {
              handleUpload(content, filename);
              setLocation('/');
            }}>
              <Button
                leftIcon={<DocumentArrowUpIcon width={20} height={20} />}
                size="lg"
                colorScheme="gray"
                w="full"
                borderRadius="none"
                isLoading={isParsing}
                loadingText={t('landingPage.parsing')}
              >
                {t('landingPage.loadConfigFile')}
              </Button>
            </FileUploader>

            <HStack spacing={2} justify="center" flexWrap="wrap">
              {SUPPORTED_EDITORS.map((editor) => (
                <Badge key={editor.value} colorScheme="gray" borderRadius="none" textTransform="none" fontSize="2xs">
                  {editor.experimental ? `(${t('landingPage.experimental')}) ` : ''}
                  {t(editor.labelKey)} <Text as="span" fontFamily="mono" fontSize="sm">
                    {editor.hint}
                  </Text>
                </Badge>
              ))}
            </HStack>

            <Box textAlign="left">
              <Button variant="link" size="sm" colorScheme="gray" onClick={onPasteToggle}>
                {isPasteOpen ? t('landingPage.hidePasteInput') : t('landingPage.pasteRawConfigInstead')}
              </Button>
              <Collapse in={isPasteOpen} animateOpacity>
                <VStack spacing={3} mt={4} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={labelColor}>
                      {t('landingPage.editorFormat')}
                    </FormLabel>
                    <Select
                      size="sm"
                      value={selectedFormat}
                      onChange={(event) =>
                        setSelectedFormat(event.target.value as ParseResult['metadata']['sourceEditor'])
                      }
                      bg={inputBg}
                      borderColor={inputBorder}
                      borderRadius="none"
                    >
                      {SUPPORTED_EDITORS.map((editor) => (
                        <option key={editor.value} value={editor.value}>
                          {t(editor.labelKey)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <Textarea
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    placeholder={t('landingPage.pastePlaceholder')}
                    rows={6}
                    bg={inputBg}
                    borderColor={inputBorder}
                    borderRadius="none"
                  />

                  <Button
                    size="sm"
                    colorScheme="gray"
                    borderRadius="none"
                    onClick={handlePasteSubmit}
                    isDisabled={!rawText.trim() || isParsing}
                  >
                    {t('landingPage.parseContent')}
                  </Button>
                </VStack>
              </Collapse>
            </Box>

            <HStack spacing={3} align="center" justify="center">
              <Box flex="1" h="1px" bg={dividerBg} />
              <Text fontSize="xs" color={labelColor} letterSpacing="wide">{t('landingPage.or')}</Text>
              <Box flex="1" h="1px" bg={dividerBg} />
            </HStack>

            <VStack spacing={2} align="stretch" w="full">
              <Text fontSize="sm" color={labelColor} textAlign="center" fontWeight="medium">
                {t('landingPage.loadDemoDefaultsAndPresets')}
              </Text>
              <DemoPresetPicker
                isLoading={isParsing}
                onLoadPreset={handleLoadDemo}
                columns={{ base: 2, sm: 3, md: 4 }}
                minButtonHeight="40px"
              />
            </VStack>

            <HStack justify="space-between" align="flex-end" w="full" mt={2}>
              <Box>
              <Button
                as="a"
                href={PROJECT_CONFIG.GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="xs"
                    h="28px"
                    borderRadius="none"
                leftIcon={
                  <Image
                    src="https://unpkg.com/@fortawesome/fontawesome-free@6.7.2/svgs/brands/github.svg"
                    boxSize={4}
                    alt="GitHub"
                    filter={githubLogoFilter}
                  />
                }
                aria-label="GitHub"
              >
                GitHub
              </Button>
</Box>
              <Box textAlign="left">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="wide" color={labelColor} mb={1}>
                  {t('settings.themeLang') || 'Theme / Lang'}
                </Text>
                <HStack align="center" spacing={1}>
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
          </VStack>
        </Box>
      </VStack>
    </Center>
  );
}
