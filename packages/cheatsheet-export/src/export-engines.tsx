// export-engines.tsx - Shared cheatsheet PDF/Markdown export engines extracted from the web app.
// Layout contract: every visible row (header + binding) is an exact multiple of BASE_ROW_HEIGHT.
// The page usable height is also snapped to a multiple of BASE_ROW_HEIGHT so the bottom margin
// stays perfectly aligned across all pages.
// Line break behavior: CJK text uses zero-width space (no dashes). Latin text breaks at word
// boundaries only (no intra-word hyphens). Modifiers/shortcuts use overflow-wrap to prevent clipping.
// Text truncation is disabled - all content renders with proper line expansion.
import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { getActionTier, lookupActionName, type ParseResult } from '@keymap-highlight/file-parsers';
import {
  formatBindingModifierLabels,
  getActiveInputMapping,
  resolveBindingDisplayKey,
  type InputLayoutMapping,
  type InputLayoutType,
  type LayoutKey,
  type SupportedOs,
} from '@keymap-highlight/layout-pipeline';
import type { TFunction } from 'i18next';

type ParsedBinding = ParseResult['bindings'][number];
type ParsedMetadata = ParseResult['metadata'];

export type GroupingKind = 'mode' | 'modifier';

export type ExportCheatsheetOptions = {
  selectedBindings: ParsedBinding[];
  groupingKind: GroupingKind;
  layout: LayoutKey;
  os: SupportedOs;
  metadata: ParsedMetadata | null;
  activeContext: string;
  inputLayout: InputLayoutType;
  customInputMapping: InputLayoutMapping;
  t: TFunction;
  showCommandIds?: boolean;
  language?: string;
};

type VisualOptions = {
  inputLayout: InputLayoutType;
  customInputMapping: InputLayoutMapping;
};

export interface BindingGroup {
  name: string;
  bindings: ParsedBinding[];
}

interface CheatSheetDocumentProps {
  layout?: LayoutKey;
  os: SupportedOs;
  metadata: ParsedMetadata | null;
  activeContext: string;
  groupingKind: GroupingKind;
  groups: BindingGroup[];
  visualOptions: VisualOptions;
  t: TFunction;
  showCommandIds: boolean;
  language: string;
}

interface PageData {
  columns: BindingGroup[][];
}

interface PdfMetaItem {
  label: string;
  value: string;
}

const FONTS: Record<string, string> = {
  zh: 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
  'zh-TW': 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf',
  ja: 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf',
};

let cjkFontRegistered = false;

Font.registerHyphenationCallback((word) => [word]);

const printStyles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#444444',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
    fontSize: 8,
    color: '#444444',
  },
  metaItem: {
    flexDirection: 'row',
    gap: 3,
  },
  metaLabel: {
    color: '#000000',
  },
  sectionLabel: {
    fontSize: 8,
    color: '#666666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    width: '23.5%',
    flexDirection: 'column',
  },
  groupCard: {
    marginBottom: 0,
  },
  groupHeader: {
    backgroundColor: '#F0F0F0',
    color: '#000000',
    paddingHorizontal: 4,
    fontSize: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
  },
  bindingRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CCCCCC',
  },
  keyCell: {
    width: '45%',
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  commandCell: {
    width: '54.5%',
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  commandText: {
    fontSize: 8,
    color: '#000000',
    flexWrap: 'wrap',
  },
  commandIdText: {
    color: '#777777',
  },
  whenText: {
    fontSize: 7,
    color: '#666666',
    marginTop: 1,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 8,
    color: '#444444',
  },
});

export async function ensureFontsRegistered(language: string): Promise<string> {
  const cjkFamily = 'NotoSansCJK';

  let src = '';
  const langLower = language.toLowerCase();
  if (langLower.startsWith('zh-tw') || langLower.startsWith('zh-hk')) {
    src = FONTS['zh-TW'];
  } else if (langLower.startsWith('zh')) {
    src = FONTS.zh;
  } else if (langLower.startsWith('ja')) {
    src = FONTS.ja;
  }

  if (!src) return 'Helvetica';
  if (cjkFontRegistered) return cjkFamily;

  try {
    Font.register({
      family: cjkFamily,
      src,
    });
    cjkFontRegistered = true;
    return cjkFamily;
  } catch {
    return 'Helvetica';
  }
}

export function formatRawCommand(commandId: string): string {
  if (!commandId) return '';
  const baseName = commandId.split('.').pop() || commandId;
  const formatted = baseName
    .replace(/[-_]/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getVisualDisplayKey(
  key: string,
  os: SupportedOs,
  visualOptions: VisualOptions,
): string {
  const inputMapping = getActiveInputMapping(visualOptions.inputLayout, visualOptions.customInputMapping);
  const displayKey = resolveBindingDisplayKey(key, os, inputMapping);
  if (displayKey) return displayKey;
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

function getVisualSequenceString(
  binding: ParsedBinding,
  os: SupportedOs,
  visualOptions: VisualOptions,
): string {
  const formatStroke = (key: string, modifiers: string[]) => {
    const labels = formatBindingModifierLabels(modifiers, os);
    const displayKey = getVisualDisplayKey(key, os, visualOptions);
    return [...labels, displayKey].join('+');
  };

  const primary = formatStroke(binding.key, binding.modifiers);
  if (!binding.chords || binding.chords.length === 0) return primary;
  const chords = binding.chords.map((chord) => formatStroke(chord.key, chord.modifiers));
  return [primary, ...chords].join(' → ');
}

function normalizeModeGroup(binding: ParsedBinding): string {
  const when = binding.when.trim();
  return when.length > 0 ? when : 'Global';
}

function normalizeModifierGroup(binding: ParsedBinding, os: SupportedOs): string {
  const modifiers = binding.modifiers || [];
  if (modifiers.length === 0) return 'No Modifier';
  const labels = formatBindingModifierLabels(modifiers, os);
  return labels.length > 0 ? labels[0] : 'No Modifier';
}

function sortBindings(a: ParsedBinding, b: ParsedBinding): number {
  const tierA = getActionTier(a.sourceEditor as Parameters<typeof getActionTier>[0], a.command) || 3;
  const tierB = getActionTier(b.sourceEditor as Parameters<typeof getActionTier>[0], b.command) || 3;
  if (tierA !== tierB) return tierA - tierB;
  const keySort = a.key.localeCompare(b.key);
  if (keySort !== 0) return keySort;
  return a.command.localeCompare(b.command);
}

export function buildBindingGroups(
  bindings: ParsedBinding[],
  groupingKind: GroupingKind,
  os: SupportedOs = 'win',
): BindingGroup[] {
  const grouped = new Map<string, ParsedBinding[]>();

  for (const binding of bindings) {
    const groupName = groupingKind === 'mode'
      ? normalizeModeGroup(binding)
      : normalizeModifierGroup(binding, os);
    const existing = grouped.get(groupName);
    if (existing) {
      existing.push(binding);
    } else {
      grouped.set(groupName, [binding]);
    }
  }

  return Array.from(grouped.entries())
    .map(([name, group]) => ({ name, bindings: [...group].sort(sortBindings) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getModifierBadgeStyle(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('ctrl') || normalized.includes('control')) {
    return { bg: '#EBF8FF', border: '#BEE3F8', text: '#2B6CB0' };
  }
  if (normalized.includes('shift')) {
    return { bg: '#F0FFF4', border: '#C6F6D5', text: '#2F855A' };
  }
  if (normalized.includes('alt') || normalized.includes('option') || normalized.includes('opt')) {
    return { bg: '#FFF5F5', border: '#FED7D7', text: '#C53030' };
  }
  if (normalized.includes('cmd') || normalized.includes('command') || normalized.includes('meta') || normalized.includes('win') || normalized.includes('super')) {
    return { bg: '#FBF4FF', border: '#D6BCEA', text: '#553C9A' };
  }
  return { bg: '#F7FAFC', border: '#E2E8F0', text: '#4A5568' };
}

function KeySequenceFormatter({
  binding,
  os,
  visualOptions,
  language,
}: {
  binding: ParsedBinding;
  os: SupportedOs;
  visualOptions: VisualOptions;
  language: string;
}) {
  const strokes = [
    { key: binding.key, modifiers: binding.modifiers },
    ...(binding.chords || []),
  ].map((stroke) => ({
    labels: formatBindingModifierLabels(stroke.modifiers, os),
    displayKey: getVisualDisplayKey(stroke.key, os, visualOptions),
  }));

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
      {strokes.map((stroke, strokeIdx) => {
        const strokeKey = `stroke-${stroke.displayKey}-${strokeIdx}`;
        return (
          <View key={strokeKey} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {strokeIdx > 0 && (
              <Text style={{ color: '#888888', fontSize: 8, marginHorizontal: 2 }}>{'->'}</Text>
            )}
            {stroke.labels.map((label, labelIdx) => {
              const labelKey = `mod-${label}-${labelIdx}`;
              const badgeStyle = getModifierBadgeStyle(label);
              return (
                <View key={labelKey} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      backgroundColor: badgeStyle.bg,
                      borderRadius: 1,
                      paddingHorizontal: 2,
                      paddingVertical: 1,
                      borderWidth: 0.5,
                      borderColor: badgeStyle.border,
                    }}
                  >
                    <Text
                      style={{
                        color: badgeStyle.text,
                        fontSize: 7,
                      }}
                    >
                      {applyForcedLineBreaks(label, language)}
                    </Text>
                  </View>
                  <Text style={{ color: '#AAAAAA', fontSize: 8, marginHorizontal: 2 }}>+</Text>
                </View>
              );
            })}
            <Text style={{ color: '#333333', fontSize: 8 }}>{applyForcedLineBreaks(stroke.displayKey, language)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function applyForcedLineBreaks(text: string, _language = 'en'): React.ReactNode[] | string {
  if (!text) return [];

  const isCjkChar = (char: string) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return (
      (codePoint >= 0x3000 && codePoint <= 0x9fff) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xff00 && codePoint <= 0xffef)
    );
  };
  const isLatinLetter = (char: string) => /\p{Script=Latin}/u.test(char);
  const isDigit = (char: string) => /\d/.test(char);
  const isWordBoundary = (curr: string, next: string) => {
    if (curr === ' ') return false;
    if (next === ' ') return false;
    if (/[._\-()\/]/.test(curr) || /[._\-()\/]/.test(next)) return true;
    if (isLatinLetter(curr) && isLatinLetter(next) && curr === curr.toLowerCase() && next === next.toUpperCase()) {
      return true;
    }
    if ((isLatinLetter(curr) && isDigit(next)) || (isDigit(curr) && isLatinLetter(next))) {
      return true;
    }
    return false;
  };

  const result: React.ReactNode[] = [];
  let currentChunk = '';

  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const curr = chars[i];
    const next = chars[i + 1] || '';

    if (curr === '\u200B' || curr === '\u00AD') continue;

    currentChunk += curr;

    if (i < chars.length - 1) {
      if (curr === ' ' || next === ' ') continue;

      const bothLatin = isLatinLetter(curr) && isLatinLetter(next);
      const bothDigit = isDigit(curr) && isDigit(next);

      let shouldBreak = false;

      if (bothLatin) {
        if (isWordBoundary(curr, next)) shouldBreak = true;
      } else if (bothDigit) {
        shouldBreak = false;
      } else if (isCjkChar(curr) || isCjkChar(next)) {
        shouldBreak = true;
      } else if (isWordBoundary(curr, next)) {
        shouldBreak = true;
      } else if (!isLatinLetter(curr) && !isLatinLetter(next) && !isDigit(curr) && !isDigit(next)) {
        shouldBreak = true;
      } else {
        shouldBreak = true;
      }

      if (shouldBreak) {
        result.push(currentChunk);
        // Provide a zero font-size space that textkit natively accepts as a break opportunity
        // without drawing any dashes or taking up physical horizontal width.
        result.push(<Text key={`zwsp-${i}`} style={{ fontSize: 0.1 }}> </Text>);
        currentChunk = '';
      }
    }
  }
  
  if (currentChunk) {
    result.push(currentChunk);
  }

  return result;
}

function getRenderedTextWidth(text: string, fontSize: number): number {
  if (!text) return 0;
  let width = 0;
  for (const char of text) {
    if (char === '\u200B' || char === '\u00AD') continue;
    if (char === ' ') { width += fontSize * 0.28; continue; }

    const codePoint = char.codePointAt(0) ?? 0;
    const isCjk =
      (codePoint >= 0x3000 && codePoint <= 0x9fff) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xff00 && codePoint <= 0xffef);

    if (isCjk) { width += fontSize * 0.96; continue; }
    if (char === 'I' || char === 'i' || char === 'l' || char === 'f' || char === 'j' || char === 'r' || char === 't') { width += fontSize * 0.45; continue; }
    
    if (/[A-Z]/.test(char)) { width += fontSize * 0.8; continue; }
    if (/[0-9]/.test(char)) { width += fontSize * 0.6; continue; }
    if (/[a-z]/.test(char)) { width += fontSize * 0.55; continue; }
    if (/[._\-()/\\]/.test(char)) { width += fontSize * 0.35; continue; }
    width += fontSize * 0.5;
  }
  return width;
}

function estimateTextLineCount(text: string, maxWidth: number, fontSize: number): number {
  if (!text) return 1;

  let lines = 1;
  let currentWidth = 0;

  for (const char of text) {
    const width = getRenderedTextWidth(char, fontSize);
    if (currentWidth > 0 && currentWidth + width > maxWidth) {
      lines += 1;
      currentWidth = width;
    } else {
      currentWidth += width;
    }
  }

  return lines;
}

// Base unit for all row heights — every header, binding row, and gap must be a multiple of this.
const BASE_ROW_HEIGHT = 21;
// Visual gap between consecutive group cards (in rows units, so it stays grid-aligned).
const GROUP_GAP = 0;

function snapUp(value: number): number {
  return Math.ceil(value / BASE_ROW_HEIGHT) * BASE_ROW_HEIGHT;
}

function estimateFirstPageHeaderHeight(metaItems: PdfMetaItem[]): number {
  const PAGE_CONTENT_WIDTH = 842 - 32;
  const META_ITEM_GAP = 10;
  const META_LINE_HEIGHT = 10;
  const META_ROW_GAP = 10;
  const META_MIN_ITEM_WIDTH = 56;
  const META_CHAR_WIDTH = 4.2;
  const BASE_HEADER_HEIGHT = 36;

  let rows = 1;
  let currentRowWidth = 0;

  for (const item of metaItems) {
    const textLen = `${item.label}${item.value}`.length;
    const itemWidth = Math.max(META_MIN_ITEM_WIDTH, textLen * META_CHAR_WIDTH);

    if (currentRowWidth === 0) {
      currentRowWidth = itemWidth;
      continue;
    }

    const nextWidth = currentRowWidth + META_ITEM_GAP + itemWidth;
    if (nextWidth > PAGE_CONTENT_WIDTH) {
      rows += 1;
      currentRowWidth = itemWidth;
    } else {
      currentRowWidth = nextWidth;
    }
  }

  const metaRowHeight = rows * META_LINE_HEIGHT + Math.max(0, rows - 1) * META_ROW_GAP + 10;
  const estimated = BASE_HEADER_HEIGHT + metaRowHeight + 4;
  return Math.min(92, Math.max(58, estimated));
}

function estimateGroupBlockHeight(groupName: string, bindingCount: number): number {
  // Header height: snapped up to a multiple of BASE_ROW_HEIGHT.
  const GROUP_HEADER_CONTENT_WIDTH = 180;
  const GROUP_HEADER_FONT_SIZE = 8;

  const headerText = `${groupName} (${bindingCount})`;
  const headerLines = estimateTextLineCount(headerText, GROUP_HEADER_CONTENT_WIDTH, GROUP_HEADER_FONT_SIZE);
  // Each additional header line adds one BASE_ROW_HEIGHT; minimum is one row.
  return snapUp(headerLines * BASE_ROW_HEIGHT);
}

function estimateRowHeight(
  binding: ParsedBinding,
  showCommandIds: boolean,
  language: string,
  os: SupportedOs,
  visualOptions: VisualOptions,
): number {
  const friendlyName = lookupActionName(binding.sourceEditor, binding.command, language);
  const isUnmapped = !friendlyName || friendlyName === binding.command;

  let displayCommand: string;
  if (!isUnmapped) {
    displayCommand = showCommandIds ? `${friendlyName} (${binding.command})` : friendlyName;
  } else {
    displayCommand = formatRawCommand(binding.command);
  }

  const COMMAND_MAX_WIDTH = 92; // slightly reduced from 96 for safety margin
  const COMMAND_FONT_SIZE = 8;
  const commandLines = estimateTextLineCount(displayCommand, COMMAND_MAX_WIDTH, COMMAND_FONT_SIZE);

  let keyLines = 1;
  let currWidth = 0;
  const MAX_KEY_W = 78; // improved calculation allows closer to actual 79.65

  const strokes = [
    { key: binding.key, modifiers: binding.modifiers },
    ...(binding.chords || []),
  ].map((stroke) => ({
    labels: formatBindingModifierLabels(stroke.modifiers, os),
    displayKey: getVisualDisplayKey(stroke.key, os, visualOptions),
  }));

  strokes.forEach((stroke, strokeIdx) => {
    if (strokeIdx > 0) {
      const arrowW = 11; // '->' string (~6.8) + margin (4) = ~10.8, padded to 11
      if (currWidth + arrowW > MAX_KEY_W && currWidth > 0) {
        keyLines += 1;
        currWidth = arrowW;
      } else {
        currWidth += arrowW;
      }
    }

    stroke.labels.forEach((label: string) => {
      // Font size 7 for badge text, plus 4px padding and 1px border.
      const textW = getRenderedTextWidth(label, 7);
      const badgeW = textW + 6;
      const plusW = 8; // '+' is font 8 (~4.6) + margin 2x2
      const itemW = badgeW + plusW;
      if (currWidth + itemW > MAX_KEY_W && currWidth > 0) {
        keyLines += 1;
        currWidth = itemW;
      } else {
        currWidth += itemW;
      }
    });

    // Main key is font size 8
    const keyTextW = getRenderedTextWidth(stroke.displayKey, 8);
    if (currWidth + keyTextW > MAX_KEY_W && currWidth > 0) {
      keyLines += 1;
      currWidth = keyTextW;
    } else {
      currWidth += keyTextW;
    }
  });

  // Always snap row height up to a multiple of BASE_ROW_HEIGHT.
  const contentLines = Math.max(commandLines, keyLines);
  return snapUp(contentLines * BASE_ROW_HEIGHT);
}

function distributeIntoPagesAndColumns(
  groups: BindingGroup[],
  numColumns: number,
  showCommandIds: boolean,
  language: string,
  os: SupportedOs,
  visualOptions: VisualOptions,
  firstPageHeaderHeight: number,
  continuationSuffix: string,
): PageData[] {
  const A4_LANDSCAPE_HEIGHT = 595;
  const PAGE_VERTICAL_PADDING = 40;

  // Snap usable column height down to an exact multiple of BASE_ROW_HEIGHT so the last row
  // always sits flush against the bottom margin with no fractional-pixel gap.
  const usable1 = A4_LANDSCAPE_HEIGHT - PAGE_VERTICAL_PADDING - firstPageHeaderHeight;
  const usableN = A4_LANDSCAPE_HEIGHT - PAGE_VERTICAL_PADDING;
  const PAGE_1_MAX_HEIGHT = Math.floor(usable1 / BASE_ROW_HEIGHT) * BASE_ROW_HEIGHT;
  const PAGE_N_MAX_HEIGHT = Math.floor(usableN / BASE_ROW_HEIGHT) * BASE_ROW_HEIGHT;

  const pages: PageData[] = [];
  let currentColumns: BindingGroup[][] = [[]];
  let currentHeight = 0;
  let isFirstPage = true;

  function addNewColumn() {
    if (currentColumns.length >= numColumns) {
      pages.push({ columns: currentColumns });
      currentColumns = [[]];
      isFirstPage = false;
    } else {
      currentColumns.push([]);
    }
    currentHeight = 0;
  }

  for (const group of groups) {
    let remainingBindings = [...group.bindings];
    let isContinuation = false;

    while (remainingBindings.length > 0) {
      const maxColHeight = isFirstPage ? PAGE_1_MAX_HEIGHT : PAGE_N_MAX_HEIGHT;
      const headerName = isContinuation ? `${group.name}${continuationSuffix}` : group.name;

      // Gap before this group card (only when the column already has content).
      const gapBefore = currentHeight > 0 ? GROUP_GAP : 0;

      let chunkCount = 0;
      let chunkHeight = 0;

      for (const binding of remainingBindings) {
        const h = estimateRowHeight(binding, showCommandIds, language, os, visualOptions);

        const nextChunkCount = chunkCount + 1;
        const nextChunkHeight = chunkHeight + h;
        const projectedChunkHeight = estimateGroupBlockHeight(headerName, nextChunkCount) + nextChunkHeight;
        const projectedTotalHeight = currentHeight + gapBefore + projectedChunkHeight;

        if (projectedTotalHeight > maxColHeight) {
          if (chunkCount === 0) {
            if (currentHeight > 0) {
              break;
            }
            // Force at least one row even when it is tight.
            chunkCount = 1;
            chunkHeight = h;
          }
          break;
        }

        chunkCount = nextChunkCount;
        chunkHeight = nextChunkHeight;
      }

      if (chunkCount === 0) {
        addNewColumn();
        continue;
      }

      const chunk = remainingBindings.slice(0, chunkCount);
      remainingBindings = remainingBindings.slice(chunkCount);

      const groupChunk: BindingGroup = {
        name: isContinuation ? `${group.name}${continuationSuffix}` : group.name,
        bindings: chunk,
      };

      currentColumns[currentColumns.length - 1].push(groupChunk);
      currentHeight += gapBefore + estimateGroupBlockHeight(groupChunk.name, groupChunk.bindings.length) + chunkHeight;
      isContinuation = true;

      if (remainingBindings.length > 0) {
        addNewColumn();
      }
    }
  }

  if (currentColumns.length > 0 && currentColumns[0].length > 0) {
    while (currentColumns.length < numColumns) {
      currentColumns.push([]);
    }
    pages.push({ columns: currentColumns });
  }

  return pages;
}

function CheatSheetDocument({
  layout: _layout,
  os,
  metadata,
  activeContext,
  groupingKind,
  groups,
  visualOptions,
  t,
  showCommandIds,
  language,
  fontFamily,
}: CheatSheetDocumentProps & { fontFamily: string }) {
  const metaItems: PdfMetaItem[] = [
    { label: t('pdf.summaryOs'), value: os },
    { label: t('pdf.summaryEditor'), value: metadata?.sourceEditor ?? t('pdf.editorUnknown') },
    { label: t('pdf.summaryContext'), value: activeContext || t('common.global') },
  ];

  const firstPageHeaderHeight = estimateFirstPageHeaderHeight(metaItems);
  const continuationSuffix = String(t('pdf.continuationSuffix'));
  const pages = distributeIntoPagesAndColumns(
    groups,
    4,
    showCommandIds,
    language,
    os,
    visualOptions,
    firstPageHeaderHeight,
    continuationSuffix,
  );

  return (
    <Document title={t('pdf.title')} author="Keymap Highlight">
      {pages.map((pageData, pageIndex) => (
        <Page
          key={`page-${pageIndex.toString()}`}
          size="A4"
          orientation="landscape"
          style={{ ...printStyles.page, fontFamily }}
        >
          {pageIndex === 0 && (
            <>
              <Text style={printStyles.title}>{t('pdf.title')}</Text>

              <View style={printStyles.metaRow}>
                {metaItems.map((item) => (
                  <View key={item.label} style={printStyles.metaItem}>
                    <Text style={printStyles.metaLabel}>{item.label}</Text>
                    <Text>{item.value}</Text>
                  </View>
                ))}
              </View>

              <Text style={printStyles.sectionLabel}>
                {t(groupingKind === 'mode' ? 'pdf.groupedByModeContext' : 'pdf.groupedByModifier')}
              </Text>
            </>
          )}

          {groups.length === 0 ? (
            <Text style={printStyles.emptyState}>{t('pdf.noBindings')}</Text>
          ) : (
            <View style={printStyles.columnsContainer}>
              {pageData.columns.map((colGroups, colIndex) => (
                <View key={`col-${colIndex.toString()}`} style={printStyles.column}>
                  {colGroups.map((group, groupIndex) => {
                    const headerHeight = estimateGroupBlockHeight(group.name, group.bindings.length);
                    return (
                      <View
                        key={group.name}
                        style={[printStyles.groupCard, groupIndex > 0 ? { marginTop: GROUP_GAP } : {}]}
                      >
                        <View style={[printStyles.groupHeader, { height: headerHeight }]}>
                          <Text>
                            {applyForcedLineBreaks(`${group.name} (${group.bindings.length})`, language)}
                          </Text>
                        </View>
                        {group.bindings.map((binding, bindingIndex) => {
                          const friendlyName = lookupActionName(binding.sourceEditor, binding.command, language);
                          const isUnmapped = !friendlyName || friendlyName === binding.command;
                          const commandLabel = !isUnmapped && friendlyName ? friendlyName : formatRawCommand(binding.command);
                          const showCommandIdSuffix = showCommandIds && !isUnmapped;
                          const uniqueKey = `${group.name}-${binding.key}-${binding.command}-${binding.when}-${bindingIndex}`;
                          const rowHeight = estimateRowHeight(binding, showCommandIds, language, os, visualOptions);

                          return (
                            <View
                              key={uniqueKey}
                              style={[printStyles.bindingRow, { height: rowHeight }]}
                              wrap={false}
                            >
                              <View style={printStyles.keyCell}>
                                <KeySequenceFormatter binding={binding} os={os} visualOptions={visualOptions} language={language} />
                              </View>
                              <View style={printStyles.commandCell}>
                                <Text style={printStyles.commandText}>
                                  {applyForcedLineBreaks(commandLabel, language)}
                                  {showCommandIdSuffix && <Text style={printStyles.commandIdText}>{applyForcedLineBreaks(` (${binding.command})`, language)}</Text>}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}

function buildPdfFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `keymap-cheat-sheet-${date}.pdf`;
}

function buildMarkdownFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `keymap-cheat-sheet-${date}.md`;
}

export async function exportToPdf(options: ExportCheatsheetOptions): Promise<void> {
  const {
    selectedBindings,
    groupingKind,
    layout,
    os,
    metadata,
    activeContext,
    inputLayout,
    customInputMapping,
    t,
    showCommandIds = true,
    language = 'en',
  } = options;

  const fontFamily = await ensureFontsRegistered(language);
  const groups = buildBindingGroups(selectedBindings, groupingKind, os);

  const doc = (
    <CheatSheetDocument
      layout={layout}
      os={os}
      metadata={metadata}
      activeContext={activeContext}
      groupingKind={groupingKind}
      groups={groups}
      visualOptions={{ inputLayout, customInputMapping }}
      t={t}
      showCommandIds={showCommandIds}
      language={language}
      fontFamily={fontFamily}
    />
  );

  const blob = await pdf(doc).toBlob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = buildPdfFileName();
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}

export function exportToMarkdown(options: ExportCheatsheetOptions): void {
  const {
    selectedBindings,
    groupingKind,
    layout,
    os,
    metadata,
    activeContext,
    inputLayout,
    customInputMapping,
    t,
    showCommandIds = true,
    language = 'en',
  } = options;

  const visualOptions: VisualOptions = { inputLayout, customInputMapping };
  const editor = metadata?.sourceEditor ?? t('pdf.editorUnknown');
  const groups = buildBindingGroups(selectedBindings, groupingKind, os);

  const lines: string[] = [
    `# ${t('pdf.title')}`,
    '',
    `| ${t('pdf.summaryOs')} | ${t('pdf.summaryEditor')} | ${t('pdf.summaryContext')} |`,
    '|-----|--------|---------|',
    `| ${os} | ${editor} | ${activeContext || t('common.global')} |`,
    '',
    `## ${t('pdf.summaryBindings')} (${t(groupingKind === 'mode' ? 'pdf.groupedByModeContext' : 'pdf.groupedByModifier')})`,
    '',
  ];

  for (const group of groups) {
    lines.push(`### ${group.name} (${group.bindings.length})`);
    lines.push('');
    lines.push(`| ${t('tooltip.keyLabel')} | Command |`);
    lines.push('|-----|---------|');

    for (const binding of group.bindings) {
      const sequence = getVisualSequenceString(binding, os, visualOptions);
      const key = sequence.replace(/\|/g, '\\|');
      const friendlyName = lookupActionName(binding.sourceEditor, binding.command, language);
      const isUnmapped = !friendlyName || friendlyName === binding.command;

      let displayCommand = binding.command;
      if (!isUnmapped) {
        displayCommand = showCommandIds ? `${friendlyName} \`(${binding.command})\`` : friendlyName;
      } else {
        const formatted = formatRawCommand(binding.command);
        displayCommand = showCommandIds && formatted !== binding.command
          ? `${formatted} \`(${binding.command})\``
          : `\`${formatted}\``;
      }

      lines.push(`| \`${key}\` | ${displayCommand} |`);
    }
    lines.push('');
  }

  lines.push('---');

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = buildMarkdownFileName();
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}
