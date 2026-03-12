// blender.ts - Parses Blender exported Python keyconfig files into normalized KeyBinding records.
// Safely reads the `keyconfig_data` literal without executing Python, preserving contexts,
// keyboard modifiers, and Blender-specific mouse or device triggers where possible.
import type { OS } from '../schemas/enums';
import { KeyBinding, type KeyBinding as KeyBindingType } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';
import {
  BASE_MODIFIER_ALIASES,
} from '../utils/modifier-aliases';

type PythonValue = string | number | boolean | null | PythonValue[] | { [key: string]: PythonValue };
type PythonObject = Record<string, PythonValue>;

type ParsedShortcut = {
  key: string;
  modifiers: string[];
  chords: KeyBindingType['chords'];
};

const BLENDER_MODIFIER_FLAGS = {
  ctrl: 'ctrl',
  shift: 'shift',
  alt: 'alt',
  oskey: 'meta',
  hyper: 'meta',
} as const;

const UNSUPPORTED_EVENT_KEYS = new Set([
  'mousemove',
  'textinput',
]);

const UNSUPPORTED_EVENT_PREFIXES = ['timer', 'actionzone_'] as const;

const CONTEXT_SPACE_SKIP = new Set(['EMPTY']);
const CONTEXT_REGION_SKIP = new Set(['WINDOW']);

export function parseBlender(content: string, _os: OS): ParseResult {
  const bindings: KeyBindingType[] = [];
  const warnings: ParseWarning[] = [];
  const parsedAt = new Date().toISOString();

  if (!content.trim()) {
    addWarning(warnings, 'Blender keymap content is empty.', 'BLENDER_EMPTY_CONTENT');
    return buildParseResult(bindings, warnings, parsedAt);
  }

  const parsedKeyconfigData = parseKeyconfigData(content);
  if (!parsedKeyconfigData.value) {
    addWarning(
      warnings,
      parsedKeyconfigData.error ?? 'Unable to parse Blender keyconfig_data export.',
      'BLENDER_KEYCONFIG_PARSE_FAILED',
    );
    return buildParseResult(bindings, warnings, parsedAt);
  }

  if (!Array.isArray(parsedKeyconfigData.value)) {
    addWarning(
      warnings,
      'Blender keyconfig_data must be a list of keymap entries.',
      'BLENDER_KEYCONFIG_INVALID_ROOT',
    );
    return buildParseResult(bindings, warnings, parsedAt);
  }

  for (const keymapEntry of parsedKeyconfigData.value) {
    const parsedEntry = parseKeymapEntry(keymapEntry);
    if (!parsedEntry) {
      addWarning(warnings, 'Skipped malformed Blender keymap entry.', 'BLENDER_KEYMAP_ENTRY_INVALID');
      continue;
    }

    const { contextWhen, items } = parsedEntry;
    for (const item of items) {
      const parsedBinding = parseBindingEntry(item, contextWhen, warnings);
      if (parsedBinding) {
        bindings.push(parsedBinding);
      }
    }
  }

  return buildParseResult(bindings, warnings, parsedAt);
}

function parseKeyconfigData(content: string): { value: PythonValue | null; error?: string } {
  const keyconfigLabelIndex = content.indexOf('keyconfig_data');
  if (keyconfigLabelIndex === -1) {
    return { value: null, error: 'Blender export is missing keyconfig_data.' };
  }

  const equalsIndex = content.indexOf('=', keyconfigLabelIndex);
  if (equalsIndex === -1) {
    return { value: null, error: 'Blender export is missing the keyconfig_data assignment.' };
  }

  let literalStart = equalsIndex + 1;
  while (literalStart < content.length && /\s/.test(content[literalStart] ?? '')) {
    literalStart += 1;
  }

  if (content[literalStart] === '\\') {
    literalStart += 1;
  }

  while (literalStart < content.length && /\s/.test(content[literalStart] ?? '')) {
    literalStart += 1;
  }

  const parser = new PythonLiteralParser(content, literalStart);

  try {
    return { value: parser.parseValue() };
  } catch (error) {
    const errorIndex = parser.getIndex();
    const line = content.slice(0, errorIndex).split(/\r?\n/).length;
    const message = error instanceof Error ? error.message : 'Unknown Blender literal parse error.';
    return {
      value: null,
      error: `Unable to parse Blender keyconfig_data export near line ${line}: ${message}`,
    };
  }
}

function parseKeymapEntry(value: PythonValue): { contextWhen: string; items: PythonValue[] } | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }

  const contextName = asString(value[0]);
  const contextInfo = asObject(value[1]);
  const contextPayload = asObject(value[2]);
  const items = Array.isArray(contextPayload?.items) ? contextPayload.items : null;

  if (!contextName || !items) {
    return null;
  }

  return {
    contextWhen: buildContextWhen(contextName, contextInfo),
    items,
  };
}

function buildContextWhen(contextName: string, contextInfo: PythonObject | null): string {
  const normalizedName = contextName.trim();
  const contextParts = [normalizedName];
  const spaceType = asString(contextInfo?.space_type)?.trim();
  const regionType = asString(contextInfo?.region_type)?.trim();

  if (spaceType && !CONTEXT_SPACE_SKIP.has(spaceType)) {
    contextParts.push(spaceType);
  }

  if (regionType && !CONTEXT_REGION_SKIP.has(regionType)) {
    contextParts.push(regionType);
  }

  if (contextParts.length === 1) {
    return normalizedName;
  }

  return `${normalizedName} [${contextParts.slice(1).join(' / ')}]`;
}

function parseBindingEntry(
  value: PythonValue,
  contextWhen: string,
  warnings: ParseWarning[],
): KeyBindingType | null {
  if (!Array.isArray(value) || value.length < 2) {
    addWarning(warnings, 'Skipped malformed Blender binding entry.', 'BLENDER_BINDING_ENTRY_INVALID');
    return null;
  }

  const command = asString(value[0]);
  const event = asObject(value[1]);

  if (!command || !event) {
    addWarning(warnings, 'Skipped Blender binding with missing command or event.', 'BLENDER_BINDING_MISSING_FIELDS');
    return null;
  }

  const parsedShortcut = buildShortcut(event);
  if (!parsedShortcut) {
    return null;
  }

  const parsedBinding = KeyBinding.safeParse({
    key: parsedShortcut.key,
    command,
    when: contextWhen,
    modifiers: parsedShortcut.modifiers,
    chords: parsedShortcut.chords,
    sourceEditor: 'blender' as const,
  });

  if (!parsedBinding.success) {
    addWarning(
      warnings,
      `Skipped Blender shortcut for action "${command}" due to schema validation failure.`,
      'BLENDER_BINDING_SCHEMA_INVALID',
    );
    return null;
  }

  return parsedBinding.data;
}

function buildShortcut(event: PythonObject): ParsedShortcut | null {
  const typeToken = asString(event.type);
  if (!typeToken) {
    return null;
  }

  const normalizedBaseKey = normalizeEventKey(typeToken);
  if (!normalizedBaseKey || isUnsupportedEventKey(normalizedBaseKey)) {
    return null;
  }

  const modifierSet = new Set<string>();
  for (const modifierKey of Object.keys(BLENDER_MODIFIER_FLAGS) as Array<keyof typeof BLENDER_MODIFIER_FLAGS>) {
    if (event[modifierKey] === true) {
      const modifierToken = BLENDER_MODIFIER_FLAGS[modifierKey];
      const normalizedModifier = BASE_MODIFIER_ALIASES[modifierToken] ?? modifierToken;
      modifierSet.add(normalizedModifier);
    }
  }

  const eventValue = asString(event.value) ?? 'PRESS';
  const keyModifier = normalizeEventKey(asString(event.key_modifier));
  const eventKey = appendEventValueSuffix(normalizedBaseKey, eventValue);
  const chords: KeyBindingType['chords'] = [];

  let primaryKey = eventKey;

  if (keyModifier && keyModifier !== eventKey) {
    if (shouldPromoteKeyModifier(normalizedBaseKey)) {
      primaryKey = keyModifier;
      chords.push({ key: eventKey, modifiers: [] });
    } else {
      chords.push({ key: keyModifier, modifiers: [] });
    }
  }

  return {
    key: primaryKey,
    modifiers: Array.from(modifierSet),
    chords,
  };
}

function normalizeEventKey(rawKey: string | undefined): string {
  const normalizedKey = rawKey?.trim().toLowerCase();
  if (!normalizedKey) {
    return '';
  }

  return normalizedKey;
}

function appendEventValueSuffix(key: string, value: string): string {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue || normalizedValue === 'press' || normalizedValue === 'any') {
    return key;
  }

  const valueSuffix = normalizedValue.replace(/\s+/g, '_');
  switch (valueSuffix) {
    case 'click_drag':
      return `${key}_drag`;
    case 'double_click':
      return `${key}_double_click`;
    default:
      return `${key}_${valueSuffix}`;
  }
}

function shouldPromoteKeyModifier(baseKey: string): boolean {
  return baseKey.includes('mouse')
    || baseKey.includes('trackpad')
    || baseKey.startsWith('ndof')
    || baseKey.startsWith('actionzone')
    || baseKey.startsWith('timer')
    || baseKey.startsWith('media_')
    || baseKey === 'eraser';
}

function isUnsupportedEventKey(key: string): boolean {
  if (UNSUPPORTED_EVENT_KEYS.has(key)) {
    return true;
  }

  return UNSUPPORTED_EVENT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function asString(value: PythonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asObject(value: PythonValue | undefined): PythonObject | null {
  return isPythonObject(value) ? value : null;
}

function isPythonObject(value: PythonValue | undefined): value is PythonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addWarning(warnings: ParseWarning[], message: string, code: string): void {
  warnings.push({ message, code });
}

function buildParseResult(bindings: KeyBindingType[], warnings: ParseWarning[], parsedAt: string): ParseResult {
  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'blender',
      parsedAt,
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

class PythonLiteralParser {
  private readonly source: string;

  private index: number;

  constructor(source: string, startIndex: number) {
    this.source = source;
    this.index = startIndex;
  }

  parseValue(): PythonValue {
    this.skipIgnored();

    const current = this.peek();
    if (!current) {
      throw new Error('Unexpected end of Blender keyconfig data.');
    }

    switch (current) {
      case '[':
        return this.parseArray(']');
      case '(':
        return this.parseArray(')');
      case '{':
        return this.parseBraceLiteral();
      case '"':
      case "'":
        return this.parseString();
      default:
        if (current === '-' || /[0-9]/.test(current)) {
          return this.parseNumber();
        }
        if (/[A-Za-z_]/.test(current)) {
          return this.parseIdentifier();
        }
        throw new Error(`Unexpected token ${current}`);
    }
  }

  private parseArray(terminator: ']' | ')'): PythonValue[] {
    const opener = terminator === ']' ? '[' : '(';
    this.expect(opener);
    const values: PythonValue[] = [];

    while (true) {
      this.skipIgnored();
      if (this.peek() === terminator) {
        this.index += 1;
        return values;
      }

      values.push(this.parseValue());
      this.skipIgnored();

      const current = this.peek();
      if (current === ',') {
        this.index += 1;
        continue;
      }
      if (current === terminator) {
        this.index += 1;
        return values;
      }

      throw new Error(`Expected "," or "${terminator}" in Blender array literal.`);
    }
  }

  private parseBraceLiteral(): PythonObject | PythonValue[] {
    this.expect('{');
    this.skipIgnored();
    if (this.peek() === '}') {
      this.index += 1;
      return {};
    }

    const firstValue = this.parseValue();
    this.skipIgnored();

    if (this.peek() !== ':') {
      return this.parseSetLiteral(firstValue);
    }

    const record: PythonObject = {};
    this.assignObjectEntry(record, firstValue);

    while (true) {
      this.skipIgnored();

      const current = this.peek();
      if (current === ',') {
        this.index += 1;
        this.skipIgnored();
        if (this.peek() === '}') {
          this.index += 1;
          return record;
        }

        const keyValue = this.parseValue();
        this.assignObjectEntry(record, keyValue);
        continue;
      }

      if (current === '}') {
        this.index += 1;
        return record;
      }

      throw new Error('Expected "," or "}" in Blender object literal.');
    }
  }

  private parseSetLiteral(firstValue: PythonValue): PythonValue[] {
    const values: PythonValue[] = [firstValue];

    while (true) {
      this.skipIgnored();

      const current = this.peek();
      if (current === ',') {
        this.index += 1;
        this.skipIgnored();
        if (this.peek() === '}') {
          this.index += 1;
          return values;
        }

        values.push(this.parseValue());
        continue;
      }
      if (current === '}') {
        this.index += 1;
        return values;
      }

      throw new Error('Expected "," or "}" in Blender set literal.');
    }
  }

  private assignObjectEntry(record: PythonObject, keyValue: PythonValue): void {
    const key = typeof keyValue === 'string' || typeof keyValue === 'number'
      ? String(keyValue)
      : null;

    if (key === null) {
      throw new Error('Unsupported Blender object key type.');
    }

    this.skipIgnored();
    this.expect(':');
    const value = this.parseValue();
    record[key] = value;
  }


  private parseString(): string {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      throw new Error('Expected string literal.');
    }

    this.index += 1;
    let result = '';

    while (this.index < this.source.length) {
      const current = this.source[this.index] ?? '';
      this.index += 1;

      if (current === quote) {
        return result;
      }

      if (current === '\\') {
        const escaped = this.source[this.index] ?? '';
        this.index += 1;

        switch (escaped) {
          case 'n':
            result += '\n';
            break;
          case 'r':
            result += '\r';
            break;
          case 't':
            result += '\t';
            break;
          case '\\':
          case '"':
          case "'":
            result += escaped;
            break;
          default:
            result += escaped;
            break;
        }
        continue;
      }

      result += current;
    }

    throw new Error('Unterminated Blender string literal.');
  }

  private parseNumber(): number {
    const rest = this.source.slice(this.index);
    const match = rest.match(/^-?\d+(?:\.\d+)?/);
    if (!match) {
      throw new Error('Invalid Blender numeric literal.');
    }

    this.index += match[0].length;
    return Number(match[0]);
  }

  private parseIdentifier(): PythonValue {
    const rest = this.source.slice(this.index);
    const match = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!match) {
      throw new Error('Invalid Blender identifier literal.');
    }

    this.index += match[0].length;

    switch (match[0]) {
      case 'True':
        return true;
      case 'False':
        return false;
      case 'None':
        return null;
      default:
        return match[0];
    }
  }

  private skipIgnored(): void {
    while (this.index < this.source.length) {
      const current = this.source[this.index] ?? '';
      if (/\s/.test(current)) {
        this.index += 1;
        continue;
      }

      if (current === '#') {
        while (this.index < this.source.length && (this.source[this.index] ?? '') !== '\n') {
          this.index += 1;
        }
        continue;
      }

      break;
    }
  }

  private expect(expected: string): void {
    if (this.peek() !== expected) {
      throw new Error(`Expected "${expected}".`);
    }
    this.index += 1;
  }

  getIndex(): number {
    return this.index;
  }

  private peek(): string | null {
    return this.source[this.index] ?? null;
  }
}
