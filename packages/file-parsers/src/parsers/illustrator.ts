// illustrator.ts - Parses Adobe Illustrator exported shortcut text files into normalized KeyBinding records.
// Supports tab-separated tool shortcuts and compact menu-command lines like "NewCtrl+N".
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

const ILLUSTRATOR_MODIFIER_TOKENS = new Set([
  ...Object.keys(BASE_MODIFIER_ALIASES),
  'cmdorctrl',
  'ctrlorcmd',
  'ctrlcmd',
]);

const SUPPORTED_NAMED_KEYS = new Set([
  'tab',
  'enter',
  'escape',
  'delete',
  'insert',
  'pageup',
  'pagedown',
  'home',
  'end',
  'up',
  'down',
  'left',
  'right',
  'space',
  'backspace',
  'numpad0',
  'numpad1',
  'numpad2',
  'numpad3',
  'numpad4',
  'numpad5',
  'numpad6',
  'numpad7',
  'numpad8',
  'numpad9',
  'numpadadd',
  'numpadsubtract',
  'numpadmultiply',
  'numpaddivide',
  'numpaddecimal',
  'numpadenter',
  'numlock',
]);

const SECTION_CONTEXT: Readonly<Record<string, string>> = {
  tools: 'tools',
  'menu commands': 'menu commands',
};

const MODIFIER_PREFIX_PATTERN =
  /(?:ctrl|control|ctl|shift|alt|option|opt|cmd|command|meta|super|win|windows|fn)\+/gi;

export function parseIllustrator(content: string, _os: OS): ParseResult {
  const bindings: KeyBindingType[] = [];
  const warnings: ParseWarning[] = [];
  const parsedAt = new Date().toISOString();

  if (!content.trim()) {
    addWarning(warnings, 'Illustrator shortcuts content is empty.', 'ILLUSTRATOR_EMPTY_CONTENT');
    return buildParseResult(bindings, warnings, parsedAt);
  }

  const lines = content.split(/\r?\n/);
  let currentContext = '';

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? '';
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const sectionContext = SECTION_CONTEXT[trimmedLine.toLowerCase()];
    if (sectionContext) {
      currentContext = sectionContext;
      continue;
    }

    const parsedEntry = parseShortcutEntry(rawLine);
    if (!parsedEntry) {
      continue;
    }

    const parsedShortcut = parseShortcut(parsedEntry.shortcut);
    if (!parsedShortcut) {
      addWarning(
        warnings,
        `Skipped unsupported Illustrator shortcut "${parsedEntry.shortcut}" for command "${parsedEntry.command}".`,
        'ILLUSTRATOR_SHORTCUT_INVALID',
        lineNumber,
      );
      continue;
    }

    const parsedBinding = KeyBinding.safeParse({
      key: parsedShortcut.key,
      command: parsedEntry.command,
      when: currentContext,
      modifiers: parsedShortcut.modifiers,
      chords: [],
      sourceEditor: 'illustrator' as const,
    });

    if (!parsedBinding.success) {
      addWarning(
        warnings,
        `Skipped Illustrator shortcut for command "${parsedEntry.command}" due to schema validation failure.`,
        'ILLUSTRATOR_BINDING_INVALID',
        lineNumber,
      );
      continue;
    }

    bindings.push(parsedBinding.data);
  }

  return buildParseResult(bindings, warnings, parsedAt);
}

function parseShortcutEntry(rawLine: string): { command: string; shortcut: string } | null {
  const tabEntry = parseTabSeparatedEntry(rawLine);
  if (tabEntry) {
    return tabEntry;
  }

  const compactModifierEntry = parseCompactModifierEntry(rawLine);
  if (compactModifierEntry) {
    return compactModifierEntry;
  }

  const compactFunctionKeyEntry = parseCompactFunctionKeyEntry(rawLine);
  if (compactFunctionKeyEntry) {
    return compactFunctionKeyEntry;
  }

  const spacedEntry = parseSpacedShortcutEntry(rawLine);
  if (spacedEntry) {
    return spacedEntry;
  }

  return null;
}

function parseTabSeparatedEntry(rawLine: string): { command: string; shortcut: string } | null {
  const segments = rawLine.split('\t');
  if (segments.length < 2) {
    return null;
  }

  const command = (segments[0] ?? '').trim();
  const shortcut = (segments[segments.length - 1] ?? '').trim();
  if (!command || !shortcut) {
    return null;
  }

  return {
    command,
    shortcut,
  };
}

function parseCompactModifierEntry(rawLine: string): { command: string; shortcut: string } | null {
  MODIFIER_PREFIX_PATTERN.lastIndex = 0;

  let match = MODIFIER_PREFIX_PATTERN.exec(rawLine);
  while (match) {
    const shortcutStart = match.index;
    const command = rawLine.slice(0, shortcutStart).trimEnd();
    const shortcut = rawLine.slice(shortcutStart).trim();
    if (command && shortcut) {
      return {
        command,
        shortcut,
      };
    }

    match = MODIFIER_PREFIX_PATTERN.exec(rawLine);
  }

  return null;
}

function parseCompactFunctionKeyEntry(rawLine: string): { command: string; shortcut: string } | null {
  const match = rawLine.trim().match(/^(.*?)(f(?:[1-9]|1[0-9]|2[0-4]))$/i);
  if (!match) {
    return null;
  }

  const command = (match[1] ?? '').trim();
  const shortcut = (match[2] ?? '').trim();
  if (!command || !shortcut) {
    return null;
  }

  return {
    command,
    shortcut,
  };
}

function parseSpacedShortcutEntry(rawLine: string): { command: string; shortcut: string } | null {
  const trimmed = rawLine.trim();
  const separatorIndex = trimmed.lastIndexOf(' ');
  if (separatorIndex === -1) {
    return null;
  }

  const command = trimmed.slice(0, separatorIndex).trim();
  const shortcut = trimmed.slice(separatorIndex + 1).trim();
  if (!command || !shortcut || !isLikelyShortcutToken(shortcut)) {
    return null;
  }

  return {
    command,
    shortcut,
  };
}

function isLikelyShortcutToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.includes('+')) {
    return true;
  }

  if (normalized.length === 1) {
    return true;
  }

  if (/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
    return true;
  }

  return SUPPORTED_NAMED_KEYS.has(normalized) || /^[a-z][a-z0-9_]*$/.test(normalized);
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const compactShortcut = shortcut.trim().replace(/\s*\+\s*/g, '+');
  if (!compactShortcut || /\s/.test(compactShortcut)) {
    return null;
  }

  const { modifierTokens, keyToken } = splitPlusShortcutTokens(compactShortcut);

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
  if (!key || normalizeModifier(key) || !isSupportedKeyToken(key)) {
    return null;
  }

  return {
    key,
    modifiers,
  };
}

function normalizeModifier(token: string): string | null {
  const normalized = token.trim().toLowerCase();
  if (ILLUSTRATOR_MODIFIER_TOKENS.has(normalized)) {
    return normalized;
  }

  return null;
}

function normalizeKey(token: string): string {
  const normalized = token.trim().toLowerCase();
  return normalized;
}

function isSupportedKeyToken(key: string): boolean {
  if (key.length === 1) {
    return true;
  }

  if (/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return true;
  }

  return SUPPORTED_NAMED_KEYS.has(key) || /^[a-z][a-z0-9_]*$/.test(key);
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

function buildParseResult(bindings: KeyBindingType[], warnings: ParseWarning[], parsedAt: string): ParseResult {
  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'illustrator',
      parsedAt,
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}
