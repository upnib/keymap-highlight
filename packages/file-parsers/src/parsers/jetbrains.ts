// jetbrains.ts — Parses JetBrains keymap XML into normalized KeyBinding records.
// Handles OS-specific keymap selection, two-stroke shortcuts, and schema-safe output.
// JetBrains uses Java KeyEvent names (e.g. PERIOD, OPEN_BRACKET, BACK_QUOTE) which are
// preserved as raw lowercased key tokens for downstream layout-pipeline normalization.
import { XMLParser } from 'fast-xml-parser';
import { KeyBinding, type KeyBinding as KeyBindingType, type KeyChord } from '../schemas/keyBinding';
import { ParseResult, type ParseResult as ParseResultType, type ParseWarning } from '../schemas/parseResult';
import { BASE_MODIFIER_ALIASES } from '../utils/modifier-aliases';

export type OS = 'windows' | 'macos' | 'linux';

const JETBRAINS_MODIFIER_TOKENS = new Set([
  ...Object.keys(BASE_MODIFIER_ALIASES),
  'altgraph',
]);

const OS_HINTS: Record<OS, string[]> = {
  windows: ['windows', 'xwin', 'win'],
  macos: ['macos', 'os x', 'mac'],
  linux: ['linux'],
};

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function makeWarning(message: string, code?: string): ParseWarning {
  if (code) {
    return { message, code };
  }

  return { message };
}

function collectKeymaps(
  node: unknown,
  keymaps: Record<string, unknown>[],
  visited: Set<unknown>
): void {
  if (node === null || node === undefined) {
    return;
  }

  if (visited.has(node)) {
    return;
  }

  if (Array.isArray(node)) {
    visited.add(node);
    for (const item of node) {
      collectKeymaps(item, keymaps, visited);
    }
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  visited.add(node);

  if (Object.prototype.hasOwnProperty.call(node, 'keymap')) {
    for (const keymapNode of asArray(node.keymap)) {
      if (isRecord(keymapNode)) {
        keymaps.push(keymapNode);
      }
    }
  }

  for (const value of Object.values(node)) {
    collectKeymaps(value, keymaps, visited);
  }
}

function scoreKeymapForOs(keymap: Record<string, unknown>, os: OS): number {
  const keymapName = getNonEmptyString(keymap.name)?.toLowerCase() ?? '';
  const parentName = getNonEmptyString(keymap.parent)?.toLowerCase() ?? '';
  const haystack = `${keymapName} ${parentName}`;

  return OS_HINTS[os].reduce((score, hint) => {
    return haystack.includes(hint) ? score + hint.length : score;
  }, 0);
}

function pickKeymap(keymaps: Record<string, unknown>[], os: OS): Record<string, unknown> | undefined {
  if (keymaps.length === 0) {
    return undefined;
  }

  let selectedKeymap = keymaps[0];
  let selectedScore = scoreKeymapForOs(selectedKeymap, os);

  for (let index = 1; index < keymaps.length; index += 1) {
    const candidate = keymaps[index];
    const candidateScore = scoreKeymapForOs(candidate, os);

    if (candidateScore > selectedScore) {
      selectedKeymap = candidate;
      selectedScore = candidateScore;
    }
  }

  return selectedKeymap;
}

function normalizeKeyToken(token: string): string {
  return token.trim().toLowerCase();
}

function parseKeystroke(
  keystroke: string
): {
  key: string;
  modifiers: string[];
} | null {
  const tokens = keystroke
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return null;
  }

  const modifiers = new Set<string>();
  const keyTokens: string[] = [];

  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    if (JETBRAINS_MODIFIER_TOKENS.has(normalizedToken)) {
      modifiers.add(normalizedToken);
      continue;
    }

    if (normalizedToken === 'typed' || normalizedToken === 'pressed' || normalizedToken === 'released') {
      continue;
    }

    keyTokens.push(token);
  }

  const keyToken = keyTokens[keyTokens.length - 1];
  if (!keyToken) {
    return null;
  }

  const key = normalizeKeyToken(keyToken);
  if (!key) {
    return null;
  }

  return {
    key,
    modifiers: Array.from(modifiers),
  };
}

function buildParseResult(
  bindings: KeyBindingType[],
  warnings: ParseWarning[],
  sourceName: string | undefined,
  parsedAt: string
): ParseResultType {
  const metadata: ParseResultType['metadata'] = {
    sourceEditor: 'jetbrains',
    parsedAt,
    totalBindings: bindings.length,
    totalWarnings: warnings.length,
  };

  if (sourceName) {
    metadata.sourceName = sourceName;
  }

  return ParseResult.parse({
    bindings,
    warnings,
    metadata,
  });
}

export function parseJetBrains(content: string, os: OS): ParseResultType {
  const warnings: ParseWarning[] = [];
  const bindings: KeyBindingType[] = [];
  const parsedAt = new Date().toISOString();

  if (content.trim().length === 0) {
    warnings.push(makeWarning('JetBrains keymap content is empty.', 'EMPTY_CONTENT'));
    return buildParseResult(bindings, warnings, undefined, parsedAt);
  }

  let parsedXml: unknown;

  try {
    parsedXml = XML_PARSER.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse XML content.';
    warnings.push(makeWarning(`JetBrains XML parse failed: ${message}`, 'INVALID_XML'));
    return buildParseResult(bindings, warnings, undefined, parsedAt);
  }

  const keymaps: Record<string, unknown>[] = [];
  collectKeymaps(parsedXml, keymaps, new Set<unknown>());

  const keymap = pickKeymap(keymaps, os);
  if (!keymap) {
    warnings.push(makeWarning('No <keymap> node was found in JetBrains XML content.', 'NO_KEYMAP'));
    return buildParseResult(bindings, warnings, undefined, parsedAt);
  }

  const sourceName = getNonEmptyString(keymap.name);
  const actionNodes = asArray(keymap.action);

  for (let actionIndex = 0; actionIndex < actionNodes.length; actionIndex += 1) {
    const actionNode = actionNodes[actionIndex];
    if (!isRecord(actionNode)) {
      warnings.push(makeWarning(`Skipped non-object action at index ${actionIndex}.`, 'INVALID_ACTION_NODE'));
      continue;
    }

    const actionId = getNonEmptyString(actionNode.id);
    if (!actionId) {
      warnings.push(makeWarning(`Skipped action at index ${actionIndex} without id.`, 'MISSING_ACTION_ID'));
      continue;
    }

    const shortcutNodes = asArray(actionNode['keyboard-shortcut']);
    for (let shortcutIndex = 0; shortcutIndex < shortcutNodes.length; shortcutIndex += 1) {
      const shortcutNode = shortcutNodes[shortcutIndex];

      if (!isRecord(shortcutNode)) {
        warnings.push(
          makeWarning(
            `Skipped non-object keyboard shortcut for action "${actionId}" at index ${shortcutIndex}.`,
            'INVALID_SHORTCUT_NODE'
          )
        );
        continue;
      }

      const firstKeystroke = getNonEmptyString(shortcutNode['first-keystroke']);
      if (!firstKeystroke) {
        warnings.push(
          makeWarning(
            `Skipped keyboard shortcut for action "${actionId}" missing first-keystroke.`,
            'MISSING_FIRST_KEYSTROKE'
          )
        );
        continue;
      }

      const firstChord = parseKeystroke(firstKeystroke);
      if (!firstChord) {
        warnings.push(
          makeWarning(
            `Skipped keyboard shortcut for action "${actionId}" with invalid first-keystroke "${firstKeystroke}".`,
            'INVALID_FIRST_KEYSTROKE'
          )
        );
        continue;
      }

      const chords: KeyChord[] = [];
      const secondKeystroke = getNonEmptyString(shortcutNode['second-keystroke']);

      if (secondKeystroke) {
        const secondChord = parseKeystroke(secondKeystroke);

        if (!secondChord) {
          warnings.push(
            makeWarning(
              `Skipped keyboard shortcut for action "${actionId}" with invalid second-keystroke "${secondKeystroke}".`,
              'INVALID_SECOND_KEYSTROKE'
            )
          );
          continue;
        }

        chords.push(secondChord);
      }

      const candidateBinding = {
        key: firstChord.key,
        command: actionId,
        when: '',
        modifiers: firstChord.modifiers,
        chords,
        sourceEditor: 'jetbrains' as const,
      };

      const validatedBinding = KeyBinding.safeParse(candidateBinding);
      if (!validatedBinding.success) {
        warnings.push(
          makeWarning(
            `Skipped keyboard shortcut for action "${actionId}" that failed schema validation.`,
            'INVALID_BINDING'
          )
        );
        continue;
      }

      bindings.push(validatedBinding.data);
    }
  }

  return buildParseResult(bindings, warnings, sourceName, parsedAt);
}
