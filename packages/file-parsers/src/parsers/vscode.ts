// vscode.ts — Parses VS Code keybindings.json (JSONC) into normalized KeyBinding records.
// Handles chord sequences, OS-specific key expressions, and schema-safe output.
import {
  getLocation,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type ParseError,
} from 'jsonc-parser';
import type { OS } from '../schemas/enums';
import type { KeyBinding } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';
import {
  BASE_MODIFIER_ALIASES,
  splitPlusShortcutTokens,
} from '../utils/modifier-aliases';

type ParsedStroke = {
  key: string;
  modifiers: string[];
};

const VSCODE_MODIFIER_TOKENS = new Set([
  ...Object.keys(BASE_MODIFIER_ALIASES),
  'ctrlcmd',
  'cmdorctrl',
  'ctrlorcmd',
  'winctrl',
]);

export function parseVSCode(content: string, os: OS): ParseResult {
  const warnings: ParseWarning[] = [];
  const parseErrors: ParseError[] = [];
  const rootNode = parseTree(content, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  for (const parseError of parseErrors) {
    const parseErrorLabel = printParseErrorCode(parseError.error);
    addWarning(
      warnings,
      `Failed to parse VS Code keybindings JSONC: ${parseErrorLabel}`,
      `VSCODE_JSONC_${parseErrorLabel.toUpperCase()}`,
      offsetToLine(content, parseError.offset)
    );
  }

  if (!rootNode) {
    return buildParseResult([], warnings);
  }

  const rawRootValue = getNodeValue(rootNode);
  if (!Array.isArray(rawRootValue) || rootNode.type !== 'array') {
    addWarning(
      warnings,
      'VS Code keybindings root must be an array',
      'VSCODE_ROOT_NOT_ARRAY',
      offsetToLine(content, rootNode.offset)
    );
    return buildParseResult([], warnings);
  }

  const bindings: KeyBinding[] = [];

  for (let index = 0; index < rawRootValue.length; index += 1) {
    const rawBinding = rawRootValue[index];
    const node = rootNode.children?.[index];
    const line = node ? offsetToLine(content, node.offset) : undefined;
    const parsedBinding = parseBinding(rawBinding, os, warnings, line);
    if (parsedBinding) {
      bindings.push(parsedBinding);
    }
  }

  return buildParseResult(bindings, warnings);
}

function parseBinding(
  rawBinding: unknown,
  os: OS,
  warnings: ParseWarning[],
  line?: number
): KeyBinding | null {
  if (!isRecord(rawBinding)) {
    addWarning(warnings, 'Skipping non-object keybinding entry', 'VSCODE_ENTRY_NOT_OBJECT', line);
    return null;
  }

  const command = normalizeCommand(rawBinding.command);
  if (!command) {
    addWarning(
      warnings,
      'Skipping keybinding entry without a valid command',
      'VSCODE_COMMAND_INVALID',
      line
    );
    return null;
  }

  const keyExpression = resolveKeyExpression(rawBinding, os);
  if (!keyExpression) {
    addWarning(warnings, 'Skipping keybinding entry without a valid key', 'VSCODE_KEY_MISSING', line);
    return null;
  }

  const parsedStrokes = parseKeyExpression(keyExpression);
  if (!parsedStrokes) {
    addWarning(
      warnings,
      `Skipping keybinding with unsupported key expression: ${keyExpression}`,
      'VSCODE_KEY_EXPRESSION_INVALID',
      line
    );
    return null;
  }

  const [primaryStroke, ...remainingStrokes] = parsedStrokes;

  return {
    key: primaryStroke.key,
    command,
    when: normalizeWhen(rawBinding.when),
    modifiers: primaryStroke.modifiers,
    chords: remainingStrokes.map((stroke) => ({
      key: stroke.key,
      modifiers: stroke.modifiers,
    })),
    sourceEditor: 'vscode',
  };
}

function parseKeyExpression(keyExpression: string): ParsedStroke[] | null {
  const strokeTexts = keyExpression
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (strokeTexts.length === 0) {
    return null;
  }

  const strokes: ParsedStroke[] = [];
  for (const strokeText of strokeTexts) {
    const stroke = parseStroke(strokeText);
    if (!stroke) {
      return null;
    }
    strokes.push(stroke);
  }

  return strokes;
}

function parseStroke(strokeText: string): ParsedStroke | null {
  const { modifierTokens, keyToken } = splitPlusShortcutTokens(strokeText);

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

  const normalizedKey = keyToken.trim().toLowerCase();
  if (!normalizedKey) {
    return null;
  }

  if (normalizeModifier(normalizedKey)) {
    return null;
  }

  return {
    key: normalizedKey,
    modifiers,
  };
}

function normalizeModifier(token: string): string | null {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) {
    return null;
  }

  if (VSCODE_MODIFIER_TOKENS.has(normalizedToken)) {
    return normalizedToken;
  }

  return null;
}

function resolveKeyExpression(rawBinding: Record<string, unknown>, os: OS): string | null {
  const platformKey =
    os === 'macos' ? rawBinding.mac : os === 'windows' ? rawBinding.win : rawBinding.linux;

  if (typeof platformKey === 'string') {
    const trimmed = platformKey.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (typeof rawBinding.key !== 'string') {
    return null;
  }

  const trimmed = rawBinding.key.trim();
  return trimmed || null;
}

function normalizeCommand(command: unknown): string | null {
  if (typeof command !== 'string') {
    return null;
  }

  const trimmed = command.trim();
  if (!trimmed || trimmed === '-') {
    return null;
  }

  return trimmed;
}

function normalizeWhen(when: unknown): string {
  return typeof when === 'string' ? when.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function offsetToLine(content: string, offset: number): number {
  const location = getLocation(content, offset) as { line?: number };
  return typeof location.line === 'number' ? location.line + 1 : 1;
}

function addWarning(
  warnings: ParseWarning[],
  message: string,
  code: string,
  line?: number
): void {
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
        }
  );
}

function buildParseResult(bindings: KeyBinding[], warnings: ParseWarning[]): ParseResult {
  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'vscode',
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}
