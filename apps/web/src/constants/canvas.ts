// canvas.ts - Shared constants for keyboard canvas rendering and interactions.
// Centralizes geometry, zoom limits, overlays, and visual indicator defaults.

export const KEY_UNIT_SIZE = 54;
export const KEY_UNIT_SPACING = 4;

export const MIN_ZOOM_LEVEL = 0.2;
export const MAX_ZOOM_LEVEL = 3;
export const ZOOM_LEVEL_STEP = 0.1;

export const CANVAS_INDICATOR_RADIUS = 3;
export const CANVAS_INDICATOR_STACK_GAP = 9;
export const CANVAS_INDICATOR_OFFSET_X = 10;
export const CANVAS_INDICATOR_OFFSET_Y = 10;
export const CANVAS_INDICATOR_FADE_DURATION_MS = 120;
export const CANVAS_RELATED_INDICATOR_MAX_PER_KEY = 16;

export const CANVAS_FIT_PADDING_X = 240;
export const CANVAS_FIT_PADDING_Y = 240;

export type CanvasOs = 'mac' | 'win' | 'linux';
export const MODIFIER_DISPLAY_LABELS: Record<string, Record<CanvasOs, string>> = {
  control: {
    mac: 'Control',
    win: 'Ctrl',
    linux: 'Ctrl',
  },
  ctrl: {
    mac: 'Control',
    win: 'Ctrl',
    linux: 'Ctrl',
  },
  alt: {
    mac: 'Option',
    win: 'Alt',
    linux: 'Alt',
  },
  option: {
    mac: 'Option',
    win: 'Alt',
    linux: 'Alt',
  },
  opt: {
    mac: 'Option',
    win: 'Alt',
    linux: 'Alt',
  },
  meta: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  command: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  cmd: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  win: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  windows: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  gui: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
  super: {
    mac: 'Cmd',
    win: 'Win',
    linux: 'Super',
  },
};

export const CANVAS_MAC_LAYOUT_MODIFIER_CODES = new Set([
  'ctrl',
  'win',
  'alt',
  'meta',
  'control',
  'option',
  'command',
  'fn',
  'menu',
  'super',
  'gui',
]);

type RelatedIndicatorShape = 'dot' | 'triangle' | 'square' | 'pentagon';
export const RELATED_INDICATOR_SHAPE_ORDER: Record<RelatedIndicatorShape, number> = {
  dot: 1,
  triangle: 2,
  square: 3,
  pentagon: 4,
};

export const KEY_MODIFIER_STYLE_SPECIAL_KEYS = new Set([
  'esc',
  'tab',
  'caps',
  'caps lock',
  'backspace',
  'enter',
]);
export const KEY_COMMAND_LEGEND_ENABLED = false;

export const CANVAS_TOOLTIP_WIDTH = 280;
export const CANVAS_TOOLTIP_PADDING = 12;
export const CANVAS_TOOLTIP_INDICATOR_SIZE = 8;
export const CANVAS_TOOLTIP_MAX_RELATED_INDICATORS = 10;
export const CANVAS_TOOLTIP_THEME = {
  dark: {
    background: '#1A202C',
    text: '#FFFFFF',
    subtext: '#CBD5E0',
    border: '#4A5568',
    context: '#90CDF4',
    warning: '#FEB2B2',
    divider: '#2D3748',
  },
  light: {
    background: '#F7FAFC',
    text: '#000000',
    subtext: '#2D3748',
    border: '#CBD5E0',
    context: '#2A4365',
    warning: '#C53030',
    divider: '#E2E8F0',
  },
} as const;

export const CANVAS_SHORTCUT_LEGEND_SHAPE_ICON_SIZE = 12;
export const CANVAS_SHORTCUT_LEGEND_SHAPE_CENTER = CANVAS_SHORTCUT_LEGEND_SHAPE_ICON_SIZE / 2;
