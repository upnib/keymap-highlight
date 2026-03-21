// editor-formats.ts - Canonical editor identifiers and detection-safe helpers shared across file-parsers.
export const SUPPORTED_EDITOR_FORMATS = [
  'vscode',
  'jetbrains',
  'vim',
  'neovim',
  'zed',
  'emacs',
  'nano',
  'krita',
  'illustrator',
  'blender',
] as const;

export type Editor = (typeof SUPPORTED_EDITOR_FORMATS)[number];
export type DetectedEditorFormat = Editor | 'unknown';

const SUPPORTED_EDITOR_FORMAT_SET = new Set<Editor>(SUPPORTED_EDITOR_FORMATS);

export function isSupportedEditorFormat(format: string): format is Editor {
  return SUPPORTED_EDITOR_FORMAT_SET.has(format as Editor);
}
