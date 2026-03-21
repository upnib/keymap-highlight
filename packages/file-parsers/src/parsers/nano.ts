// parsers/nano.ts - Parses GNU nano nanorc bind directives into normalized KeyBinding records.
// Supports bind/unbind directive detection, key-token decoding (^X, M-X, Sh-M-X, F1-F24),
// menu-context extraction, and schema-safe ParseResult output with non-fatal warnings.
import type { OS } from '../schemas/enums';
import type { KeyBinding } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';

type ParsedShortcut = {
  key: string;
  modifiers: string[];
};

type ParseLineResult =
  | { binding: KeyBinding }
  | { warning: ParseWarning }
  | null;

const NANO_MENU_NAMES = new Set([
  'all',
  'main',
  'help',
  'search',
  'replace',
  'replacewith',
  'yesno',
  'gotoline',
  'writeout',
  'insert',
  'browser',
  'whereisfile',
  'gotodir',
  'execute',
  'spell',
  'linter',
]);

const FUNCTION_KEY_PATTERN = /^f(?:[1-9]|1[0-9]|2[0-4])$/i;

const SPECIAL_KEY_ALIASES: Readonly<Record<string, string>> = {
  space: 'space',
  tab: 'tab',
  enter: 'enter',
  return: 'enter',
  esc: 'escape',
  escape: 'escape',
  ins: 'insert',
  insert: 'insert',
  del: 'delete',
  delete: 'delete',
  bsp: 'backspace',
  backspace: 'backspace',
  pgup: 'pageup',
  pageup: 'pageup',
  pgdn: 'pagedown',
  pagedown: 'pagedown',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  home: 'home',
  end: 'end',
};

const PREFIX_MODIFIERS: ReadonlyArray<{ prefix: string; modifier: string }> = [
  { prefix: 'sh-', modifier: 'shift' },
  { prefix: 'm-', modifier: 'alt' },
  { prefix: 'meta-', modifier: 'alt' },
  { prefix: 'alt-', modifier: 'alt' },
];

const CONTROL_SHORTCUT_ALIASES: Readonly<Record<string, string>> = {
  '@': 'space',
  '?': 'delete',
  h: 'backspace',
  i: 'tab',
  m: 'enter',
  '[': 'escape',
};

export function parseNano(content: string, _os: OS): ParseResult {
  const bindings: KeyBinding[] = [];
  const warnings: ParseWarning[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const parsedLine = parseNanoLine(lines[index] ?? '', index + 1);
    if (!parsedLine) {
      continue;
    }

    if ('warning' in parsedLine) {
      warnings.push(parsedLine.warning);
      continue;
    }

    bindings.push(parsedLine.binding);
  }

  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'nano',
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

function parseNanoLine(line: string, lineNumber: number): ParseLineResult {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  const tokens = tokenizeDirectiveLine(trimmedLine);
  if (!tokens) {
    return {
      warning: {
        message: 'Skipped malformed nano directive with unterminated quotes.',
        line: lineNumber,
        code: 'NANO_MALFORMED_DIRECTIVE',
      },
    };
  }

  if (tokens.length === 0) {
    return null;
  }

  const directive = (tokens[0] ?? '').trim().toLowerCase();
  if (directive !== 'bind' && directive !== 'unbind') {
    return null;
  }

  if (directive === 'unbind') {
    return null;
  }

  if (tokens.length < 4) {
    return {
      warning: {
        message: 'Skipped malformed nano bind directive.',
        line: lineNumber,
        code: 'NANO_BIND_MALFORMED',
      },
    };
  }

  const keyToken = (tokens[1] ?? '').trim();
  const menuToken = (tokens[tokens.length - 1] ?? '').trim().toLowerCase();
  const commandToken = tokens.slice(2, -1).join(' ').trim();

  if (!NANO_MENU_NAMES.has(menuToken)) {
    return {
      warning: {
        message: `Skipped nano bind with unsupported menu "${menuToken}".`,
        line: lineNumber,
        code: 'NANO_MENU_UNSUPPORTED',
      },
    };
  }

  const parsedShortcut = parseShortcutToken(keyToken);
  if (!parsedShortcut) {
    return {
      warning: {
        message: `Skipped nano bind with unsupported key token "${keyToken}".`,
        line: lineNumber,
        code: 'NANO_KEY_UNSUPPORTED',
      },
    };
  }

  const command = normalizeCommandToken(commandToken);
  if (!command) {
    return {
      warning: {
        message: 'Skipped nano bind with empty function token.',
        line: lineNumber,
        code: 'NANO_COMMAND_EMPTY',
      },
    };
  }

  return {
    binding: {
      key: parsedShortcut.key,
      command,
      when: normalizeMenuContext(menuToken),
      modifiers: parsedShortcut.modifiers,
      chords: [],
      sourceEditor: 'nano',
    },
  };
}

function tokenizeDirectiveLine(line: string): string[] | null {
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    while (cursor < line.length && /\s/.test(line[cursor] ?? '')) {
      cursor += 1;
    }

    if (cursor >= line.length) {
      break;
    }

    if (line[cursor] === '"') {
      const { token, nextCursor } = readQuotedToken(line, cursor);
      if (token === null) {
        return null;
      }
      tokens.push(token);
      cursor = nextCursor;
      continue;
    }

    let tokenEnd = cursor;
    while (tokenEnd < line.length && !/\s/.test(line[tokenEnd] ?? '')) {
      tokenEnd += 1;
    }

    const token = line.slice(cursor, tokenEnd).trim();
    if (token) {
      tokens.push(token);
    }

    cursor = tokenEnd;
  }

  return tokens;
}

function readQuotedToken(line: string, startIndex: number): { token: string | null; nextCursor: number } {
  let cursor = startIndex + 1;
  let token = '';

  while (cursor < line.length) {
    const currentChar = line[cursor] ?? '';
    const previousChar = line[cursor - 1] ?? '';
    if (currentChar === '"' && previousChar !== '\\') {
      return {
        token,
        nextCursor: cursor + 1,
      };
    }

    token += currentChar;
    cursor += 1;
  }

  return {
    token: null,
    nextCursor: line.length,
  };
}

function normalizeCommandToken(rawToken: string): string | null {
  const trimmedToken = rawToken.trim();
  if (!trimmedToken) {
    return null;
  }

  if (trimmedToken.startsWith('{') && trimmedToken.endsWith('}') && trimmedToken.length > 2) {
    const wrappedCommand = trimmedToken.slice(1, -1).trim();
    return wrappedCommand || null;
  }

  return trimmedToken;
}

function normalizeMenuContext(menuToken: string): string {
  return menuToken === 'all' || menuToken === 'main' ? '' : `menu=${menuToken}`;
}

function parseShortcutToken(rawShortcutToken: string): ParsedShortcut | null {
  let token = rawShortcutToken.trim();
  if (!token) {
    return null;
  }

  const prefixedModifiers: string[] = [];
  while (token) {
    const normalizedToken = token.toLowerCase();
    const matchedPrefix = PREFIX_MODIFIERS.find(({ prefix }) => normalizedToken.startsWith(prefix));
    if (!matchedPrefix) {
      break;
    }

    prefixedModifiers.push(matchedPrefix.modifier);
    token = token.slice(matchedPrefix.prefix.length).trim();
  }

  if (!token) {
    return null;
  }

  const parsedShortcut = token.startsWith('^') && token.length > 1
    ? parseControlShortcut(token.slice(1))
    : parsePlainShortcut(token);

  return prependModifiers(parsedShortcut, prefixedModifiers);
}

function parseControlShortcut(rawToken: string): ParsedShortcut | null {
  const token = rawToken.trim();
  if (!token) {
    return null;
  }

  if (token.startsWith('^')) {
    return {
      key: '^',
      modifiers: ['ctrl'],
    };
  }

  const controlAlias = CONTROL_SHORTCUT_ALIASES[token.toLowerCase()];
  if (controlAlias) {
    return {
      key: controlAlias,
      modifiers: ['ctrl'],
    };
  }

  return prependModifiers(parsePlainShortcut(token), ['ctrl']);
}

function parsePlainShortcut(rawToken: string): ParsedShortcut | null {
  const token = rawToken.trim();
  if (!token) {
    return null;
  }

  const normalizedToken = token.toLowerCase();

  const specialAlias = SPECIAL_KEY_ALIASES[normalizedToken];
  if (specialAlias) {
    return {
      key: specialAlias,
      modifiers: [],
    };
  }

  if (FUNCTION_KEY_PATTERN.test(normalizedToken)) {
    return {
      key: normalizedToken,
      modifiers: [],
    };
  }

  if (normalizedToken.length === 1) {
    return {
      key: normalizedToken,
      modifiers: [],
    };
  }

  if (/^[a-z][a-z0-9_-]*$/.test(normalizedToken)) {
    return {
      key: normalizedToken,
      modifiers: [],
    };
  }

  return null;
}

function prependModifiers(shortcut: ParsedShortcut | null, modifiersToPrepend: readonly string[]): ParsedShortcut | null {
  if (!shortcut) {
    return null;
  }

  return {
    key: shortcut.key,
    modifiers: Array.from(new Set([...modifiersToPrepend, ...shortcut.modifiers])),
  };
}
