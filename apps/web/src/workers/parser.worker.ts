// parser.worker.ts - Web Worker that runs keymap parsing off the main thread using Comlink.
// Resolves the correct keymap-parser function by editor format, validates the OS string, and
// returns a structured ParseResult. Exposes a single parseContent method via the Comlink API.
import { expose } from 'comlink';
import { resolveParserByEditor, type OS, type ParseResult } from '@keymap-highlight/file-parsers';

function normalizeEditorFormat(editorFormat: string): string {
  return editorFormat.trim().toLowerCase();
}

function normalizeOs(os: string): OS {
  const normalizedOs = os.trim().toLowerCase();
  if (normalizedOs === 'windows' || normalizedOs === 'macos' || normalizedOs === 'linux') {
    return normalizedOs;
  }

  throw new Error(`Unsupported OS: ${os}`);
}

function resolveParser(editorFormat: string) {
  const parser = resolveParserByEditor(editorFormat);
  if (!parser) {
    throw new Error(`Unsupported editor format: ${editorFormat}`);
  }

  return parser;
}

export interface ParserWorkerApi {
  parseContent(editorFormat: string, content: string, os: string): ParseResult;
}

export function parseContent(editorFormat: string, content: string, os: string): ParseResult {
  const normalizedEditorFormat = normalizeEditorFormat(editorFormat);
  const normalizedOs = normalizeOs(os);
  const parser = resolveParser(normalizedEditorFormat);
  return parser(content, normalizedOs);
}

const parserWorkerApi: ParserWorkerApi = {
  parseContent,
};

expose(parserWorkerApi);
