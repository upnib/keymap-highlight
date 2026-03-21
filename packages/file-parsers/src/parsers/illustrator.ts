// illustrator.ts - Parses Adobe Illustrator exported shortcut text files into normalized KeyBinding records.
// Supports tab-separated tool shortcuts, compact menu-command lines like "NewCtrl+N", and
// strict spaced-shortcut detection to prevent action names from being misclassified as key bindings.
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
  'cmd/ctrl',
  'ctrl/cmd',
]);

const OS_SENSITIVE_MODIFIERS = new Set([
  'cmdorctrl',
  'ctrlorcmd',
  'ctrlcmd',
  'cmd/ctrl',
  'ctrl/cmd',
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

const SUPPORTED_KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  del: 'delete',
  ins: 'insert',
  return: 'enter',
  bksp: 'backspace',
  pgup: 'pageup',
  pgdn: 'pagedown',
  pgdown: 'pagedown',
  spacebar: 'space',
  quote: "'",
  apostrophe: "'",
  backquote: '`',
  grave: '`',
  minus: '-',
  hyphen: '-',
  plus: '+',
  equal: '=',
  equals: '=',
  comma: ',',
  period: '.',
  dot: '.',
  slash: '/',
  forwardslash: '/',
  backslash: '\\',
  semicolon: ';',
  colon: ':',
  bracketleft: '[',
  leftbracket: '[',
  bracketright: ']',
  rightbracket: ']',
};

const MODIFIER_SORT_ORDER: Readonly<Record<string, number>> = {
  ctrl: 0,
  shift: 1,
  alt: 2,
  meta: 3,
  fn: 4,
  menu: 5,
};

const SECTION_CONTEXT: Readonly<Record<string, string>> = {
  tools: 'tools',
  'menu commands': 'menu commands',
};

const MODIFIER_PREFIX_PATTERN =
  /(?:cmdorctrl|ctrlorcmd|ctrlcmd|cmd\/ctrl|ctrl\/cmd|ctrl|control|ctl|shift|alt|option|opt|cmd|command|meta|super|win|windows|fn)\s*\+/gi;

export function parseIllustrator(content: string, os: OS): ParseResult {
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

    const parsedShortcut = parseShortcut(parsedEntry.shortcut, os);
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
  const normalized = normalizeKey(token);
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

  return SUPPORTED_NAMED_KEYS.has(normalized);
}

function parseShortcut(shortcut: string, os: OS): ParsedShortcut | null {
  const compactShortcut = shortcut.trim().replace(/\s*\+\s*/g, '+');
  if (!compactShortcut || /\s/.test(compactShortcut)) {
    return null;
  }

  const { modifierTokens, keyToken } = splitPlusShortcutTokens(compactShortcut);

  const modifiers: string[] = [];
  const seenModifiers = new Set<string>();
  for (const token of modifierTokens) {
    const modifier = normalizeModifier(token, os);
    if (!modifier) {
      return null;
    }

    if (!seenModifiers.has(modifier)) {
      seenModifiers.add(modifier);
      modifiers.push(modifier);
    }
  }

  const key = normalizeKey(keyToken);
  if (!key || normalizeModifier(key, os) || !isSupportedKeyToken(key)) {
    return null;
  }

  return {
    key,
    modifiers: sortModifiers(modifiers),
  };
}

function normalizeModifier(token: string, os?: OS): string | null {
  const normalized = token.trim().toLowerCase().replace(/[_\-\s]+/g, '');
  if (!ILLUSTRATOR_MODIFIER_TOKENS.has(normalized)) {
    return null;
  }

  if (OS_SENSITIVE_MODIFIERS.has(normalized)) {
    return os === 'macos' ? 'meta' : 'ctrl';
  }

  return BASE_MODIFIER_ALIASES[normalized] ?? null;
}

function normalizeKey(token: string): string {
  const normalized = token.trim().toLowerCase();
  return SUPPORTED_KEY_ALIASES[normalized] ?? normalized;
}

function isSupportedKeyToken(key: string): boolean {
  if (key.length === 1) {
    return true;
  }

  if (/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return true;
  }

  return SUPPORTED_NAMED_KEYS.has(key);
}

function sortModifiers(modifiers: string[]): string[] {
  return [...modifiers].sort((left, right) => {
    const leftOrder = MODIFIER_SORT_ORDER[left] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = MODIFIER_SORT_ORDER[right] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
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
