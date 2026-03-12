// vim.ts — Parses Vimscript and Neovim Lua mappings into KeyBinding records.
// Includes resilient line-level warnings and returns schema-validated ParseResult output.
// Vim modifier tokens are emitted in raw lowercased form for downstream normalization.
import type { KeyBinding, KeyChord } from '../schemas/keyBinding';
import type { KeyModifier } from '../schemas/enums';
import { ParseResult, type ParseResult as ParseResultType, type ParseWarning } from '../schemas/parseResult';

export type OS = 'windows' | 'macos' | 'linux';

const VIMSCRIPT_MAPPING_REGEX =
  /^\s*(?<command>(?:[nvisxocst]?noremap!?|[nvisxocst]?map!?))\s+(?<rest>.+)$/i;

const VIMSCRIPT_OPTION_TOKENS = new Set([
  '<buffer>',
  '<expr>',
  '<nowait>',
  '<script>',
  '<silent>',
  '<special>',
  '<unique>',
]);

const MODE_BY_CHAR: Record<string, string> = {
  n: 'normal',
  v: 'visual',
  i: 'insert',
  x: 'visual',
  s: 'select',
  c: 'command',
  o: 'operator',
  t: 'terminal',
};

interface LuaCallMatch {
  args: string;
  line: number;
}

type ParsedLine =
  | { binding: KeyBinding }
  | { warning: ParseWarning }
  | null;

export function parseVim(content: string, os: OS): ParseResultType {
  const bindings: KeyBinding[] = [];
  const warnings: ParseWarning[] = [];

  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseVimScriptLine(lines[index] ?? '', index + 1, os);
    if (!parsed) {
      continue;
    }
    if ('warning' in parsed) {
      warnings.push(parsed.warning);
      continue;
    }
    bindings.push(parsed.binding);
  }

  const neovimCallNames = ['vim.api.nvim_set_keymap', 'vim.keymap.set'];
  for (const callName of neovimCallNames) {
    const matches = findLuaCalls(content, callName);
    for (const match of matches) {
      const parsed = parseLuaMappingCall(match, os);
      if ('warning' in parsed) {
        warnings.push(parsed.warning);
        continue;
      }
      bindings.push(parsed.binding);
    }
  }

  const sourceEditor = bindings.some((binding) => binding.sourceEditor === 'neovim') ? 'neovim' : 'vim';

  return ParseResult.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor,
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

function parseVimScriptLine(line: string, lineNumber: number, os: OS): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('"')) {
    return null;
  }

  const mappingMatch = trimmed.match(VIMSCRIPT_MAPPING_REGEX);
  if (!mappingMatch?.groups) {
    return null;
  }

  const command = mappingMatch.groups.command.toLowerCase();
  const rest = mappingMatch.groups.rest.trim();
  const tokens = rest.split(/\s+/).filter(Boolean);

  let lhsIndex = 0;
  while (lhsIndex < tokens.length && isVimOptionTokenSequence(tokens[lhsIndex] ?? '')) {
    lhsIndex += 1;
  }

  const lhs = tokens[lhsIndex] ?? '';
  const rhs = tokens.slice(lhsIndex + 1).join(' ').trim();

  if (!lhs || !rhs) {
    return {
      warning: {
        message: 'Unable to parse Vim mapping line.',
        line: lineNumber,
        code: 'vim_mapping_parse_failed',
      },
    };
  }

  const modes = modesFromVimCommand(command);
  const binding = buildBinding({
    lhs,
    rhs,
    sourceEditor: 'vim',
    modes,
    os,
  });

  if (!binding) {
    return {
      warning: {
        message: 'Skipped Vim mapping with unsupported key sequence.',
        line: lineNumber,
        code: 'vim_mapping_unsupported_key',
      },
    };
  }

  return { binding };
}

function parseLuaMappingCall(match: LuaCallMatch, os: OS): { binding: KeyBinding } | { warning: ParseWarning } {
  const args = splitLuaArguments(match.args);
  if (args.length < 3) {
    return {
      warning: {
        message: 'Unable to parse Lua keymap call arguments.',
        line: match.line,
        code: 'lua_mapping_parse_failed',
      },
    };
  }

  const lhs = decodeLuaValue(args[1] ?? '').trim();
  const rhsRaw = decodeLuaValue(args[2] ?? '').trim();
  const modes = modesFromLuaArgument(args[0] ?? '');

  if (!lhs || !rhsRaw || modes.length === 0) {
    return {
      warning: {
        message: 'Skipped Lua keymap call due to unsupported arguments.',
        line: match.line,
        code: 'lua_mapping_invalid_arguments',
      },
    };
  }

  const binding = buildBinding({
    lhs,
    rhs: rhsRaw,
    sourceEditor: 'neovim',
    modes,
    os,
  });

  if (!binding) {
    return {
      warning: {
        message: 'Skipped Lua keymap with unsupported key sequence.',
        line: match.line,
        code: 'lua_mapping_unsupported_key',
      },
    };
  }

  return { binding };
}

function buildBinding(input: {
  lhs: string;
  rhs: string;
  sourceEditor: 'vim' | 'neovim';
  modes: string[];
  os: OS;
}): KeyBinding | null {
  const normalizedKey = normalizeKeySequence(input.lhs, input.os);
  if (!normalizedKey) {
    return null;
  }

  const chords = normalizedKey.split(/\s+/).filter(Boolean);
  if (chords.length === 0) {
    return null;
  }

  const keyFromChord = (chord: string): string => {
    if (chord === '+') return '+';
    if (chord.endsWith('++')) return '+';
    const parts = chord.split('+').filter(Boolean);
    return (parts[parts.length - 1] ?? '').toLowerCase();
  };

  const primaryKey = chords[0] ?? '';
  const secondaryChords: KeyChord[] = chords.slice(1).map((chord) => ({
    key: keyFromChord(chord),
    modifiers: modifiersFromChord(chord),
  }));

  return {
    key: keyFromChord(primaryKey),
    command: normalizeCommand(input.rhs),
    when: whenFromModes(input.modes),
    modifiers: modifiersFromChord(primaryKey),
    chords: secondaryChords,
    sourceEditor: input.sourceEditor,
  };
}

function normalizeKeySequence(lhs: string, os: OS): string {
  const chunks = lhs.trim().split(/\s+/).filter(Boolean);
  const sequence: string[] = [];

  for (const chunk of chunks) {
    const normalizedChunk = normalizeChunk(chunk, os);
    if (!normalizedChunk) {
      continue;
    }
    sequence.push(...normalizedChunk.split(/\s+/).filter(Boolean));
  }

  return sequence.join(' ');
}

function normalizeChunk(chunk: string, os: OS): string {
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < chunk.length) {
    const char = chunk[cursor];
    if (char === '<') {
      const closeIndex = chunk.indexOf('>', cursor + 1);
      if (closeIndex > cursor + 1) {
        const token = chunk.slice(cursor, closeIndex + 1);
        const normalized = normalizeBracketToken(token, os);
        if (normalized) {
          parts.push(normalized);
        }
        cursor = closeIndex + 1;
        continue;
      }
    }

    let nextTokenIndex = chunk.indexOf('<', cursor);
    if (nextTokenIndex === -1) {
      nextTokenIndex = chunk.length;
    }

    if (nextTokenIndex === cursor) {
      const literal = normalizeLiteralToken(chunk[cursor] ?? '');
      if (literal) {
        parts.push(literal);
      }
      cursor += 1;
      continue;
    }

    const literal = normalizeLiteralToken(chunk.slice(cursor, nextTokenIndex));
    if (literal) {
      parts.push(literal);
    }
    cursor = nextTokenIndex;
  }

  return parts.join(' ');
}

function normalizeBracketToken(token: string, os: OS): string {
  const inner = token.slice(1, -1).trim();
  if (!inner) {
    return '';
  }

  const segments = inner.split('-').filter(Boolean);
  if (segments.length <= 1) {
    return normalizeSpecialKey(segments[0] ?? inner);
  }

  const modifiers: KeyModifier[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    const modifier = modifierFromToken(segments[index] ?? '', os);
    if (!modifier) {
      return normalizeSpecialKey(inner);
    }
    modifiers.push(modifier);
  }

  const key = normalizeSpecialKey(segments[segments.length - 1] ?? '');
  if (!key) {
    return '';
  }

  const dedupedModifiers = uniqueModifiers(modifiers);
  if (dedupedModifiers.length === 0) {
    return key;
  }

  return `${dedupedModifiers.join('+')}+${key}`;
}

function normalizeSpecialKey(token: string): string {
  const normalized = token.trim().toLowerCase();
  return normalized;
}

function normalizeLiteralToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.toLowerCase();
}

function modifierFromToken(token: string, _os: OS): KeyModifier | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'c' || normalized === 'ctrl' || normalized === 'control') {
    return normalized;
  }

  if (normalized === 's' || normalized === 'shift') {
    return normalized;
  }

  if (normalized === 'a' || normalized === 'alt') {
    return normalized;
  }

  if (normalized === 'm' || normalized === 'meta') {
    return normalized;
  }

  if (normalized === 'd' || normalized === 'cmd' || normalized === 'command') {
    return normalized;
  }

  if (normalized === 'super') {
    return 'super';
  }

  if (normalized === 'fn') {
    return 'fn';
  }

  if (normalized === 'opt' || normalized === 'option') {
    return normalized;
  }

  return null;
}

function modifiersFromChord(chord: string): KeyModifier[] {
  const parts = chord.split('+').map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (parts.length <= 1) {
    return [];
  }

  const modifiers: KeyModifier[] = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    const modifier = partToModifier(parts[index] ?? '');
    if (modifier) {
      modifiers.push(modifier);
    }
  }

  return uniqueModifiers(modifiers);
}

function partToModifier(part: string): KeyModifier | null {
  if (part === 'control') {
    return 'control';
  }
  if (part === 'ctrl') {
    return 'ctrl';
  }
  if (part === 'c') {
    return 'c';
  }
  if (part === 'alt') {
    return 'alt';
  }
  if (part === 'a') {
    return 'a';
  }
  if (part === 'shift') {
    return 'shift';
  }
  if (part === 's') {
    return 's';
  }
  if (part === 'meta') {
    return 'meta';
  }
  if (part === 'm') {
    return 'm';
  }
  if (part === 'cmd') {
    return 'cmd';
  }
  if (part === 'd') {
    return 'd';
  }
  if (part === 'super') {
    return 'super';
  }
  if (part === 'opt') {
    return 'opt';
  }
  if (part === 'option') {
    return 'option';
  }
  if (part === 'command') {
    return 'command';
  }
  if (part === 'fn') {
    return 'fn';
  }
  return null;
}

function uniqueModifiers(modifiers: KeyModifier[]): KeyModifier[] {
  return Array.from(new Set(modifiers));
}

function normalizeCommand(rhs: string): string {
  let normalized = rhs.trim();
  if (!normalized) {
    return rhs;
  }

  if (normalized.startsWith(':')) {
    normalized = normalized.slice(1).trim();
  }

  normalized = normalized.replace(/^<cmd>/i, '').trim();
  normalized = normalized.replace(/(?:<cr>)+$/i, '').trim();

  return normalized || rhs.trim();
}

function whenFromModes(modes: string[]): string {
  const uniqueModes = Array.from(new Set(modes));
  if (uniqueModes.length === 0) {
    return '';
  }
  if (uniqueModes.length === 1) {
    return `mode=${uniqueModes[0]}`;
  }
  return `mode in [${uniqueModes.join(',')}]`;
}

function modesFromVimCommand(command: string): string[] {
  const normalized = command.toLowerCase();
  if (normalized === 'map' || normalized === 'noremap') {
    return ['normal', 'visual', 'select', 'operator'];
  }
  if (normalized === 'map!' || normalized === 'noremap!') {
    return ['insert', 'command'];
  }

  const mode = MODE_BY_CHAR[normalized[0] ?? ''];
  return mode ? [mode] : ['normal'];
}

function modesFromLuaArgument(argument: string): string[] {
  const trimmed = argument.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const modes: string[] = [];
    const modeValueRegex = /['"]([^'"]+)['"]/g;
    let modeMatch = modeValueRegex.exec(trimmed);
    while (modeMatch) {
      modes.push(...modesFromModeToken(modeMatch[1] ?? ''));
      modeMatch = modeValueRegex.exec(trimmed);
    }
    return Array.from(new Set(modes));
  }

  return modesFromModeToken(decodeLuaValue(trimmed));
}

function modesFromModeToken(modeToken: string): string[] {
  const normalized = modeToken.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const modes: string[] = [];
  for (const modeChar of normalized) {
    const mode = MODE_BY_CHAR[modeChar];
    if (mode) {
      modes.push(mode);
    }
  }

  return Array.from(new Set(modes));
}

function isVimOptionToken(token: string): boolean {
  return VIMSCRIPT_OPTION_TOKENS.has(token.toLowerCase());
}

function isVimOptionTokenSequence(token: string): boolean {
  const optionTokens = token.match(/<[^>]+>/g);
  if (!optionTokens || optionTokens.join('') !== token) {
    return false;
  }
  return optionTokens.every((optionToken) => isVimOptionToken(optionToken));
}

function findLuaCalls(content: string, callName: string): LuaCallMatch[] {
  const matches: LuaCallMatch[] = [];
  let index = 0;

  while (index < content.length) {
    const callIndex = content.indexOf(callName, index);
    if (callIndex === -1) {
      break;
    }

    const charBefore = content[callIndex - 1] ?? '';
    if (charBefore && /[\w.]/.test(charBefore)) {
      index = callIndex + callName.length;
      continue;
    }

    let openParenIndex = callIndex + callName.length;
    while (openParenIndex < content.length && /\s/.test(content[openParenIndex] ?? '')) {
      openParenIndex += 1;
    }

    if (content[openParenIndex] !== '(') {
      index = callIndex + callName.length;
      continue;
    }

    const closeParenIndex = findMatchingParenthesis(content, openParenIndex);
    if (closeParenIndex === -1) {
      index = openParenIndex + 1;
      continue;
    }

    const args = content.slice(openParenIndex + 1, closeParenIndex);
    matches.push({
      args,
      line: lineNumberAt(content, callIndex),
    });

    index = closeParenIndex + 1;
  }

  return matches;
}

function findMatchingParenthesis(source: string, openParenIndex: number): number {
  let parenthesisDepth = 0;
  let quote: '"' | '\'' | null = null;

  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index] ?? '';
    const previous = source[index - 1] ?? '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    const longStringEnd = findLuaLongStringEnd(source, index);
    if (longStringEnd !== -1) {
      index = longStringEnd;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '(') {
      parenthesisDepth += 1;
      continue;
    }

    if (char === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitLuaArguments(argsSource: string): string[] {
  const args: string[] = [];
  let tokenStart = 0;
  let parenthesisDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let quote: '"' | '\'' | null = null;

  for (let index = 0; index < argsSource.length; index += 1) {
    const char = argsSource[index] ?? '';
    const previous = argsSource[index - 1] ?? '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    const longStringEnd = findLuaLongStringEnd(argsSource, index);
    if (longStringEnd !== -1) {
      index = longStringEnd;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '(') {
      parenthesisDepth += 1;
      continue;
    }
    if (char === ')') {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === ',' && parenthesisDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      const token = argsSource.slice(tokenStart, index).trim();
      if (token) {
        args.push(token);
      }
      tokenStart = index + 1;
    }
  }

  const lastToken = argsSource.slice(tokenStart).trim();
  if (lastToken) {
    args.push(lastToken);
  }

  return args;
}

function findLuaLongStringEnd(source: string, index: number): number {
  if (source[index] !== '[') {
    return -1;
  }

  let probe = index + 1;
  while (probe < source.length && source[probe] === '=') {
    probe += 1;
  }

  if (source[probe] !== '[') {
    return -1;
  }

  const equalsCount = probe - index - 1;
  const closing = `]${'='.repeat(equalsCount)}]`;
  const endIndex = source.indexOf(closing, probe + 1);
  if (endIndex === -1) {
    return source.length - 1;
  }

  return endIndex + closing.length - 1;
}

function decodeLuaValue(argument: string): string {
  const trimmed = argument.trim();
  if (!trimmed) {
    return '';
  }

  const longStringMatch = trimmed.match(/^\[(=*)\[([\s\S]*)\]\1\]$/);
  if (longStringMatch) {
    return (longStringMatch[2] ?? '').trim();
  }

  const quote = trimmed[0];
  if ((quote === '"' || quote === '\'') && trimmed.endsWith(quote)) {
    return unescapeLuaString(trimmed.slice(1, -1));
  }

  return trimmed;
}

function unescapeLuaString(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1;
    }
  }
  return line;
}
