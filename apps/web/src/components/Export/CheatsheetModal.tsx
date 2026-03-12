// CheatsheetModal.tsx - Chakra UI modal for reviewing, filtering, and exporting keybindings as PDF or Markdown.
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid';
import {
  exportToMarkdown,
  exportToPdf,
  formatRawCommand,
  type GroupingKind,
} from '@keymap-highlight/cheatsheet-export';
import { formatChordSequence } from '@keymap-highlight/layout-pipeline';
import type { ParseResult } from '@keymap-highlight/file-parsers';
import { useTranslation } from 'react-i18next';
import { useKeymapStore } from '../../store/useKeymapStore';
import { getActionTierForSource, lookupActionNameForSource } from '../../utils/editor-helpers';

type ParsedBinding = ParseResult['bindings'][number];

function getBindingId(binding: ParsedBinding): string {
  return `${binding.key}::${binding.command}::${binding.when}::${binding.sourceEditor}`;
}

interface CheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheatsheetModal({ isOpen, onClose }: CheatsheetModalProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const bindings = useKeymapStore((state) => state.bindings);
  const currentLayout = useKeymapStore((state) => state.currentLayout);
  const os = useKeymapStore((state) => state.os);
  const parsedMetadata = useKeymapStore((state) => state.parsedMetadata);
  const activeContext = useKeymapStore((state) => state.activeContext);
  const inputLayout = useKeymapStore((state) => state.inputLayout);
  const customInputMapping = useKeymapStore((state) => state.customInputMapping);

  const sourceEditor = parsedMetadata?.sourceEditor;

  const deduped = useMemo<ParsedBinding[]>(() => {
    const seen = new Set<string>();
    const result: ParsedBinding[] = [];
    for (const binding of bindings) {
      const id = getBindingId(binding);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(binding);
      }
    }
    result.sort((a, b) => {
      const tierA = getActionTierForSource(sourceEditor, a.command) || 3;
      const tierB = getActionTierForSource(sourceEditor, b.command) || 3;
      if (tierA !== tierB) return tierA - tierB;
      return a.command.localeCompare(b.command);
    });
    return result;
  }, [bindings, sourceEditor]);

  const defaultChecked = useMemo<Set<string>>(() => {
    const checked = new Set<string>();
    for (const binding of deduped) {
      const tier = getActionTierForSource(sourceEditor, binding.command);
      if (tier === 1 || tier === 2) {
        checked.add(getBindingId(binding));
      }
    }
    if (checked.size === 0) {
      for (const binding of deduped.slice(0, 50)) {
        checked.add(getBindingId(binding));
      }
    }
    return checked;
  }, [deduped, sourceEditor]);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(defaultChecked);
  const groupingKind: GroupingKind = 'modifier';
  const [showCommandIds, setShowCommandIds] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const selectedBindings = useMemo(
    () => deduped.filter((b) => checkedIds.has(getBindingId(b))),
    [deduped, checkedIds]
  );

  const toggleBinding = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setCheckedIds(new Set(deduped.map(getBindingId)));
  }, [deduped]);

  const selectNone = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const selectCommon = useCallback(() => {
    setCheckedIds(new Set(defaultChecked));
  }, [defaultChecked]);

  const handleExportPdf = async () => {
    if (selectedBindings.length === 0) {
      toast({
        duration: 2500,
        isClosable: true,
        position: 'bottom',
        render: () => (
          <Alert status="warning" variant="solid" borderRadius="none" boxShadow="md" mb={2} alignItems="start">
            <AlertIcon />
            <Box>
              <AlertTitle>{t('pdf.noBindingsSelected')}</AlertTitle>
              <AlertDescription>{t('pdf.selectAtLeastOne')}</AlertDescription>
            </Box>
          </Alert>
        ),
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      await exportToPdf({
        selectedBindings,
        groupingKind,
        layout: currentLayout,
        os,
        metadata: parsedMetadata,
        activeContext,
        inputLayout,
        customInputMapping,
        t,
        showCommandIds,
        language: i18n.language,
      });
      toast({
        duration: 2200,
        isClosable: true,
        position: 'bottom',
        render: () => (
          <Alert status="success" variant="solid" borderRadius="none" boxShadow="md" mb={2}>
            <AlertIcon />
            <AlertTitle>{t('toast.cheatsheetGenerated')}</AlertTitle>
          </Alert>
        ),
      });
      onClose();
    } catch {
      toast({
        duration: 3000,
        isClosable: true,
        position: 'bottom',
        render: () => (
          <Alert status="error" variant="solid" borderRadius="none" boxShadow="md" mb={2} alignItems="start">
            <AlertIcon />
            <Box>
              <AlertTitle>{t('toast.pdfExportFailedTitle')}</AlertTitle>
              <AlertDescription>{t('toast.pdfExportFailedDescription')}</AlertDescription>
            </Box>
          </Alert>
        ),
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportMarkdown = () => {
    if (selectedBindings.length === 0) {
      toast({
        duration: 2500,
        isClosable: true,
        position: 'bottom',
        render: () => (
          <Alert status="warning" variant="solid" borderRadius="none" boxShadow="md" mb={2} alignItems="start">
            <AlertIcon />
            <Box>
              <AlertTitle>{t('pdf.noBindingsSelected')}</AlertTitle>
              <AlertDescription>{t('pdf.selectAtLeastOne')}</AlertDescription>
            </Box>
          </Alert>
        ),
      });
      return;
    }

    exportToMarkdown({
      selectedBindings,
      groupingKind,
      layout: currentLayout,
      os,
      metadata: parsedMetadata,
      activeContext,
      inputLayout,
      customInputMapping,
      t,
      showCommandIds,
      language: i18n.language,
    });
    toast({
      duration: 2200,
      isClosable: true,
      position: 'bottom',
      render: () => (
        <Alert status="success" variant="solid" borderRadius="none" boxShadow="md" mb={2}>
          <AlertIcon />
          <AlertTitle>{t('pdf.markdownExported')}</AlertTitle>
        </Alert>
      ),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent maxH="85vh" borderRadius="none">
        <ModalHeader fontSize="md" pb={2}>
          {t('pdf.generateCheatsheet')}
        </ModalHeader>
        <ModalCloseButton borderRadius="none" />

        <Flex direction="column" px={6} pb={4} gap={3} overflow="hidden" flex={1}>
          <HStack justify="space-between" flexShrink={0} flexWrap="wrap" gap={2}>
            <HStack spacing={2}>
              <Button size="xs" variant="outline" borderRadius="none" onClick={selectAll}>
                {t('pdf.all')}
              </Button>
              <Button size="xs" variant="outline" borderRadius="none" onClick={selectNone}>
                {t('pdf.none')}
              </Button>
              <Button size="xs" variant="outline" borderRadius="none" onClick={selectCommon}>
                {t('pdf.common')}
              </Button>
              <Text fontSize="xs" color="gray.500">
                {t('pdf.selected', { selected: selectedBindings.length, total: deduped.length })}
              </Text>
            </HStack>
          </HStack>
          
          <HStack spacing={4} px={1} py={1} bg="whiteAlpha.50" borderWidth={1} borderColor="whiteAlpha.100" borderRadius="none">
            <Text fontSize="xs" fontWeight="bold" color="gray.500">{t('pdf.styleOptions', 'Style Options:')}</Text>
            <Checkbox
              size="sm"
              isChecked={showCommandIds}
              onChange={(e) => setShowCommandIds(e.target.checked)}
              borderRadius="none"
            >
              <Text fontSize="xs">{t('pdf.showCommandIds', 'Show Command IDs')}</Text>
            </Checkbox>
          </HStack>

          <Box
            flex={1}
            overflowY="auto"
            borderWidth={1}
            borderRadius="none"
            minH={0}
            sx={{
              scrollbarWidth: 'thin',
            }}
          >
            <VStack spacing={0} align="stretch">
              {deduped.map((binding) => {
                const id = getBindingId(binding);
                const isChecked = checkedIds.has(id);
                const tier = getActionTierForSource(sourceEditor, binding.command);
                const friendlyName = lookupActionNameForSource(binding.sourceEditor, binding.command, i18n.language);
                const isUnmapped = !friendlyName || friendlyName === binding.command;
                
                let displayCommand = binding.command;
                if (!isUnmapped) {
                  displayCommand = showCommandIds ? `${friendlyName} (${binding.command})` : friendlyName;
                } else {
                  displayCommand = formatRawCommand(binding.command);
                  if (showCommandIds && displayCommand !== binding.command) {
                    displayCommand = `${displayCommand} (${binding.command})`;
                  }
                }

                return (
                  <Flex
                    key={id}
                    px={3}
                    py={1.5}
                    align="center"
                    gap={3}
                    borderBottomWidth={1}
                    borderColor="whiteAlpha.100"
                    _last={{ borderBottomWidth: 0 }}
                    _hover={{ bg: 'whiteAlpha.50' }}
                    cursor="pointer"
                    onClick={() => toggleBinding(id)}
                  >
                    <Checkbox
                      isChecked={isChecked}
                      onChange={() => toggleBinding(id)}
                      onClick={(e) => e.stopPropagation()}
                      size="sm"
                      flexShrink={0}
                      borderRadius="none"
                    />
                    <Text
                      fontSize="xs"
                      fontFamily="mono"
                      color="blue.300"
                      minW="120px"
                      flexShrink={0}
                    >
                      {formatChordSequence(binding)}
                    </Text>
                    <Text fontSize="xs" flex={1} noOfLines={1}>
                      {displayCommand}
                    </Text>
                    {tier === 1 && (
                      <Text fontSize="2xs" color="yellow.400" flexShrink={0}>
                        {t('pdf.mostCommonBadge')}
                      </Text>
                    )}
                    {tier === 2 && (
                      <Text fontSize="2xs" color="gray.400" flexShrink={0}>
                        {t('pdf.somewhatCommonBadge')}
                      </Text>
                    )}
                  </Flex>
                );
              })}
            </VStack>
          </Box>

          <HStack justify="flex-end" spacing={2} flexShrink={0} pt={1}>
            <Button
              size="sm"
              variant="outline"
              borderRadius="none"
              leftIcon={<ArrowDownTrayIcon style={{ width: 14, height: 14 }} />}
              onClick={handleExportMarkdown}
              isDisabled={selectedBindings.length === 0}
            >
              {t('pdf.exportMarkdown')}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              borderRadius="none"
              leftIcon={<ArrowDownTrayIcon style={{ width: 14, height: 14 }} />}
              onClick={handleExportPdf}
              isLoading={isExportingPdf}
              isDisabled={selectedBindings.length === 0}
            >
              {t('pdf.exportPdf')}
            </Button>
          </HStack>
        </Flex>
      </ModalContent>
    </Modal>
  );
}

export default CheatsheetModal;
