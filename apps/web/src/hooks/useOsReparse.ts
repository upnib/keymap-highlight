// useOsReparse.ts — Singleton hook that triggers a re-parse when the user changes the OS setting.
// Must be mounted exactly once in the component tree; reuses shared demo/editor guards and delegates
// parsed-input remap orchestration to layout-pipeline to keep package boundaries consistent.
import { useEffect, useRef } from 'react';
import { isSupportedEditorFormat } from '@keymap-highlight/file-parsers';
import { resolveParsedInput } from '@keymap-highlight/layout-pipeline';
import type { LoadDemoForOs, ParseWithOs } from './useConfigParser';
import type { DemoPresetId, DemoSupportedEditor } from '../constants/editors';
import { useKeymapStore, type SupportedOs } from '../store/useKeymapStore';

const DEFAULT_DEMO_PRESET_BY_EDITOR: Readonly<Partial<Record<DemoSupportedEditor, DemoPresetId>>> = {
  vscode: 'vscode-default',
  jetbrains: 'jetbrains-default',
  vim: 'vim-default',
  zed: 'zed-default',
  krita: 'krita-default',
  illustrator: 'illustrator-default',
  blender: 'blender-default',
};

function resolveDemoPresetId(sourceName: string | undefined, sourceEditor: string | undefined): DemoPresetId | null {
  if (sourceEditor === 'blender' && sourceName?.includes('industry_compatible')) {
    return 'blender-industry-compatible';
  }

  if (!sourceEditor) {
    return null;
  }

  return DEFAULT_DEMO_PRESET_BY_EDITOR[sourceEditor as DemoSupportedEditor] ?? null;
}

export function useOsReparse(parseWithOs: ParseWithOs, loadDemoForOs: LoadDemoForOs) {
  const os = useKeymapStore((s) => s.os);
  const rawConfig = useKeymapStore((s) => s.rawConfig);
  const parsedMetadata = useKeymapStore((s) => s.parsedMetadata);
  const uploadedFilename = useKeymapStore((s) => s.uploadedFilename);
  const uploadedFormat = useKeymapStore((s) => s.uploadedFormat);
  const uploadedOs = useKeymapStore((s) => s.uploadedOs);
  const setParsedOs = useKeymapStore((s) => s.setParsedOs);
  const setUploadedConfig = useKeymapStore((s) => s.setUploadedConfig);
  const previousOsRef = useRef<SupportedOs | null>(null);
  const shouldSkipInitialRef = useRef(true);

  useEffect(() => {
    if (!rawConfig) {
      return;
    }

    if (shouldSkipInitialRef.current || previousOsRef.current === null) {
      shouldSkipInitialRef.current = false;
      previousOsRef.current = os;
      return;
    }

    if (previousOsRef.current === os) {
      return;
    }

    if (parsedMetadata?.sourceName?.startsWith('(demo)')) {
      const demoPresetId = resolveDemoPresetId(parsedMetadata.sourceName, parsedMetadata.sourceEditor);
      if (demoPresetId) {
        previousOsRef.current = os;
        void loadDemoForOs(demoPresetId, os);
        return;
      }
    }

    previousOsRef.current = os;

    const format = uploadedFormat ?? parsedMetadata?.sourceEditor ?? 'unknown';
    const pipelineInput = resolveParsedInput({
      rawConfig,
      targetOs: os,
      format,
      uploadedOs,
    });

    if (!isSupportedEditorFormat(pipelineInput.format)) {
      setParsedOs(null);
      setUploadedConfig(uploadedFilename, pipelineInput.detectedConfigOs, pipelineInput.format);
      return;
    }

    void parseWithOs(
      pipelineInput.contentToParse,
      pipelineInput.format,
      os,
      parsedMetadata?.sourceName,
      {
        rawConfigSource: rawConfig,
        sourceEditorOverride: pipelineInput.format,
      },
    );
  }, [
    loadDemoForOs,
    os,
    parseWithOs,
    parsedMetadata?.sourceEditor,
    parsedMetadata?.sourceName,
    rawConfig,
    setParsedOs,
    setUploadedConfig,
    uploadedFilename,
    uploadedFormat,
    uploadedOs,
  ]);
}
