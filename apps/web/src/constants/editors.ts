// editors.ts - Shared editor metadata and grouped demo preset definitions for the upload and demo UI.
// Keeps preset order, grouping, and lookup data in one place for landing-page and main-tool reuse.
export const DEMO_SUPPORTED_EDITORS = ['vscode', 'jetbrains', 'vim', 'zed', 'krita', 'illustrator', 'blender'] as const;

export type DemoSupportedEditor = (typeof DEMO_SUPPORTED_EDITORS)[number];

export const DEMO_PRESETS = [
  { id: 'vscode-default', editor: 'vscode', labelKey: 'demoPresets.default', fallback: 'Default' },
  {
    id: 'jetbrains-default',
    editor: 'jetbrains',
    labelKey: 'demoPresets.jetbrainsIntellijCommunityDefault',
    fallback: 'IntelliJ Community Default',
  },
  { id: 'vim-default', editor: 'vim', labelKey: 'demoPresets.default', fallback: 'Default' },
  { id: 'zed-default', editor: 'zed', labelKey: 'demoPresets.default', fallback: 'Default' },
  { id: 'krita-default', editor: 'krita', labelKey: 'demoPresets.default', fallback: 'Default' },
  { id: 'illustrator-default', editor: 'illustrator', labelKey: 'demoPresets.default', fallback: 'Default' },
  { id: 'blender-default', editor: 'blender', labelKey: 'demoPresets.default', fallback: 'Default' },
  {
    id: 'blender-industry-compatible',
    editor: 'blender',
    labelKey: 'demoPresets.industryCompatible',
    fallback: 'Industry Compatible',
  },
] as const;

export type DemoPreset = (typeof DEMO_PRESETS)[number];
export type DemoPresetId = DemoPreset['id'];

type DemoPresetGroupDefinition = {
  editor: DemoSupportedEditor;
  labelKey: string;
  fallback: string;
  presetIds: readonly DemoPresetId[];
};

export const DEMO_PRESET_GROUPS = [
  { editor: 'vscode', labelKey: 'parsers.vscode', fallback: 'VS Code', presetIds: ['vscode-default'] },
  { editor: 'jetbrains', labelKey: 'parsers.jetbrains', fallback: 'JetBrains IDEs', presetIds: ['jetbrains-default'] },
  { editor: 'vim', labelKey: 'parsers.vim', fallback: 'Vim / Neovim', presetIds: ['vim-default'] },
  { editor: 'zed', labelKey: 'parsers.zed', fallback: 'Zed', presetIds: ['zed-default'] },
  { editor: 'krita', labelKey: 'parsers.krita', fallback: 'Krita', presetIds: ['krita-default'] },
  {
    editor: 'illustrator',
    labelKey: 'parsers.illustrator',
    fallback: 'Adobe Illustrator',
    presetIds: ['illustrator-default'],
  },
  {
    editor: 'blender',
    labelKey: 'parsers.blender',
    fallback: 'Blender',
    presetIds: ['blender-default', 'blender-industry-compatible'],
  },
] as const satisfies readonly DemoPresetGroupDefinition[];

export type DemoPresetGroup = (typeof DEMO_PRESET_GROUPS)[number];

const DEMO_PRESET_MAP = Object.fromEntries(
  DEMO_PRESETS.map((preset) => [preset.id, preset] as const),
) as Record<DemoPresetId, DemoPreset>;

export type DemoPresetGroupEntry = {
  editor: DemoSupportedEditor;
  labelKey: string;
  fallback: string;
  presets: readonly DemoPreset[];
};

export const DEMO_PRESET_GROUP_ENTRIES: readonly DemoPresetGroupEntry[] = DEMO_PRESET_GROUPS.map((group) => ({
  editor: group.editor,
  labelKey: group.labelKey,
  fallback: group.fallback,
  presets: group.presetIds.map((presetId) => DEMO_PRESET_MAP[presetId]),
}));

const DEMO_SUPPORTED_EDITOR_SET = new Set<DemoSupportedEditor>(DEMO_SUPPORTED_EDITORS);

export function isDemoSupportedEditor(editor: string): editor is DemoSupportedEditor {
  return DEMO_SUPPORTED_EDITOR_SET.has(editor as DemoSupportedEditor);
}
