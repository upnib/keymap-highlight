// krita.ts - Parses Krita .shortcuts files into normalized KeyBinding records.
// Supports [Shortcuts] entries, multiple alternatives per action, and schema-safe output.
import type { OS } from '../schemas/enums';
import { KeyBinding, type KeyBinding as KeyBindingType } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';
import {
  BASE_MODIFIER_ALIASES,
  splitPlusShortcutTokens,
} from '../utils/modifier-aliases';

type ParsedShortcut = {
  key: string;
  modifiers: string[];
};

const KRITA_MODIFIER_TOKENS = new Set([
  ...Object.keys(BASE_MODIFIER_ALIASES),
  'cmdorctrl',
  'ctrlorcmd',
  'ctrlcmd',
]);

const SHORTCUT_SECTION_NAME = 'shortcuts';
const SHORTCUT_VARIANT_SPLIT =
  /;\s*(?=(?:ctrl|control|ctl|shift|alt|option|opt|cmd|command|meta|super|win|windows|fn|menu|f\d|\w))/i;

export function parseKrita(content: string, _os: OS): ParseResult {
  const bindings: KeyBindingType[] = [];
  const warnings: ParseWarning[] = [];
  const parsedAt = new Date().toISOString();

  if (!content.trim()) {
    addWarning(warnings, 'Krita shortcuts content is empty.', 'KRITA_EMPTY_CONTENT');
    return buildParseResult(bindings, warnings, parsedAt);
  }

  const lines = content.split(/\r?\n/);
  let hasSection = false;
  let foundShortcutsSection = false;
  let inShortcutsSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? '';
    const trimmedLine = rawLine.trim();

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      continue;
    }

    const sectionName = parseSectionName(trimmedLine);
    if (sectionName) {
      hasSection = true;
      inShortcutsSection = sectionName === SHORTCUT_SECTION_NAME;
      if (inShortcutsSection) {
        foundShortcutsSection = true;
      }
      continue;
    }

    if (hasSection && !inShortcutsSection) {
      continue;
    }

    const entry = parseEntry(rawLine);
    if (!entry) {
      addWarning(warnings, 'Skipped malformed Krita shortcut line.', 'KRITA_ENTRY_INVALID', lineNumber);
      continue;
    }

    if (!entry.command) {
      addWarning(
        warnings,
        'Skipped Krita shortcut with missing action id.',
        'KRITA_COMMAND_MISSING',
        lineNumber,
      );
      continue;
    }

    const shortcutCandidates = splitShortcutCandidates(entry.shortcut);
    if (shortcutCandidates.length === 0) {
      continue;
    }

    for (const shortcutCandidate of shortcutCandidates) {
      if (isDisabledShortcut(shortcutCandidate)) {
        continue;
      }

      const parsedShortcut = parseShortcut(shortcutCandidate);
      if (!parsedShortcut) {
        addWarning(
          warnings,
          `Skipped unsupported Krita shortcut "${shortcutCandidate}" for action "${entry.command}".`,
          'KRITA_SHORTCUT_INVALID',
          lineNumber,
        );
        continue;
      }

      const parsedBinding = KeyBinding.safeParse({
        key: parsedShortcut.key,
        command: entry.command,
        when: '',
        modifiers: parsedShortcut.modifiers,
        chords: [],
        sourceEditor: 'krita' as const,
      });

      if (!parsedBinding.success) {
        addWarning(
          warnings,
          `Skipped Krita shortcut for action "${entry.command}" due to schema validation failure.`,
          'KRITA_BINDING_INVALID',
          lineNumber,
        );
        continue;
      }

      bindings.push(parsedBinding.data);
    }
  }

  if (hasSection && !foundShortcutsSection) {
    addWarning(
      warnings,
      'Krita shortcuts file does not include a [Shortcuts] section.',
      'KRITA_SHORTCUTS_SECTION_MISSING',
    );
  }

  return buildParseResult(bindings, warnings, parsedAt);
}

function parseSectionName(line: string): string | null {
  const match = line.match(/^\[([^\]]+)\]$/);
  if (!match) {
    return null;
  }

  return (match[1] ?? '').trim().toLowerCase();
}

function parseEntry(rawLine: string): { command: string; shortcut: string } | null {
  const equalsIndex = rawLine.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const command = rawLine.slice(0, equalsIndex).trim();
  const shortcut = rawLine.slice(equalsIndex + 1).trim();
  return {
    command,
    shortcut,
  };
}

function splitShortcutCandidates(rawShortcut: string): string[] {
  const normalized = rawShortcut.trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(SHORTCUT_VARIANT_SPLIT)
    .map((shortcut) => shortcut.trim())
    .filter((shortcut) => shortcut.length > 0);
}

function isDisabledShortcut(shortcut: string): boolean {
  const normalized = shortcut.trim().toLowerCase();
  return normalized.length === 0 || normalized === 'none';
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const { modifierTokens, keyToken } = splitPlusShortcutTokens(shortcut.trim());

  const modifiers: string[] = [];
  const seenModifiers = new Set<string>();
  for (const token of modifierTokens) {
    const modifier = normalizeModifier(token);
    if (!modifier) {
      return null;
    }

    if (!seenModifiers.has(modifier)) {
      seenModifiers.add(modifier);
      modifiers.push(modifier);
    }
  }

  const key = normalizeKey(keyToken);
  if (!key || normalizeModifier(key)) {
    return null;
  }

  return {
    key,
    modifiers,
  };
}

function normalizeModifier(token: string): string | null {
  const normalized = token.trim().toLowerCase();
  if (KRITA_MODIFIER_TOKENS.has(normalized)) {
    return normalized;
  }

  return null;
}

function normalizeKey(token: string): string {
  const normalized = token.trim().toLowerCase();
  return normalized;
}

function addWarning(warnings: ParseWarning[], message: string, code: string, line?: number): void {
  warnings.push(
    line
      ? {
          message,
          code,
          line,
        }
      : {
          message,
          code,
        },
  );
}

function buildParseResult(
  bindings: KeyBindingType[],
  warnings: ParseWarning[],
  parsedAt: string,
): ParseResult {
  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'krita',
      parsedAt,
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}
