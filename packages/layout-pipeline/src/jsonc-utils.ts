// layout-pipeline/src/jsonc-utils.ts - Shared JSONC parsing helpers used by detection and remap guards.
import { parse, type ParseError } from 'jsonc-parser';

const JSONC_PARSE_OPTIONS = {
  allowTrailingComma: true,
  disallowComments: false,
} as const;

export function parseJsonLikeArray(content: string): unknown[] | null {
  const parseErrors: ParseError[] = [];
  const parsedContent = parse(content, parseErrors, JSONC_PARSE_OPTIONS);

  if (parseErrors.length > 0 || !Array.isArray(parsedContent)) {
    return null;
  }

  return parsedContent;
}
