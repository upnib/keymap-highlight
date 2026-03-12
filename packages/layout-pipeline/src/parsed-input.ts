// layout-pipeline/src/parsed-input.ts - Parsed-input resolver for app-facing remap orchestration.
import { remapConfigByModifierLayout } from './os-modifier-layout';
import type { DetectedConfigOs, DetectedEditorFormat, SupportedOs } from './types';

export type ResolveParsedInputOptions = {
  rawConfig: string;
  targetOs: SupportedOs;
  format: DetectedEditorFormat;
  uploadedOs?: DetectedConfigOs | null;
};

export type ResolvedParsedInput = {
  format: DetectedEditorFormat;
  contentToParse: string;
  detectedConfigOs: DetectedConfigOs;
};

function hasVsCodePlatformOverrides(rawConfig: string): boolean {
  return /"(?:mac|win|linux)"\s*:\s*"/i.test(rawConfig);
}

function shouldRemapConfig(
  rawConfig: string,
  format: DetectedEditorFormat,
  detectedConfigOs: DetectedConfigOs,
  targetOs: SupportedOs,
): boolean {
  if (format === 'unknown' || detectedConfigOs === 'unknown' || detectedConfigOs === targetOs) {
    return false;
  }

  if (format === 'vscode' && hasVsCodePlatformOverrides(rawConfig)) {
    return false;
  }

  return true;
}

export function resolveParsedInput(
  options: ResolveParsedInputOptions,
): ResolvedParsedInput {
  const {
    rawConfig,
    targetOs,
    format,
    uploadedOs,
  } = options;

  const detectedConfigOs = uploadedOs ?? 'unknown';
  const shouldRemapForTargetOs = shouldRemapConfig(rawConfig, format, detectedConfigOs, targetOs);

  return {
    format,
    contentToParse: shouldRemapForTargetOs
      ? remapConfigByModifierLayout(rawConfig, detectedConfigOs, targetOs, format)
      : rawConfig,
    detectedConfigOs,
  };
}
