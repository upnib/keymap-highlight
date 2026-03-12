// BindingList - searchable, sortable, groupable, and filterable list of parsed keybindings.
// Includes conflict filtering. Primary view on small screens where the Konva canvas is hidden.
// Uses a strict flex/min-height/overflow chain so the virtualized list stays within the available sidebar viewport.
// Conflict identity uses getConflictIdentity from binding-display for consistency with store/canvas.
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Badge,
  Box,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  StarIcon,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ParseResult } from '@keymap-highlight/file-parsers';
import {
  createBindingSignature,
  contextMatches,
  formatBindingModifierLabels,
  getActiveInputMapping,
  getConflictIdentity,
  resolveBindingDisplayKey,
} from '@keymap-highlight/layout-pipeline';
import { useKeymapStore } from '../../store/useKeymapStore';
import { getActionTierForSource, lookupActionNameForSource } from '../../utils/editor-helpers';

type ParsedBinding = ParseResult['bindings'][number];

type SortField = 'key' | 'command' | 'modifier';
type SortDirection = 'asc' | 'desc';

interface BindingGroup {
  label: string;
  bindings: ParsedBinding[];
}

const MODIFIER_FILTER_KEYS = new Set(['ctrl', 'shift', 'alt', 'meta', 'fn', 'menu']);

const formatModifiers = (binding: ParsedBinding, os: 'win' | 'mac' | 'linux'): string => {
  const displayModifiers = formatBindingModifierLabels(binding.modifiers, os);
  if (displayModifiers.length === 0) {
    return 'No Modifier';
  }

  return displayModifiers.join(' + ');
};

const groupByModifier = (bindings: ParsedBinding[], os: 'win' | 'mac' | 'linux'): BindingGroup[] => {
  const groups = new Map<string, ParsedBinding[]>();

  for (const binding of bindings) {
    const label = formatModifiers(binding, os);
    const existing = groups.get(label);
    if (existing) {
      existing.push(binding);
    } else {
      groups.set(label, [binding]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === 'No Modifier') return -1;
      if (b === 'No Modifier') return 1;
      return a.localeCompare(b);
    })
    .map(([label, items]) => ({ label, bindings: items }));
};

const groupByContext = (bindings: ParsedBinding[]): BindingGroup[] => {
  const groups = new Map<string, ParsedBinding[]>();

  for (const binding of bindings) {
    const label = binding.when.trim() || 'Global';
    const existing = groups.get(label);
    if (existing) {
      existing.push(binding);
    } else {
      groups.set(label, [binding]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === 'Global') return -1;
      if (b === 'Global') return 1;
      return a.localeCompare(b);
    })
    .map(([label, items]) => ({ label, bindings: items }));
};

function BindingRow({
  binding,
  isConflict,
  tier,
  modifierLabels,
  displayKey,
  bindingSignature,
  onHoverStart,
  onHoverEnd,
}: {
  binding: ParsedBinding;
  isConflict: boolean;
  tier?: 1 | 2 | null;
  modifierLabels: string[];
  displayKey: string;
  bindingSignature: string;
  onHoverStart: (bindingSignature: string) => void;
  onHoverEnd: () => void;
}) {
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const conflictBorder = 'red.400';
  const conflictBg = useColorModeValue('red.50', 'rgba(254,178,178,0.06)');
  const subtleText = useColorModeValue('gray.500', 'gray.400');
  const { i18n, t } = useTranslation();

  const friendlyName = lookupActionNameForSource(binding.sourceEditor, binding.command, i18n.language);

  return (
    <Box
      borderWidth="1px"
      borderColor={isConflict ? conflictBorder : borderColor}
      borderRadius="none"
      px={3}
      py={2}
      bg={isConflict ? conflictBg : cardBg}
      position="relative"
      data-testid="binding-row"
      onMouseEnter={() => onHoverStart(bindingSignature)}
      onMouseLeave={onHoverEnd}
    >
      <Flex justify="space-between" align="center" gap={2}>
        <Box flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
            {friendlyName || binding.command}
            {tier === 1 && (
              <StarIcon
                style={{ width: 14, height: 14, display: 'inline-block', marginLeft: 6, color: '#ECC94B', verticalAlign: 'text-bottom' }}
                title={t('pdf.mostCommonBadge', 'Most Common')}
              />
            )}
            {tier === 2 && (
              <StarIcon
                style={{ width: 14, height: 14, display: 'inline-block', marginLeft: 6, color: '#A0AEC0', verticalAlign: 'text-bottom' }}
                title={t('pdf.somewhatCommonBadge', 'Somewhat Common')}
              />
            )}
          </Text>
          {friendlyName && (
             <Text fontSize="xs" color={subtleText} fontFamily="mono" noOfLines={1}>
              {binding.command}
            </Text>
          )}
          {binding.when ? (
            <Text fontSize="xs" color={subtleText} noOfLines={1}>
              {t('bindingList.when')}: {binding.when}
            </Text>
          ) : null}
        </Box>
        <HStack spacing={1} flexShrink={0} flexWrap="wrap" justify="flex-end" maxW="45%">
          {modifierLabels.map((modifierLabel) => (
            <Badge
              key={`${binding.command}-${modifierLabel}`}
              fontSize="2xs"
              colorScheme="gray"
              variant="subtle"
              borderRadius="none"
            >
              {modifierLabel}
            </Badge>
          ))}
          <Badge fontSize="xs" colorScheme="gray" variant="outline" fontFamily="mono" borderRadius="none">
            {displayKey}
          </Badge>
        </HStack>
      </Flex>
      {isConflict ? (
        <HStack spacing={1} mt={1}>
          <ExclamationTriangleIcon style={{ width: 12, height: 12, color: '#fc8181' }} />
          <Text fontSize="2xs" color="red.400" fontWeight="medium">
            {t('bindingList.conflictDetected')}
          </Text>
        </HStack>
      ) : null}
    </Box>
  );
}

export function BindingList() {
  const { t } = useTranslation();
  const bindings = useKeymapStore((state) => state.bindings);
  const conflicts = useKeymapStore((state) => state.conflicts);
  const os = useKeymapStore((state) => state.os);
  const selectedKey = useKeymapStore((state) => state.selectedKey);
  const setSelectedKey = useKeymapStore((state) => state.setSelectedKey);
  const activeContext = useKeymapStore((state) => state.activeContext);
  const setActiveContext = useKeymapStore((state) => state.setActiveContext);
  const inputLayout = useKeymapStore((state) => state.inputLayout);
  const customInputMapping = useKeymapStore((state) => state.customInputMapping);
  const setHoveredBindingSignature = useKeymapStore((state) => state.setHoveredBindingSignature);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isStale = searchQuery !== deferredSearchQuery;
  const [sortField, setSortField] = useState<SortField>('modifier');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupMode, setGroupMode] = useState<'modifier' | 'context'>('modifier');
  const [filterTier, setFilterTier] = useState<'all' | '1' | '2' | 'conflict'>('all');
  const isGlobalContext = activeContext.trim().toLowerCase() === 'global';

  const inputBg = useColorModeValue('white', 'gray.700');
  const groupHeaderBg = useColorModeValue('gray.100', 'gray.800');
  const subtleText = useColorModeValue('gray.500', 'gray.400');
  const filterBorderColor = useColorModeValue('gray.300', 'whiteAlpha.200');

  const conflictKeys = useMemo(
    () => new Set(conflicts.map((b) => getConflictIdentity(b))),
    [conflicts],
  );

  const activeInputMapping = useMemo(
    () => getActiveInputMapping(inputLayout, customInputMapping),
    [inputLayout, customInputMapping],
  );

  const getBindingDisplayKey = useCallback(
    (binding: ParsedBinding) =>
      resolveBindingDisplayKey(binding.key, os, activeInputMapping)
      ?? binding.key.split('+').pop()?.trim().toUpperCase()
      ?? binding.key,
    [activeInputMapping, os],
  );

  const keyFilteredBindings = useMemo(() => {
    let result = bindings;
    if (!isGlobalContext) {
      result = result.filter((b) => contextMatches(b.when, activeContext));
    }
    if (selectedKey) {
      const isModifierFilter = MODIFIER_FILTER_KEYS.has(selectedKey);

      result = result.filter((b) => {
        const displayKey = getBindingDisplayKey(b);
        if (displayKey === selectedKey) {
          return true;
        }

        if (!isModifierFilter) {
          return false;
        }

        return b.modifiers.includes(selectedKey);
      });
    }
    if (filterTier !== 'all') {
      if (filterTier === 'conflict') {
        result = result.filter((b) => conflictKeys.has(getConflictIdentity(b)));
      } else {
        result = result.filter((b) => {
          const tier = getActionTierForSource(b.sourceEditor, b.command);
          if (filterTier === '1') return tier === 1;
          if (filterTier === '2') return tier === 1 || tier === 2;
          return false;
        });
      }
    }
    return result;
  }, [bindings, activeContext, selectedKey, filterTier, conflictKeys, getBindingDisplayKey, isGlobalContext]);

  const filteredBindings = useMemo(() => {
    if (!deferredSearchQuery.trim()) return keyFilteredBindings;
    const query = deferredSearchQuery.toLowerCase();
    return keyFilteredBindings.filter(
      (b) =>
        b.command.toLowerCase().includes(query) ||
        b.key.toLowerCase().includes(query) ||
        getBindingDisplayKey(b).toLowerCase().includes(query) ||
        b.when.toLowerCase().includes(query) ||
        b.modifiers.some((m) => m.toLowerCase().includes(query)) ||
        formatModifiers(b, os).toLowerCase().includes(query),
    );
  }, [deferredSearchQuery, getBindingDisplayKey, keyFilteredBindings, os]);

  const filteredConflictsCount = useMemo(() => {
    return filteredBindings.filter((b) => conflictKeys.has(getConflictIdentity(b))).length;
  }, [filteredBindings, conflictKeys]);

  const sortedBindings = useMemo(() => {
    const sorted = [...filteredBindings];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      // Always sort by tier first (tier 1 > tier 2 > null)
      const tierA = getActionTierForSource(a.sourceEditor, a.command) || 3;
      const tierB = getActionTierForSource(b.sourceEditor, b.command) || 3;
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      switch (sortField) {
        case 'key':
          return getBindingDisplayKey(a).localeCompare(getBindingDisplayKey(b)) * dir;
        case 'command':
          return a.command.localeCompare(b.command) * dir;
        case 'modifier':
          return formatModifiers(a, os).localeCompare(formatModifiers(b, os)) * dir;
        default:
          return 0;
      }
    });

    return sorted;
  }, [filteredBindings, getBindingDisplayKey, os, sortField, sortDirection]);

  const groups = useMemo(
    () =>
      groupMode === 'modifier'
        ? groupByModifier(sortedBindings, os)
        : groupByContext(sortedBindings),
    [groupMode, os, sortedBindings],
  );

  const listContainerRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo(() => {
    const items: Array<{ type: 'header'; label: string } | { type: 'row'; binding: ParsedBinding }> = [];
    for (const group of groups) {
      items.push({ type: 'header', label: group.label });
      for (const binding of group.bindings) {
        items.push({ type: 'row', binding });
      }
    }
    return items;
  }, [groups]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (item.type === 'header') return 32;
      const isConflict = conflictKeys.has(getConflictIdentity(item.binding));
      return isConflict ? 84 : 64;
    },
    overscan: 8,
  });

  const toggleSortDirection = () =>
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  const getGroupLabel = (label: string) => {
    if (label === 'No Modifier') {
      return t('bindingList.noModifier');
    }
    if (label === 'Global') {
      return t('bindingList.global');
    }
    return label;
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearchQuery(e.currentTarget.value);

  const handleBindingHoverStart = useCallback(
    (bindingSignature: string) => {
      setHoveredBindingSignature(bindingSignature);
    },
    [setHoveredBindingSignature],
  );

  const handleBindingHoverEnd = useCallback(() => {
    setHoveredBindingSignature(null);
  }, [setHoveredBindingSignature]);

  if (bindings.length === 0) {
    return (
      <Box px={4} py={8} textAlign="center">
        <Text fontSize="sm" color="gray.500" fontStyle="italic">
          {t('bindingList.emptyState')}
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={2} align="stretch" data-testid="mobile-list" flex="1" h="100%" minH={0} overflow="hidden">
      {(selectedKey || !isGlobalContext) && (
        <VStack spacing={0} align="stretch">
          {selectedKey && (
            <Flex
              align="center"
              gap={2}
              px={2}
              py={1}
              bg={groupHeaderBg}
              borderWidth="1px"
              borderColor={filterBorderColor}
            >
              <HStack spacing={1} flex="1">
                <Text fontSize="xs" fontWeight="medium">
                  {t('sidebar.filteredBy')}:
                </Text>
                <Badge
                  fontSize="xs"
                  colorScheme="gray"
                  variant="outline"
                  fontFamily="mono"
                  borderRadius="none"
                >
                  {selectedKey}
                </Badge>
              </HStack>
              <IconButton
                aria-label={t('sidebar.clearFilter')}
                icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
                size="xs"
                variant="ghost"
                borderRadius="none"
                onClick={() => setSelectedKey(null)}
              />
            </Flex>
          )}
          {!isGlobalContext && (
            <Flex
              align="center"
              gap={2}
              px={2}
              py={1}
              bg={groupHeaderBg}
              borderWidth="1px"
              borderColor={filterBorderColor}
              borderTopWidth={selectedKey ? 0 : '1px'}
            >
              <HStack spacing={1} flex="1">
                <Text fontSize="xs" fontWeight="medium">
                  {t('sidebar.filteredBy')}:
                </Text>
                <Badge
                  fontSize="xs"
                  colorScheme="blue"
                  variant="outline"
                  fontFamily="mono"
                  borderRadius="none"
                  textTransform="none"
                >
                  {activeContext}
                </Badge>
              </HStack>
              <IconButton
                aria-label={t('sidebar.clearFilter')}
                icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
                size="xs"
                variant="ghost"
                borderRadius="none"
                onClick={() => setActiveContext('Global')}
              />
            </Flex>
          )}
        </VStack>
      )}
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <MagnifyingGlassIcon style={{ width: 16, height: 16, color: '#9ca3af' }} />
        </InputLeftElement>
        <Input
          placeholder={t('bindingList.searchPlaceholder')}
          value={searchQuery}
          onChange={handleSearchChange}
          bg={inputBg}
          borderRadius="none"
          data-testid="mobile-list-search"
          opacity={isStale ? 0.7 : 1}
        />
      </InputGroup>

      <Flex gap={2} align="center">
        <Select
          size="xs"
          value={groupMode}
          onChange={(e) => setGroupMode(e.currentTarget.value as 'modifier' | 'context')}
          flex="1"
          borderRadius="none"
          aria-label={t('bindingList.groupBy')}
        >
          <option value="modifier">{t('bindingList.groupModifier')}</option>
          <option value="context">{t('bindingList.groupContext')}</option>
        </Select>
        <Select
          size="xs"
          value={sortField}
          onChange={(e) => setSortField(e.currentTarget.value as SortField)}
          flex="1"
          borderRadius="none"
          aria-label={t('bindingList.sortBy')}
        >
          <option value="modifier">{t('bindingList.sortModifier')}</option>
          <option value="key">{t('bindingList.sortKey')}</option>
          <option value="command">{t('bindingList.sortCommand')}</option>
        </Select>
        <Select
          size="xs"
          value={filterTier}
          onChange={(e) => setFilterTier(e.currentTarget.value as 'all' | '1' | '2' | 'conflict')}
          flex="1"
          borderRadius="none"
          aria-label={t('bindingList.filterBy', 'Filter By')}
        >
          <option value="all">{t('bindingList.filterAll', 'Filter: All')}</option>
          <option value="1">{t('bindingList.filterTier1', 'Filter: Most Common')}</option>
          <option value="2">{t('bindingList.filterTier2', 'Filter: Somewhat Common')}</option>
          <option value="conflict">{t('bindingList.filterConflict', 'Filter: Conflicts')}</option>
        </Select>
        <IconButton
          aria-label={t('bindingList.toggleSortDirection')}
          icon={
            sortDirection === 'asc' ? (
              <ChevronUpIcon style={{ width: 16, height: 16 }} />
            ) : (
              <ChevronDownIcon style={{ width: 16, height: 16 }} />
            )
          }
          size="xs"
          variant="ghost"
          borderRadius="none"
          onClick={toggleSortDirection}
        />
      </Flex>

      <Flex gap={2} align="center" justify="flex-end" px={1}>
        <Text fontSize="xs" color={subtleText}>
          {t('bindingList.bindingCount', { count: filteredBindings.length })}
          {searchQuery ? ` ${t('bindingList.matchingQuery', { query: searchQuery })}` : ''}
          {filteredConflictsCount > 0 ? ` · ${t('bindingList.conflictCount', { count: filteredConflictsCount })}` : ''}
        </Text>
      </Flex>

      <Box ref={listContainerRef} className="kh-scrollbar" flex="1" minH={0} overflowY="auto" overflowX="hidden" w="100%">
        <Box height={`${virtualizer.getTotalSize()}px`} position="relative" w="100%">
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = flatItems[virtualItem.index];
            return (
              <Box
                key={virtualItem.key}
                position="absolute"
                top={0}
                left={0}
                width="100%"
                transform={`translateY(${virtualItem.start}px)`}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
              >
                {item.type === 'header' ? (
                  <Box pb={2}>
                    <Box bg={groupHeaderBg} px={3} py={1.5} borderRadius="none">
                      <Flex justify="space-between" align="center">
                        <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                          {getGroupLabel(item.label)}
                        </Text>
                      </Flex>
                    </Box>
                  </Box>
                ) : (
                  <BindingRow
                    binding={item.binding}
                    isConflict={conflictKeys.has(getConflictIdentity(item.binding))}
                    tier={getActionTierForSource(item.binding.sourceEditor, item.binding.command)}
                    modifierLabels={formatBindingModifierLabels(item.binding.modifiers, os)}
                    displayKey={getBindingDisplayKey(item.binding)}
                    bindingSignature={createBindingSignature(item.binding)}
                    onHoverStart={handleBindingHoverStart}
                    onHoverEnd={handleBindingHoverEnd}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </VStack>
  );
}

export default memo(BindingList);
