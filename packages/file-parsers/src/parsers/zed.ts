// zed.ts — Parses Zed keymap.json (JSONC) into normalized KeyBinding records.
// Handles context blocks, multi-chord sequences, and schema-safe output.
// Zed uses hyphen (-) as the modifier separator (e.g. "ctrl-a", "ctrl--", "ctrl-+").
// Chord tokens are never split on "+" to preserve it as a literal key character.
import { KeyBinding, KeyChord } from '../schemas/keyBinding';
import { ParseResult as ParseResultSchema, ParseResult, ParseWarning } from '../schemas/parseResult';
import { getLocation, parse, type ParseError, printParseErrorCode } from 'jsonc-parser';
import type { OS } from '../schemas/enums';
import {
  BASE_MODIFIER_ALIASES,
} from '../utils/modifier-aliases';

const ZED_MODIFIER_TOKENS = new Set([
  ...Object.keys(BASE_MODIFIER_ALIASES),
  'mod',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeModifier(token: string): string | null {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) {
    return null;
  }

  return ZED_MODIFIER_TOKENS.has(normalizedToken) ? normalizedToken : null;
}

function sortUniqueModifiers(modifiers: string[]): string[] {
  return Array.from(new Set(modifiers));
}

function normalizeChordKey(keyToken: string): string {
  return keyToken.trim().toLowerCase();
}

function parseChord(chordText: string): KeyChord | null {
  const normalizedChord = chordText.trim().toLowerCase();
  if (!normalizedChord) {
    return null;
  }

  const parts = normalizedChord
    .split('-')
    .map((part) => part.trim());

  if (parts.length === 0) {
    return null;
  }

  const modifiers: string[] = [];
  let tokenIndex = 0;

  while (tokenIndex < parts.length - 1) {
    const modifier = normalizeModifier(parts[tokenIndex] ?? '');
    if (!modifier) {
      break;
    }

    modifiers.push(modifier);
    tokenIndex += 1;
  }

  const rawKey = (tokenIndex === 0 ? normalizedChord : parts.slice(tokenIndex).join('-')).trim();
  const key = normalizeChordKey(rawKey);
  if (!key) {
    return null;
  }

  return {
    key,
    modifiers: sortUniqueModifiers(modifiers),
  };
}

function parseShortcut(shortcut: string): KeyChord[] | null {
  const chordTokens = shortcut
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (chordTokens.length === 0) {
    return null;
  }

  const chords: KeyChord[] = [];
  for (const chordToken of chordTokens) {
    const chord = parseChord(chordToken);
    if (!chord) {
      return null;
    }

    chords.push(chord);
  }

  return chords;
}

function resolveCommand(rawCommand: unknown): string | null | undefined {
  if (rawCommand === null) {
    return null;
  }

  if (typeof rawCommand === 'string') {
    const command = rawCommand.trim();
    return command.length > 0 ? command : undefined;
  }

  if (Array.isArray(rawCommand) && rawCommand.length > 0 && typeof rawCommand[0] === 'string') {
    const command = rawCommand[0].trim();
    return command.length > 0 ? command : undefined;
  }

  if (isRecord(rawCommand) && typeof rawCommand.command === 'string') {
    const command = rawCommand.command.trim();
    return command.length > 0 ? command : undefined;
  }

  return undefined;
}

function createParseResult(bindings: KeyBinding[], warnings: ParseWarning[]): ParseResult {
  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'zed',
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

export function parseZed(content: string, _os: OS): ParseResult {
  const warnings: ParseWarning[] = [];
  const bindings: KeyBinding[] = [];
  const parseErrors: ParseError[] = [];

  const parsedKeymap = parse(content, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  for (const parseError of parseErrors) {
    const location = getLocation(content, parseError.offset) as { line?: number };
    const line = typeof location.line === 'number' ? location.line + 1 : undefined;
    warnings.push({
      code: 'ZED_JSONC_PARSE_ERROR',
      ...(line ? { line } : {}),
      message: `Failed to parse keymap JSONC: ${printParseErrorCode(parseError.error)}`,
    });
  }

  if (!Array.isArray(parsedKeymap)) {
    warnings.push({
      code: 'ZED_ROOT_NOT_ARRAY',
      message: 'Expected top-level keymap JSONC content to be an array of context blocks.',
    });
    return createParseResult(bindings, warnings);
  }

  for (let blockIndex = 0; blockIndex < parsedKeymap.length; blockIndex += 1) {
    const block = parsedKeymap[blockIndex];
    if (!isRecord(block)) {
      warnings.push({
        code: 'ZED_INVALID_BLOCK',
        message: `Skipped keymap block ${blockIndex + 1}: block must be an object.`,
      });
      continue;
    }

    const when = typeof block.context === 'string' ? block.context.trim() : '';
    if (!isRecord(block.bindings)) {
      warnings.push({
        code: 'ZED_INVALID_BINDINGS',
        message: `Skipped keymap block ${blockIndex + 1}: missing or invalid bindings object.`,
      });
      continue;
    }

    for (const [shortcut, rawCommand] of Object.entries(block.bindings)) {
      const normalizedShortcut = shortcut.trim();
      if (!normalizedShortcut) {
        warnings.push({
          code: 'ZED_EMPTY_SHORTCUT',
          message: `Skipped keymap block ${blockIndex + 1}: encountered an empty shortcut key.`,
        });
        continue;
      }

      const command = resolveCommand(rawCommand);
      if (command === null) {
        continue;
      }

      if (!command) {
        warnings.push({
          code: 'ZED_INVALID_COMMAND',
          message: `Skipped shortcut "${normalizedShortcut}" in block ${blockIndex + 1}: command is not a supported format.`,
        });
        continue;
      }

      const parsedChords = parseShortcut(normalizedShortcut);
      if (!parsedChords || parsedChords.length === 0) {
        warnings.push({
          code: 'ZED_INVALID_SHORTCUT',
          message: `Skipped shortcut "${normalizedShortcut}" in block ${blockIndex + 1}: unable to parse chord sequence.`,
        });
        continue;
      }

      const [firstChord, ...remainingChords] = parsedChords;
      bindings.push({
        key: firstChord.key,
        command,
        when,
        modifiers: firstChord.modifiers,
        chords: remainingChords,
        sourceEditor: 'zed',
      });
    }
  }

  return createParseResult(bindings, warnings);
}
