// detect-config-os.ts - Parser-owned loaded-config OS inference that runs via editor parsers before remap decisions.
import { isSupportedEditorFormat, type Editor } from './editor-formats';
import { PARSERS_BY_EDITOR, type ParserFunction } from './parsers';
import type { OS } from './schemas/enums';

export type SupportedConfigOs = 'mac' | 'win' | 'linux';
export type DetectedConfigOs = SupportedConfigOs | 'unknown';

type OsScores = Record<SupportedConfigOs, number>;
type ParsedChord = {
  key: string;
  modifiers: string[];
};
type ParsedBinding = {
  key: string;
  modifiers: string[];
  chords: ParsedChord[];
};
type ParseOutput = {
  bindings: ParsedBinding[];
};

const PARSER_OS_ORDER: readonly SupportedConfigOs[] = ['mac', 'win', 'linux'];
const PARSER_OS_BY_SUPPORTED: Record<SupportedConfigOs, OS> = {
  mac: 'macos',
  win: 'windows',
  linux: 'linux',
};
const DETECTION_TRAITS: Record<SupportedConfigOs, readonly string[]> = {
  mac: ['cmd', 'command', 'opt', 'option'],
  win: ['win', 'windows', 'menu'],
  linux: ['super', 'hyper'],
};

export function detectConfigOs(content: string, format: string): DetectedConfigOs {
  const normalizedFormat = normalizeEditorFormat(format);
  if (!normalizedFormat) {
    return 'unknown';
  }

  const parserShortcuts = collectParserShortcuts(content, normalizedFormat);
  const parserScores = scoreShortcuts(parserShortcuts);
  const parserDetectedOs = resolveDetectedOs(parserScores);
  if (parserDetectedOs) {
    return parserDetectedOs;
  }

  const fallbackScores = scoreRawTraitHints(content);
  return resolveDetectedOs(fallbackScores) ?? 'unknown';
}

function normalizeEditorFormat(format: string): Editor | null {
  const normalizedFormat = format.trim().toLowerCase();
  return isSupportedEditorFormat(normalizedFormat) ? normalizedFormat : null;
}

function collectParserShortcuts(content: string, format: Editor): string[] {
  const parser = PARSERS_BY_EDITOR[format];
  const rawModifierTokens = extractRawModifierTokens(content);
  const rawHasMacTrait = DETECTION_TRAITS.mac.some((trait) => rawModifierTokens.includes(trait));
  const rawHasWinTrait = DETECTION_TRAITS.win.some((trait) => rawModifierTokens.includes(trait));
  const rawHasLinuxTrait = DETECTION_TRAITS.linux.some((trait) => rawModifierTokens.includes(trait));
  const shouldSkipLinuxOsPass = format === 'vscode' && rawHasMacTrait && rawHasWinTrait && !rawHasLinuxTrait;
  const shortcuts = new Set<string>();

  for (const supportedOs of PARSER_OS_ORDER) {
    if (shouldSkipLinuxOsPass && supportedOs === 'linux') {
      continue;
    }

    const parsed = safelyParseContent(content, parser, PARSER_OS_BY_SUPPORTED[supportedOs]);
    if (!parsed || parsed.bindings.length === 0) {
      continue;
    }

    for (const binding of parsed.bindings) {
      const shortcut = serializeBindingShortcut(binding);
      if (shortcut) {
        shortcuts.add(shortcut);
      }
    }
  }

  return Array.from(shortcuts);
}

function safelyParseContent(content: string, parser: ParserFunction, os: OS): ParseOutput | null {
  try {
    const parsed = parser(content, os);
    if (!parsed || !Array.isArray(parsed.bindings)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function serializeBindingShortcut(binding: ParsedBinding): string {
  const shortcutParts = [
    serializeChord({ key: binding.key, modifiers: binding.modifiers }),
    ...binding.chords.map((chord) => serializeChord(chord)),
  ].filter((part) => part.length > 0);

  return shortcutParts.join(' ').trim().toLowerCase();
}

function serializeChord(chord: ParsedChord): string {
  const normalizedKey = chord.key.trim().toLowerCase();
  if (!normalizedKey) {
    return '';
  }

  const normalizedModifiers = chord.modifiers
    .map((modifier) => modifier.trim().toLowerCase())
    .filter((modifier) => modifier.length > 0);

  if (normalizedModifiers.length === 0) {
    return normalizedKey;
  }

  return `${normalizedModifiers.join('+')}+${normalizedKey}`;
}

function scoreShortcuts(shortcuts: string[]): OsScores {
  const scores = createEmptyScores();

  for (const shortcut of shortcuts) {
    scoreShortcutTraits(shortcut, scores);
  }

  return scores;
}

function scoreShortcutTraits(shortcut: string, scores: OsScores): void {
  const tokens = tokenizeShortcut(shortcut);
  if (tokens.length === 0) {
    return;
  }

  const tokenSet = new Set(tokens);
  for (const os of Object.keys(DETECTION_TRAITS) as SupportedConfigOs[]) {
    for (const trait of DETECTION_TRAITS[os]) {
      if (tokenSet.has(trait)) {
        scores[os] += 1;
      }
    }
  }
}

function tokenizeShortcut(shortcut: string): string[] {
  const tokenMatches = shortcut.toLowerCase().match(/[a-z0-9]+/g);
  return tokenMatches ?? [];
}

function scoreRawTraitHints(content: string): OsScores {
  const scores = createEmptyScores();
  const rawModifierTokens = extractRawModifierTokens(content);

  if (rawModifierTokens.length === 0) {
    return scores;
  }

  const tokenSet = new Set(rawModifierTokens);

  for (const os of Object.keys(DETECTION_TRAITS) as SupportedConfigOs[]) {
    for (const trait of DETECTION_TRAITS[os]) {
      if (tokenSet.has(trait)) {
        scores[os] += 1;
      }
    }
  }

  return scores;
}

function extractRawModifierTokens(content: string): string[] {
  const segments = content.toLowerCase().match(/[a-z0-9_<>+\-]+/g) ?? [];
  const tokens: string[] = [];

  for (const segment of segments) {
    if (!segment.includes('+') && !segment.includes('-')) {
      continue;
    }

    const normalizedSegment = segment.replace(/[<>]/g, '');
    const segmentTokens = normalizedSegment
      .split(/[+\-]/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    tokens.push(...segmentTokens);
  }

  return tokens;
}

function createEmptyScores(): OsScores {
  return {
    mac: 0,
    win: 0,
    linux: 0,
  };
}

function resolveDetectedOs(scores: OsScores): SupportedConfigOs | null {
  const ranked = (Object.keys(scores) as SupportedConfigOs[])
    .map((os) => ({ os, score: scores[os] }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    return null;
  }

  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return null;
  }

  return ranked[0].os;
}
