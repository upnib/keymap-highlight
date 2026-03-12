// layout-pipeline/src/types.ts - Shared cross-package OS and editor detection types.
import type {
  DetectedConfigOs as ParserDetectedConfigOs,
  DetectedEditorFormat as ParserDetectedEditorFormat,
  Editor,
} from '@keymap-highlight/file-parsers';

export type DetectedConfigOs = ParserDetectedConfigOs;
export type SupportedOs = Exclude<DetectedConfigOs, 'unknown'>;
export type SupportedEditorFormat = Editor;
export type DetectedEditorFormat = ParserDetectedEditorFormat;
