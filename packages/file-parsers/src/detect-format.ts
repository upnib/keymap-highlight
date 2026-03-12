// detect-format.ts - Comment-aware editor format detection for uploaded configs before parser dispatch.
import { parse, type ParseError } from 'jsonc-parser';
import type { DetectedEditorFormat, Editor } from './editor-formats';

const ILLUSTRATOR_SECTION_MARKERS = [/^\s*tools\s*$/im, /^\s*menu commands\s*$/im] as const;
const ILLUSTRATOR_SHORTCUT_TRAIT = /(?:^|\n)[^\n]*(?:ctrl|control|cmd|command|alt|option|shift)\+/i;
const BLENDER_EXPORT_VERSION_TRAIT = /^\s*keyconfig_version\s*=\s*\(/m;
const BLENDER_EXPORT_DATA_TRAIT = /^\s*keyconfig_data\s*=\s*\\?\s*\[/m;
const BLENDER_EXPORT_IMPORT_TRAIT = /\bkeyconfig_import_from_data\b/;
const NEOVIM_CONFIG_TRAIT = /(?:\bvim\.keymap\.set\b|\bvim\.api\.nvim_(?:buf_)?set_keymap\b)/i;
const JSON_COMMENT_SCAN_LIMIT = 1600;
const TEXT_COMMENT_SCAN_LIMIT = 1600;
const TEXT_COMMENT_LINE_LIMIT = 16;

const COMMENT_HINT_PATTERNS: readonly { format: Editor; pattern: RegExp }[] = [
  { format: 'vscode', pattern: /\b(?:visual[\s-]*studio[\s-]*code|vs[\s-]*code|vscode)\b/i },
  { format: 'zed', pattern: /\bzed\b/i },
  { format: 'jetbrains', pattern: /\b(?:jetbrains|intellij(?:[\s-]*idea)?|pycharm|webstorm|phpstorm|goland|rider|clion|datagrip|rubymine|appcode|android[\s-]*studio)\b/i },
  { format: 'illustrator', pattern: /\b(?:adobe[\s-]*illustrator|illustrator)\b/i },
  { format: 'krita', pattern: /\bkrita\b/i },
  { format: 'blender', pattern: /\bblender\b/i },
  { format: 'neovim', pattern: /\b(?:neovim|nvim)\b/i },
  { format: 'emacs', pattern: /\bemacs\b/i },
  { format: 'vim', pattern: /\bvim\b/i },
] as const;

const JSONC_PARSE_OPTIONS = {
  allowTrailingComma: true,
  disallowComments: false,
} as const;

function looksLikeIllustratorExport(content: string): boolean {
  return ILLUSTRATOR_SECTION_MARKERS.every((pattern) => pattern.test(content)) && ILLUSTRATOR_SHORTCUT_TRAIT.test(content);
}

function looksLikeBlenderExport(content: string): boolean {
  return BLENDER_EXPORT_DATA_TRAIT.test(content)
    && (BLENDER_EXPORT_VERSION_TRAIT.test(content) || BLENDER_EXPORT_IMPORT_TRAIT.test(content));
}

function parseJsonLikeArray(content: string): unknown[] | null {
  const parseErrors: ParseError[] = [];
  const parsedContent = parse(content, parseErrors, JSONC_PARSE_OPTIONS);

  if (parseErrors.length > 0 || !Array.isArray(parsedContent)) {
    return null;
  }

  return parsedContent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isZedBindingContainer(value: unknown): boolean {
  return isRecord(value) && (
    'bindings' in value
    || 'context' in value
    || 'use_key_equivalents' in value
  );
}

function isVsCodeBindingRecord(value: unknown): boolean {
  return isRecord(value)
    && typeof value.key === 'string'
    && (
      typeof value.command === 'string'
      || typeof value.when === 'string'
      || typeof value.mac === 'string'
      || typeof value.win === 'string'
      || typeof value.linux === 'string'
    );
}

function detectCommentHint(commentText: string): Editor | null {
  const normalizedCommentText = commentText.trim();
  if (!normalizedCommentText) {
    return null;
  }

  for (const { format, pattern } of COMMENT_HINT_PATTERNS) {
    if (pattern.test(normalizedCommentText)) {
      return format;
    }
  }

  return null;
}

function extractLeadingJsonCommentText(content: string): string {
  const source = content.slice(0, JSON_COMMENT_SCAN_LIMIT).replace(/^\uFEFF/, '');
  const comments: string[] = [];
  let index = 0;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? '')) {
      index += 1;
    }

    if (source.startsWith('//', index)) {
      const lineEnd = source.indexOf('\n', index + 2);
      const endIndex = lineEnd === -1 ? source.length : lineEnd;
      comments.push(source.slice(index + 2, endIndex).trim());
      index = endIndex;
      continue;
    }

    if (source.startsWith('/*', index)) {
      const endIndex = source.indexOf('*/', index + 2);
      if (endIndex === -1) {
        comments.push(source.slice(index + 2).trim());
        break;
      }

      comments.push(source.slice(index + 2, endIndex).trim());
      index = endIndex + 2;
      continue;
    }

    break;
  }

  return comments.join('\n');
}

function extractLeadingTextCommentText(content: string): string {
  const lines = content
    .slice(0, TEXT_COMMENT_SCAN_LIMIT)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(0, TEXT_COMMENT_LINE_LIMIT);

  const comments: string[] = [];
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (comments.length === 0 && !inBlockComment) {
        continue;
      }

      if (inBlockComment) {
        comments.push('');
        continue;
      }

      break;
    }

    if (inBlockComment) {
      const blockEndIndex = line.indexOf('*/');
      if (blockEndIndex === -1) {
        comments.push(line.replace(/^\*+\s*/, ''));
        continue;
      }

      comments.push(line.slice(0, blockEndIndex).replace(/^\*+\s*/, '').trim());
      inBlockComment = false;
      continue;
    }

    if (line.startsWith('//')) {
      comments.push(line.slice(2).trim());
      continue;
    }

    if (line.startsWith('#')) {
      comments.push(line.slice(1).trim());
      continue;
    }

    if (line.startsWith(';')) {
      comments.push(line.slice(1).trim());
      continue;
    }

    if (line.startsWith('--')) {
      comments.push(line.slice(2).trim());
      continue;
    }

    if (line.startsWith('/*')) {
      const commentStart = line.slice(2);
      const blockEndIndex = commentStart.indexOf('*/');
      if (blockEndIndex === -1) {
        comments.push(commentStart.trim());
        inBlockComment = true;
      } else {
        comments.push(commentStart.slice(0, blockEndIndex).trim());
      }
      continue;
    }

    if (line.startsWith('"')) {
      comments.push(line.slice(1).trim());
      continue;
    }

    break;
  }

  return comments.join('\n');
}

function detectFormatFromLeadingComments(filename: string, content: string): Editor | null {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.json') || lowerName.endsWith('.jsonc')) {
    return detectCommentHint(extractLeadingJsonCommentText(content));
  }

  if (lowerName.endsWith('.txt')) {
    return detectCommentHint(extractLeadingTextCommentText(content));
  }

  return null;
}

function detectJsonFormat(content: string): DetectedEditorFormat {
  const parsedBindings = parseJsonLikeArray(content);
  if (!parsedBindings) {
    return 'unknown';
  }

  if (parsedBindings.some(isZedBindingContainer)) {
    return 'zed';
  }

  if (parsedBindings.some(isVsCodeBindingRecord)) {
    return 'vscode';
  }

  return 'unknown';
}

export function detectFormat(filename: string, content: string): DetectedEditorFormat {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith('.xml')) return 'jetbrains';
  if (lowerName.endsWith('.shortcuts')) return 'krita';
  if (lowerName.endsWith('.vim') || lowerName === '.vimrc' || lowerName === 'vimrc' || lowerName === '_vimrc') return 'vim';
  if (lowerName.endsWith('.lua') || lowerName === 'init.lua') return 'neovim';
  if (lowerName.endsWith('.el') || lowerName === '.emacs' || lowerName === 'init.el') return 'emacs';
  if (lowerName.endsWith('.py') && looksLikeBlenderExport(content)) return 'blender';

  const detectedCommentHint = detectFormatFromLeadingComments(filename, content);
  if (detectedCommentHint) {
    return detectedCommentHint;
  }

  if (lowerName.endsWith('.json') || lowerName.endsWith('.jsonc')) {
    return detectJsonFormat(content);
  }

  if (lowerName.endsWith('.txt') && lowerName.includes('illustrator')) return 'illustrator';

  if (/^\s*\[shortcuts\]\s*$/im.test(content)) return 'krita';
  if (looksLikeIllustratorExport(content)) return 'illustrator';
  if (looksLikeBlenderExport(content)) return 'blender';
  if (NEOVIM_CONFIG_TRAIT.test(content)) return 'neovim';
  if (/\(global-set-key|\(define-key|\(kbd\s+"/i.test(content)) return 'emacs';
  if (/^\s*(?:[nvisxocst]?noremap!?|[nvisxocst]?map!?)\s/im.test(content)) return 'vim';

  return 'unknown';
}
