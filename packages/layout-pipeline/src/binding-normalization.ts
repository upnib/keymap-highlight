// layout-pipeline/src/binding-normalization.ts - Canonical key/modifier normalization for parsed
// bindings before layout mapping and UI consumption. Centralizes token cleanup in layout-pipeline
// so downstream consumers use one normalization path regardless of parser-specific source syntax.
import type { ParseResult } from '@keymap-highlight/file-parsers';
import { normalizeBindingModifiers } from './modifier-aliases';
import type { SupportedOs } from './types';

const DIGIT_PREFIX_RE = /^digit([0-9])$/;

const DIRECT_KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  escape: 'escape',
  ret: 'enter',
  return: 'enter',
  cr: 'enter',
  enter: 'enter',
  bs: 'backspace',
  bksp: 'backspace',
  backspace: 'backspace',
  back_space: 'backspace',
  del: 'delete',
  delete: 'delete',
  ins: 'insert',
  insert: 'insert',
  pgup: 'pageup',
  pageup: 'pageup',
  page_up: 'pageup',
  pgdn: 'pagedown',
  pgdown: 'pagedown',
  pagedown: 'pagedown',
  page_down: 'pagedown',
  up: 'up',
  arrowup: 'up',
  up_arrow: 'up',
  down: 'down',
  arrowdown: 'down',
  down_arrow: 'down',
  left: 'left',
  arrowleft: 'left',
  left_arrow: 'left',
  right: 'right',
  arrowright: 'right',
  right_arrow: 'right',
  space: 'space',
  spc: 'space',
  spacebar: 'space',
  tab: 'tab',
  home: 'home',
  end: 'end',
  caps: 'capslock',
  capslock: 'capslock',
  print: 'printscreen',
  printscreen: 'printscreen',
  prtsc: 'printscreen',
  prtscr: 'printscreen',
  scroll: 'scrolllock',
  scrolllock: 'scrolllock',
  break: 'pause',
  pause: 'pause',
  app: 'menu',
  apps: 'menu',
  context: 'menu',
  menu: 'menu',
  lt: '<',
  minus: '-',
  hyphen: '-',
  equal: '=',
  equals: '=',
  plus: '+',
  slash: '/',
  forwardslash: '/',
  forward_slash: '/',
  backslash: '\\',
  back_slash: '\\',
  semicolon: ';',
  semi_colon: ';',
  apostrophe: "'",
  quote: "'",
  comma: ',',
  period: '.',
  backquote: '`',
  back_quote: '`',
  accent_grave: '`',
  grave: '`',
  openbracket: '[',
  open_bracket: '[',
  left_bracket: '[',
  closebracket: ']',
  close_bracket: ']',
  right_bracket: ']',
  oem_1: ';',
  oem_2: '/',
  oem_3: '`',
  oem_7: "'",
  oem_comma: ',',
  oem_period: '.',
  oem_minus: '-',
  oem_plus: '=',
  ctrl: 'ctrl',
  control: 'ctrl',
  ctl: 'ctrl',
  left_ctrl: 'ctrl',
  right_ctrl: 'ctrl',
  shift: 'shift',
  left_shift: 'shift',
  right_shift: 'shift',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  altgr: 'alt',
  left_alt: 'alt',
  right_alt: 'alt',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  win: 'meta',
  windows: 'meta',
  gui: 'meta',
  hyper: 'meta',
  oskey: 'meta',
  fn: 'fn',
  numlock: 'numlock',
  multiply: 'numpadmultiply',
  add: 'numpadadd',
  subtract: 'numpadsubtract',
  divide: 'numpaddivide',
  decimal: 'numpaddecimal',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const NUMPAD_DIGIT_ALIASES: Readonly<Record<string, string>> = {
  numpad0: 'numpad0',
  numpad1: 'numpad1',
  numpad2: 'numpad2',
  numpad3: 'numpad3',
  numpad4: 'numpad4',
  numpad5: 'numpad5',
  numpad6: 'numpad6',
  numpad7: 'numpad7',
  numpad8: 'numpad8',
  numpad9: 'numpad9',
  numpad_0: 'numpad0',
  numpad_1: 'numpad1',
  numpad_2: 'numpad2',
  numpad_3: 'numpad3',
  numpad_4: 'numpad4',
  numpad_5: 'numpad5',
  numpad_6: 'numpad6',
  numpad_7: 'numpad7',
  numpad_8: 'numpad8',
  numpad_9: 'numpad9',
  num0: 'numpad0',
  num1: 'numpad1',
  num2: 'numpad2',
  num3: 'numpad3',
  num4: 'numpad4',
  num5: 'numpad5',
  num6: 'numpad6',
  num7: 'numpad7',
  num8: 'numpad8',
  num9: 'numpad9',
  num_0: 'numpad0',
  num_1: 'numpad1',
  num_2: 'numpad2',
  num_3: 'numpad3',
  num_4: 'numpad4',
  num_5: 'numpad5',
  num_6: 'numpad6',
  num_7: 'numpad7',
  num_8: 'numpad8',
  num_9: 'numpad9',
  kp0: 'numpad0',
  kp1: 'numpad1',
  kp2: 'numpad2',
  kp3: 'numpad3',
  kp4: 'numpad4',
  kp5: 'numpad5',
  kp6: 'numpad6',
  kp7: 'numpad7',
  kp8: 'numpad8',
  kp9: 'numpad9',
  'kp-0': 'numpad0',
  'kp-1': 'numpad1',
  'kp-2': 'numpad2',
  'kp-3': 'numpad3',
  'kp-4': 'numpad4',
  'kp-5': 'numpad5',
  'kp-6': 'numpad6',
  'kp-7': 'numpad7',
  'kp-8': 'numpad8',
  'kp-9': 'numpad9',
  kp_0: 'numpad0',
  kp_1: 'numpad1',
  kp_2: 'numpad2',
  kp_3: 'numpad3',
  kp_4: 'numpad4',
  kp_5: 'numpad5',
  kp_6: 'numpad6',
  kp_7: 'numpad7',
  kp_8: 'numpad8',
  kp_9: 'numpad9',
  k0: 'numpad0',
  k1: 'numpad1',
  k2: 'numpad2',
  k3: 'numpad3',
  k4: 'numpad4',
  k5: 'numpad5',
  k6: 'numpad6',
  k7: 'numpad7',
  k8: 'numpad8',
  k9: 'numpad9',
};

const NUMPAD_SPECIAL_ALIASES: Readonly<Record<string, string>> = {
  numpadadd: 'numpadadd',
  numpad_add: 'numpadadd',
  numpadplus: 'numpadadd',
  'numpad+': 'numpadadd',
  numplus: 'numpadadd',
  'num+': 'numpadadd',
  kpadd: 'numpadadd',
  'kp-add': 'numpadadd',
  'kp+': 'numpadadd',
  kplus: 'numpadadd',
  'k+': 'numpadadd',
  numpadsubtract: 'numpadsubtract',
  numpad_subtract: 'numpadsubtract',
  numpadminus: 'numpadsubtract',
  'numpad-': 'numpadsubtract',
  numminus: 'numpadsubtract',
  'num-': 'numpadsubtract',
  kpsubtract: 'numpadsubtract',
  'kp-subtract': 'numpadsubtract',
  kminus: 'numpadsubtract',
  numpadmultiply: 'numpadmultiply',
  numpad_multiply: 'numpadmultiply',
  numpadasterisk: 'numpadmultiply',
  numpad_asterix: 'numpadmultiply',
  'numpad*': 'numpadmultiply',
  numasterisk: 'numpadmultiply',
  'num*': 'numpadmultiply',
  kpmultiply: 'numpadmultiply',
  'kp-multiply': 'numpadmultiply',
  kmultiply: 'numpadmultiply',
  numpaddivide: 'numpaddivide',
  numpad_divide: 'numpaddivide',
  numpadslash: 'numpaddivide',
  'numpad/': 'numpaddivide',
  'num/': 'numpaddivide',
  kpdivide: 'numpaddivide',
  'kp-divide': 'numpaddivide',
  kdivide: 'numpaddivide',
  numpaddecimal: 'numpaddecimal',
  numpad_decimal: 'numpaddecimal',
  numpadpoint: 'numpaddecimal',
  numpad_period: 'numpaddecimal',
  'numpad.': 'numpaddecimal',
  numdecimal: 'numpaddecimal',
  num_decimal: 'numpaddecimal',
  'num.': 'numpaddecimal',
  kpdecimal: 'numpaddecimal',
  'kp-decimal': 'numpaddecimal',
  kpoint: 'numpaddecimal',
  numpadenter: 'numpadenter',
  numpad_enter: 'numpadenter',
  numenter: 'numpadenter',
  num_enter: 'numpadenter',
  kpenter: 'numpadenter',
  'kp-enter': 'numpadenter',
  kenter: 'numpadenter',
};

type ParsedBinding = ParseResult['bindings'][number];

export function normalizeBindingKeyToken(rawKey: string): string {
  const normalizedKey = rawKey.trim().toLowerCase();
  if (!normalizedKey) {
    return '';
  }

  const directAlias = DIRECT_KEY_ALIASES[normalizedKey];
  if (directAlias) {
    return directAlias;
  }

  const digitMatch = DIGIT_PREFIX_RE.exec(normalizedKey);
  if (digitMatch) {
    return digitMatch[1] ?? normalizedKey;
  }

  const numpadDigitAlias = NUMPAD_DIGIT_ALIASES[normalizedKey];
  if (numpadDigitAlias) {
    return numpadDigitAlias;
  }

  const numpadSpecialAlias = NUMPAD_SPECIAL_ALIASES[normalizedKey];
  if (numpadSpecialAlias) {
    return numpadSpecialAlias;
  }

  const compactKey = normalizedKey.replace(/[_\s-]/g, '');
  const compactAlias = DIRECT_KEY_ALIASES[compactKey] ?? NUMPAD_SPECIAL_ALIASES[compactKey];
  if (compactAlias) {
    return compactAlias;
  }

  return normalizedKey;
}

function normalizeParsedChord(
  chord: ParsedBinding['chords'][number],
  os: SupportedOs,
  sourceEditor: ParsedBinding['sourceEditor'],
): ParsedBinding['chords'][number] {
  return {
    key: normalizeBindingKeyToken(chord.key),
    modifiers: normalizeBindingModifiers(chord.modifiers, os, sourceEditor),
  };
}

export function normalizeParsedBinding(binding: ParsedBinding, os: SupportedOs): ParsedBinding {
  const sourceEditor = binding.sourceEditor;

  return {
    ...binding,
    key: normalizeBindingKeyToken(binding.key),
    modifiers: normalizeBindingModifiers(binding.modifiers, os, sourceEditor),
    chords: binding.chords.map((chord) => normalizeParsedChord(chord, os, sourceEditor)),
  };
}

export function normalizeParseResult(result: ParseResult, os: SupportedOs): ParseResult {
  return {
    ...result,
    bindings: result.bindings.map((binding) => normalizeParsedBinding(binding, os)),
  };
}
