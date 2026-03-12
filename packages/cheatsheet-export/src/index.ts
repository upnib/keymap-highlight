// cheatsheet-export/src/index.ts - Public API barrel for cheatsheet PDF/Markdown export helpers.
export {
  buildBindingGroups,
  ensureFontsRegistered,
  exportToMarkdown,
  exportToPdf,
  formatRawCommand,
  type BindingGroup,
  type ExportCheatsheetOptions,
  type GroupingKind,
} from './export-engines';
