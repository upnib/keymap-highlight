// useConfigParser.ts — Shared hook for parsing keymap configs via the Web Worker.
// Keeps editor and loaded-config OS detection in file-parsers, while remap/input
// orchestration is delegated to layout-pipeline for clear package boundaries.
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@chakra-ui/react';
import { detectConfigOs, detectFormat, isSupportedEditorFormat, type ParseResult } from '@keymap-highlight/file-parsers';
import {
  mapStoreOsToWorkerOs,
  normalizeParseResult,
  resolveParsedInput,
} from '@keymap-highlight/layout-pipeline';
import { useParserWorker } from './useParserWorker';
import { useKeymapStore, type SupportedOs } from '../store/useKeymapStore';
import { fetchVsCodeDefaultKeybindings } from '../utils/demo-keybindings';
import type { DemoPresetId, DemoSupportedEditor } from '../constants/editors';

export type { DemoPresetId, DemoSupportedEditor } from '../constants/editors';

export type ParseWithOs = (
  content: string,
  format: string,
  targetOs: SupportedOs,
  filename?: string,
  options?: ParseWithOsOptions,
) => Promise<void>;

export type ParseWithOsOptions = {
  rawConfigSource?: string;
  sourceEditorOverride?: ParseResult['metadata']['sourceEditor'];
};

export type LoadDemoForOs = (presetId: DemoPresetId, targetOs: SupportedOs) => Promise<void>;

export type ConfigParserControls = {
  isParsing: boolean;
  parseWithOs: ParseWithOs;
  loadDemoForOs: LoadDemoForOs;
  handleParse: (content: string, format: string, filename?: string) => Promise<void>;
  handleLoadDemo: (presetId?: DemoPresetId) => Promise<void>;
  handleUpload: (
    content: string,
    filename: string,
    sourceEditorOverride?: ParseResult['metadata']['sourceEditor'],
  ) => void;
};

type DemoPresetConfig = {
  editor: DemoSupportedEditor;
  filenameByOs: Record<SupportedOs, string>;
  importByOs: Record<SupportedOs, () => Promise<string>>;
};

const DEMO_PRESET_CONFIGS: Record<DemoPresetId, DemoPresetConfig> = {
  'vscode-default': {
    editor: 'vscode',
    filenameByOs: {
      win: 'vscode-default-windows.json',
      mac: 'vscode-default-macos.json',
      linux: 'vscode-default-linux.json',
    },
    importByOs: {
      win: () => import('../data/demos/vscode/vscode-default-windows.json?raw').then((m) => m.default),
      mac: () => import('../data/demos/vscode/vscode-default-macos.json?raw').then((m) => m.default),
      linux: () => import('../data/demos/vscode/vscode-default-linux.json?raw').then((m) => m.default),
    },
  },
  'jetbrains-default': {
    editor: 'jetbrains',
    filenameByOs: {
      win: 'jetbrains-intellij_community-default-windows.xml',
      mac: 'jetbrains-intellij_community-default-macos.xml',
      linux: 'jetbrains-intellij_community-default-linux.xml',
    },
    importByOs: {
      win: () =>
        import('../data/demos/jetbrains/jetbrains-intellij_community-default-windows.xml?raw').then((m) => m.default),
      mac: () => import('../data/demos/jetbrains/jetbrains-intellij_community-default-macos.xml?raw').then((m) => m.default),
      linux: () => import('../data/demos/jetbrains/jetbrains-intellij_community-default-linux.xml?raw').then((m) => m.default),
    },
  },
  'vim-default': {
    editor: 'vim',
    filenameByOs: {
      win: 'vim-default-windows.vim',
      mac: 'vim-default-macos.vim',
      linux: 'vim-default-linux.vim',
    },
    importByOs: {
      win: () => import('../data/demos/vim/vim-default-windows.vim?raw').then((m) => m.default),
      mac: () => import('../data/demos/vim/vim-default-macos.vim?raw').then((m) => m.default),
      linux: () => import('../data/demos/vim/vim-default-linux.vim?raw').then((m) => m.default),
    },
  },
  'zed-default': {
    editor: 'zed',
    filenameByOs: {
      win: 'zed-default-windows.json',
      mac: 'zed-default-macos.json',
      linux: 'zed-default-linux.json',
    },
    importByOs: {
      win: () => import('../data/demos/zed/zed-default-windows.json?raw').then((m) => m.default),
      mac: () => import('../data/demos/zed/zed-default-macos.json?raw').then((m) => m.default),
      linux: () => import('../data/demos/zed/zed-default-linux.json?raw').then((m) => m.default),
    },
  },
  'nano-default': {
    editor: 'nano',
    filenameByOs: {
      win: 'nano-default-windows.nanorc',
      mac: 'nano-default-macos.nanorc',
      linux: 'nano-default-linux.nanorc',
    },
    importByOs: {
      win: () => import('../data/demos/nano/nano-default-windows.nanorc?raw').then((m) => m.default),
      mac: () => import('../data/demos/nano/nano-default-macos.nanorc?raw').then((m) => m.default),
      linux: () => import('../data/demos/nano/nano-default-linux.nanorc?raw').then((m) => m.default),
    },
  },
  'krita-default': {
    editor: 'krita',
    filenameByOs: {
      win: 'krita-default-windows.shortcuts',
      mac: 'krita-default-macos.shortcuts',
      linux: 'krita-default-linux.shortcuts',
    },
    importByOs: {
      win: () => import('../data/demos/krita/krita-default-windows.shortcuts?raw').then((m) => m.default),
      mac: () => import('../data/demos/krita/krita-default-macos.shortcuts?raw').then((m) => m.default),
      linux: () => import('../data/demos/krita/krita-default-linux.shortcuts?raw').then((m) => m.default),
    },
  },
  'illustrator-default': {
    editor: 'illustrator',
    filenameByOs: {
      win: 'illustrator-default-windows.txt',
      mac: 'illustrator-default-macos.txt',
      linux: 'illustrator-default-linux.txt',
    },
    importByOs: {
      win: () => import('../data/demos/illustrator/illustrator-default-windows.txt?raw').then((m) => m.default),
      mac: () => import('../data/demos/illustrator/illustrator-default-macos.txt?raw').then((m) => m.default),
      linux: () => import('../data/demos/illustrator/illustrator-default-linux.txt?raw').then((m) => m.default),
    },
  },
  'blender-default': {
    editor: 'blender',
    filenameByOs: {
      win: 'blender-default-windows.py',
      mac: 'blender-default-macos.py',
      linux: 'blender-default-linux.py',
    },
    importByOs: {
      win: () => import('../data/demos/blender/blender-default-windows.py?raw').then((m) => m.default),
      mac: () => import('../data/demos/blender/blender-default-macos.py?raw').then((m) => m.default),
      linux: () => import('../data/demos/blender/blender-default-linux.py?raw').then((m) => m.default),
    },
  },
  'blender-industry-compatible': {
    editor: 'blender',
    filenameByOs: {
      win: 'blender-industry_compatible-windows.py',
      mac: 'blender-industry_compatible-macos.py',
      linux: 'blender-industry_compatible-linux.py',
    },
    importByOs: {
      win: () => import('../data/demos/blender/blender-industry_compatible-windows.py?raw').then((m) => m.default),
      mac: () => import('../data/demos/blender/blender-industry_compatible-macos.py?raw').then((m) => m.default),
      linux: () => import('../data/demos/blender/blender-industry_compatible-linux.py?raw').then((m) => m.default),
    },
  },
};

export function useConfigParser(): ConfigParserControls {
  const { t } = useTranslation();
  const toast = useToast();
  const parserWorker = useParserWorker();

  const os = useKeymapStore((s) => s.os);
  const setParseResult = useKeymapStore((s) => s.setParseResult);
  const setRawConfig = useKeymapStore((s) => s.setRawConfig);
  const setParsedOs = useKeymapStore((s) => s.setParsedOs);
  const setUploadedConfig = useKeymapStore((s) => s.setUploadedConfig);

  const [isParsing, setIsParsing] = useState(false);

  const parseWithOs = useCallback(
    async (
      content: string,
      format: string,
      targetOs: SupportedOs,
      filename?: string,
      options?: ParseWithOsOptions,
    ) => {
      setIsParsing(true);
      try {
        const workerOs = mapStoreOsToWorkerOs(targetOs);
        const parsedResult = await parserWorker.parseContent(format, content, workerOs);
        const result = normalizeParseResult(parsedResult, targetOs);

        if (options?.sourceEditorOverride) {
          const sourceEditor = options.sourceEditorOverride;
          result.metadata.sourceEditor = sourceEditor;
          result.bindings = result.bindings.map((binding) => ({
            ...binding,
            sourceEditor,
          }));
        }

        if (filename) {
          result.metadata.sourceName = filename;
        }

        setParseResult(result);
        setRawConfig(options?.rawConfigSource ?? content);
        setParsedOs(targetOs);

        if (result.warnings && result.warnings.length > 0) {
          toast({
            title: t('parsers.parsedWithWarnings', { count: result.warnings.length }),
            description: t('parsers.skippedBindingsWarning'),
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        toast({
          title: t('parsers.parsingFailed'),
          description: error instanceof Error ? error.message : t('parsers.unknownError'),
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsParsing(false);
      }
    },
    [parserWorker, setParseResult, setParsedOs, setRawConfig, t, toast],
  );

  const handleParse = useCallback(
    async (content: string, format: string, filename?: string) => {
      await parseWithOs(content, format, os, filename, {
        rawConfigSource: content,
      });
    },
    [os, parseWithOs],
  );

  const loadDemoForOs = useCallback(
    async (presetId: DemoPresetId, targetOs: SupportedOs) => {
      const presetConfig = DEMO_PRESET_CONFIGS[presetId];
      const demoFilename = `(demo) ${presetConfig.filenameByOs[targetOs]}`;

      try {
        if (presetId === 'vscode-default') {
          try {
            const remoteContent = await fetchVsCodeDefaultKeybindings(targetOs);
            await parseWithOs(remoteContent, 'vscode', targetOs, demoFilename);
            return;
          } catch {
            const localContent = await DEMO_PRESET_CONFIGS['vscode-default'].importByOs[targetOs]();
            await parseWithOs(localContent, 'vscode', targetOs, demoFilename);
            return;
          }
        }

        const localContent = await presetConfig.importByOs[targetOs]();
        await parseWithOs(localContent, presetConfig.editor, targetOs, demoFilename);
      } catch {
        toast({
          title: t('parsers.parsingFailed'),
          description: t('parsers.unknownError'),
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [parseWithOs, t, toast],
  );

  const handleLoadDemo = useCallback(
    async (presetId: DemoPresetId = 'vscode-default') => {
      setUploadedConfig(null, null, null);
      await loadDemoForOs(presetId, os);
    },
    [loadDemoForOs, os, setUploadedConfig],
  );

  const handleUpload = useCallback(
    (content: string, filename: string, sourceEditorOverride?: ParseResult['metadata']['sourceEditor']) => {
      const detectedFormat = sourceEditorOverride ?? detectFormat(filename, content);

      setParseResult(null);
      setRawConfig(content);
      setParsedOs(null);
      setUploadedConfig(filename, null, detectedFormat);

      if (!isSupportedEditorFormat(detectedFormat)) {
        return;
      }

      const detectedConfigOs = detectConfigOs(content, detectedFormat);
      const pipelineInput = resolveParsedInput({
        rawConfig: content,
        targetOs: os,
        format: detectedFormat,
        uploadedOs: detectedConfigOs,
      });

      setUploadedConfig(filename, detectedConfigOs, detectedFormat);

      void parseWithOs(pipelineInput.contentToParse, detectedFormat, os, filename, {
        rawConfigSource: content,
        sourceEditorOverride: detectedFormat,
      });
    },
    [os, parseWithOs, setParseResult, setParsedOs, setRawConfig, setUploadedConfig],
  );

  return {
    isParsing,
    parseWithOs,
    loadDemoForOs,
    handleParse,
    handleLoadDemo,
    handleUpload,
  };
}
