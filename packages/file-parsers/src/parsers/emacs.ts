// parsers/emacs.ts - Parses Emacs keybinding forms (global-set-key and define-key) from Elisp
// config content. Strips Elisp line comments before processing, then walks each matched form
// with a recursive-descent S-expression reader to extract key sequences and command symbols.
import type { KeyModifier, OS } from '../schemas/enums';
import type { KeyBinding, KeyChord } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';

type EmacsForm = 'global-set-key' | 'define-key';

type ReadExpressionResult = {
  value: string;
  nextIndex: number;
};

const FORM_PATTERN = /(?:^|[\s(])(global-set-key|define-key)\b/gm;

export function parseEmacs(content: string, _os: OS): ParseResult {
  const bindings: KeyBinding[] = [];
  const warnings: ParseWarning[] = [];
  const strippedContent = stripComments(content);

  for (const match of strippedContent.matchAll(FORM_PATTERN)) {
    const form = match[1] as EmacsForm;
    const keywordIndex = (match.index ?? 0) + match[0].length - form.length;
    const line = getLineNumber(strippedContent, keywordIndex);
    let cursor = keywordIndex + form.length;

    if (form === 'global-set-key') {
      const keyExpression = readExpression(strippedContent, cursor);
      if (!keyExpression) {
        warnings.push(createWarning('Skipped malformed global-set-key form.', line, 'EMACS_FORM_PARSE'));
        continue;
      }

      cursor = keyExpression.nextIndex;
      const commandExpression = readExpression(strippedContent, cursor);
      if (!commandExpression) {
        warnings.push(createWarning('Skipped global-set-key with missing command.', line, 'EMACS_FORM_PARSE'));
        continue;
      }

      const binding = buildBinding(keyExpression.value, commandExpression.value, 'global');
      if (!binding) {
        warnings.push(createWarning('Skipped global-set-key with unsupported key syntax.', line, 'EMACS_BINDING_SKIP'));
        continue;
      }

      bindings.push(binding);
      continue;
    }

    const mapExpression = readExpression(strippedContent, cursor);
    if (!mapExpression) {
      warnings.push(createWarning('Skipped malformed define-key form.', line, 'EMACS_FORM_PARSE'));
      continue;
    }

    cursor = mapExpression.nextIndex;
    const keyExpression = readExpression(strippedContent, cursor);
    if (!keyExpression) {
      warnings.push(createWarning('Skipped define-key with missing key expression.', line, 'EMACS_FORM_PARSE'));
      continue;
    }

    cursor = keyExpression.nextIndex;
    const commandExpression = readExpression(strippedContent, cursor);
    if (!commandExpression) {
      warnings.push(createWarning('Skipped define-key with missing command.', line, 'EMACS_FORM_PARSE'));
      continue;
    }

    const when = normalizeMapExpression(mapExpression.value);
    const binding = buildBinding(keyExpression.value, commandExpression.value, when);
    if (!binding) {
      warnings.push(createWarning('Skipped define-key with unsupported key syntax.', line, 'EMACS_BINDING_SKIP'));
      continue;
    }

    bindings.push(binding);
  }

  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'emacs',
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

function buildBinding(keyExpression: string, commandExpression: string, when: string): KeyBinding | null {
  const chords = parseKeyExpression(keyExpression);
  if (!chords || chords.length === 0) {
    return null;
  }

  const command = normalizeCommandExpression(commandExpression);
  if (!command) {
    return null;
  }

  const [primaryChord, ...remainingChords] = chords;
  return {
    key: primaryChord.key,
    command,
    when,
    modifiers: primaryChord.modifiers,
    chords: remainingChords,
    sourceEditor: 'emacs',
  };
}

function parseKeyExpression(expression: string): KeyChord[] | null {
  const sequence = extractKeySequence(expression);
  if (!sequence) {
    return null;
  }

  const tokens = sequence.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return null;
  }

  const chords: KeyChord[] = [];
  for (const token of tokens) {
    const chord = parseChordToken(token);
    if (!chord) {
      return null;
    }

    chords.push(chord);
  }

  return chords;
}

function extractKeySequence(expression: string): string | null {
  let candidate = expression.trim();
  if (!candidate) {
    return null;
  }

  candidate = candidate.replace(/^#?'+/, '');

  const kbdMatch = candidate.match(/^\(kbd\s+"((?:\\.|[^"\\])*)"\)$/i);
  if (kbdMatch) {
    return decodeEmacsKeyString(kbdMatch[1]);
  }

  const bareKbdMatch = candidate.match(/^kbd\s+"((?:\\.|[^"\\])*)"$/i);
  if (bareKbdMatch) {
    return decodeEmacsKeyString(bareKbdMatch[1]);
  }

  const quotedStringMatch = candidate.match(/^"((?:\\.|[^"\\])*)"$/);
  if (quotedStringMatch) {
    return decodeEmacsKeyString(quotedStringMatch[1]);
  }

  return decodeEmacsKeyString(candidate);
}

function decodeEmacsKeyString(value: string): string {
  let decoded = value;
  decoded = decoded.replace(/\\([CMSs])-([^\s\\])/g, ' $1-$2 ');
  decoded = decoded.replace(/\\n/g, ' ');
  decoded = decoded.replace(/\\t/g, ' ');
  decoded = decoded.replace(/\\(.)/g, '$1');
  decoded = decoded.replace(/\s+/g, ' ').trim();
  return decoded;
}

function parseChordToken(token: string): KeyChord | null {
  const cleanedToken = token.trim();
  if (!cleanedToken) {
    return null;
  }

  const { modifierTokens, rawKey } = splitChordTokenParts(cleanedToken);
  if (!rawKey) {
    return null;
  }

  const key = normalizeKey(rawKey);
  if (!key) {
    return null;
  }

  const modifiers: KeyModifier[] = [];
  for (const rawModifier of modifierTokens) {
    const modifier = mapModifier(rawModifier);
    if (!modifier || modifiers.includes(modifier)) {
      continue;
    }

    modifiers.push(modifier);
  }

  return {
    key,
    modifiers,
  };
}

function splitChordTokenParts(token: string): { modifierTokens: string[]; rawKey: string } {
  const bracketStartIndex = token.indexOf('<');
  if (bracketStartIndex !== -1 && token.endsWith('>')) {
    const modifierPrefix = token.slice(0, bracketStartIndex).replace(/-+$/, '');
    const modifierTokens = modifierPrefix
      .split('-')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    return {
      modifierTokens,
      rawKey: token.slice(bracketStartIndex),
    };
  }

  const segments = token
    .split('-')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const rawKey = segments.pop() ?? '';

  return {
    modifierTokens: segments,
    rawKey,
  };
}

function normalizeKey(rawKey: string): string {
  let key = rawKey.trim();
  if (!key) {
    return '';
  }

  if (key.startsWith('<') && key.endsWith('>') && key.length > 2) {
    key = key.slice(1, -1);
  }

  const lowerKey = key.toLowerCase();
  return lowerKey;
}

function mapModifier(rawModifier: string): KeyModifier | null {
  if (rawModifier === 'S') {
    return 'S';
  }

  if (rawModifier === 's') {
    return 's';
  }

  const normalized = rawModifier.toLowerCase();
  switch (normalized) {
    case 'c':
    case 'ctrl':
    case 'control':
    case 'm':
    case 'meta':
    case 'shift':
    case 'a':
    case 'alt':
    case 'cmd':
    case 'command':
    case 'super':
    case 'hyper':
    case 'h':
    case 'option':
    case 'opt':
    case 'fn':
      return normalized;
    default:
      return null;
  }
}

function normalizeMapExpression(expression: string): string {
  const normalized = normalizeSymbolExpression(expression);
  if (!normalized) {
    return '';
  }

  if (normalized === 'global-map' || normalized === 'current-global-map') {
    return 'global';
  }

  return normalized;
}

function normalizeCommandExpression(expression: string): string {
  let normalized = expression.trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized.replace(/^#'/, "'");
  normalized = normalized.replace(/^'+/, '');

  const functionMatch = normalized.match(/^\(function\s+([^\s()]+)\)$/);
  if (functionMatch) {
    return functionMatch[1];
  }

  const quoteMatch = normalized.match(/^\(quote\s+([^\s()]+)\)$/);
  if (quoteMatch) {
    return quoteMatch[1];
  }

  if (/^\(lambda\b/.test(normalized)) {
    return 'lambda';
  }

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) {
      return '';
    }

    const head = inner.split(/\s+/)[0];
    return head ?? '';
  }

  return normalized;
}

function normalizeSymbolExpression(expression: string): string {
  let normalized = expression.trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized.replace(/^#'/, "'");
  normalized = normalized.replace(/^'+/, '');

  const functionMatch = normalized.match(/^\(function\s+([^\s()]+)\)$/);
  if (functionMatch) {
    return functionMatch[1];
  }

  const quoteMatch = normalized.match(/^\(quote\s+([^\s()]+)\)$/);
  if (quoteMatch) {
    return quoteMatch[1];
  }

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) {
      return '';
    }

    if (!inner.includes(' ')) {
      return inner;
    }

    return inner.split(/\s+/)[0] ?? '';
  }

  return normalized;
}

function readExpression(input: string, startIndex: number): ReadExpressionResult | null {
  const expressionStart = skipWhitespace(input, startIndex);
  if (expressionStart >= input.length) {
    return null;
  }

  const firstChar = input[expressionStart];

  if (firstChar === "'" || firstChar === '`') {
    const quotedExpression = readExpression(input, expressionStart + 1);
    if (!quotedExpression) {
      return null;
    }

    return {
      value: input.slice(expressionStart, quotedExpression.nextIndex),
      nextIndex: quotedExpression.nextIndex,
    };
  }

  if (firstChar === '#' && input[expressionStart + 1] === "'") {
    const sharpQuotedExpression = readExpression(input, expressionStart + 2);
    if (!sharpQuotedExpression) {
      return null;
    }

    return {
      value: input.slice(expressionStart, sharpQuotedExpression.nextIndex),
      nextIndex: sharpQuotedExpression.nextIndex,
    };
  }

  if (firstChar === '"') {
    let index = expressionStart + 1;
    while (index < input.length) {
      const currentChar = input[index];
      if (currentChar === '\\') {
        index += 2;
        continue;
      }

      if (currentChar === '"') {
        return {
          value: input.slice(expressionStart, index + 1),
          nextIndex: index + 1,
        };
      }

      index += 1;
    }

    return null;
  }

  if (firstChar === '(' || firstChar === '[') {
    return readBalancedExpression(input, expressionStart, firstChar, firstChar === '(' ? ')' : ']');
  }

  let endIndex = expressionStart;
  while (endIndex < input.length) {
    const currentChar = input[endIndex];
    if (isWhitespace(currentChar) || currentChar === ')' || currentChar === ']') {
      break;
    }

    endIndex += 1;
  }

  if (endIndex === expressionStart) {
    return null;
  }

  return {
    value: input.slice(expressionStart, endIndex),
    nextIndex: endIndex,
  };
}

function readBalancedExpression(
  input: string,
  startIndex: number,
  openingChar: '(' | '[',
  closingChar: ')' | ']'
): ReadExpressionResult | null {
  let depth = 0;
  let index = startIndex;
  let inString = false;

  while (index < input.length) {
    const currentChar = input[index];

    if (inString) {
      if (currentChar === '\\') {
        index += 2;
        continue;
      }

      if (currentChar === '"') {
        inString = false;
      }

      index += 1;
      continue;
    }

    if (currentChar === '"') {
      inString = true;
      index += 1;
      continue;
    }

    if (currentChar === openingChar) {
      depth += 1;
    } else if (currentChar === closingChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          value: input.slice(startIndex, index + 1),
          nextIndex: index + 1,
        };
      }
    }

    index += 1;
  }

  return null;
}

function skipWhitespace(input: string, startIndex: number): number {
  let index = startIndex;
  while (index < input.length && isWhitespace(input[index])) {
    index += 1;
  }

  return index;
}

function isWhitespace(value: string): boolean {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t';
}

function stripComments(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      let inString = false;
      let escaped = false;

      for (let index = 0; index < line.length; index += 1) {
        const currentChar = line[index];
        if (escaped) {
          escaped = false;
          continue;
        }

        if (currentChar === '\\') {
          escaped = true;
          continue;
        }

        if (currentChar === '"') {
          inString = !inString;
          continue;
        }

        if (currentChar === ';' && !inString) {
          return line.slice(0, index);
        }
      }

      return line;
    })
    .join('\n');
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function createWarning(message: string, line: number, code: string): ParseWarning {
  return {
    message,
    line,
    code,
  };
}
