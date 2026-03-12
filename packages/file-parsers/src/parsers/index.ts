// parsers/index.ts - Aggregates parser exports and the shared parser registry.
import { isSupportedEditorFormat, type Editor } from '../editor-formats';
import type { OS } from '../schemas/enums';
import type { ParseResult } from '../schemas/parseResult';
import { parseBlender } from './blender';
import { parseEmacs } from './emacs';
import { parseIllustrator } from './illustrator';
import { parseJetBrains } from './jetbrains';
import { parseKrita } from './krita';
import { parseNeovim } from './neovim';
import { parseVim } from './vim';
import { parseVSCode } from './vscode';
import { parseZed } from './zed';

export type ParserFunction = (content: string, os: OS) => ParseResult;

export const PARSERS_BY_EDITOR: Readonly<Record<Editor, ParserFunction>> = {
  vscode: parseVSCode,
  jetbrains: parseJetBrains,
  vim: parseVim,
  neovim: parseNeovim,
  zed: parseZed,
  emacs: parseEmacs,
  krita: parseKrita,
  illustrator: parseIllustrator,
  blender: parseBlender,
};

export function resolveParserByEditor(editorFormat: string): ParserFunction | null {
  const normalizedEditorFormat = editorFormat.trim().toLowerCase();
  if (!isSupportedEditorFormat(normalizedEditorFormat)) {
    return null;
  }

  return PARSERS_BY_EDITOR[normalizedEditorFormat];
}

export { parseJetBrains };
export { parseVSCode };
export { parseVim };
export { parseNeovim };
export { parseZed };
export { parseEmacs };
export { parseKrita };
export { parseIllustrator };
export { parseBlender };
