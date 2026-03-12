// file-parsers/src/index.ts - Public API barrel for the file-parsers package.
// Re-exports layouts, action lookup helpers, Zod schemas, and parser functions,
// so consumers only need to import from "@keymap-highlight/file-parsers".
export * from './detect-config-os';
export * from './editor-formats';
export * from './detect-format';
export * from './layouts';
export * from './lookupActionName';
export * from './commonActions';
export { parseJetBrains, parseVSCode, parseVim, parseNeovim, parseZed, parseEmacs, parseKrita, parseIllustrator, parseBlender } from './parsers';
export { PARSERS_BY_EDITOR, resolveParserByEditor, type ParserFunction } from './parsers';
export * from './schemas/enums';
export * from './schemas/keyBinding';
export * from './schemas/parseResult';
