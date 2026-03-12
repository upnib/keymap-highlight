// useKeymapStore.ts - Zustand store for parsed bindings, keyboard view state, and persisted user preferences.
// Manages and isolates conflicting bindings logic perfectly. Ensures that multiple different shortcuts
// or the exact same shortcuts assigned for the exact SAME action/command are NOT mistakenly marked as a conflict.
import type { ParseResult, ParseWarning } from '@keymap-highlight/file-parsers';
import {
  DEFAULT_CUSTOM_INPUT_MAPPING,
  type DetectedEditorFormat,
  HARDWARE_LAYOUT_OPTIONS,
  INPUT_LAYOUT_CUSTOM_KEY_PATTERN,
  INPUT_LAYOUT_OPTIONS,
  getConflictIdentity,
  type DetectedConfigOs,
  type InputLayoutMapping,
  type InputLayoutType,
  type LayoutKey,
  type SupportedOs,
} from '@keymap-highlight/layout-pipeline';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../constants/canvas';
import { detectUserOs } from '../utils/detect-user-os';

export const LAYOUT_TYPES = HARDWARE_LAYOUT_OPTIONS;

export type LayoutType = LayoutKey;
export type { DetectedConfigOs, DetectedEditorFormat, InputLayoutMapping, InputLayoutType, SupportedOs };
export type SidebarPosition = 'left' | 'right';

type ParsedBinding = ParseResult['bindings'][number];
type ParsedMetadata = ParseResult['metadata'];

const DEFAULT_CONTEXTS = ['Global', 'Normal', 'Insert', 'Visual'];
const DEFAULT_SIDEBAR_WIDTH = 0;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 0; // 0 signals AppLayout to initialise this panel to its default 18vh height on first render
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 1000;
const MIN_BOTTOM_PANEL_HEIGHT = 60;
const MAX_BOTTOM_PANEL_HEIGHT = 800;
const DEFAULT_SUPPORTED_OS: SupportedOs = 'win';

const initialDetectedUserOs = detectUserOs();
const initialSupportedOs: SupportedOs = initialDetectedUserOs === 'unknown'
  ? DEFAULT_SUPPORTED_OS
  : initialDetectedUserOs;

const clampZoomLevel = (zoomLevel: number) =>
  Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, zoomLevel));

const clampSidebarWidth = (width: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

const clampBottomPanelHeight = (height: number) =>
  Math.min(MAX_BOTTOM_PANEL_HEIGHT, Math.max(MIN_BOTTOM_PANEL_HEIGHT, height));

const buildInteractionStateReset = () => ({
  selectedKey: null,
  hoveredKey: null,
  hoveredBindingSignature: null,
  hoveredContext: null,
  activeModifiers: [] as string[],
});

const sanitizeCustomInputMapping = (mapping: InputLayoutMapping): InputLayoutMapping => {
  const sanitizedMapping: InputLayoutMapping = {};

  for (const [sourceKey, mappedKey] of Object.entries(mapping)) {
    const normalizedSourceKey = sourceKey.trim().toLowerCase();
    const normalizedMappedKey = mappedKey.trim().toLowerCase();

    if (
      INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(normalizedSourceKey)
      && INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(normalizedMappedKey)
    ) {
      sanitizedMapping[normalizedSourceKey] = normalizedMappedKey;
    }
  }

  return sanitizedMapping;
};

const areInputMappingsEqual = (left: InputLayoutMapping, right: InputLayoutMapping): boolean => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  for (const [key, value] of leftEntries) {
    if (right[key] !== value) {
      return false;
    }
  }

  return true;
};

const getConflictingBindings = (bindings: ParsedBinding[]): ParsedBinding[] => {
  const groupedBindings = new Map<string, ParsedBinding[]>();

  for (const binding of bindings) {
    const conflictKey = getConflictIdentity(binding);
    const existingBindings = groupedBindings.get(conflictKey);

    if (existingBindings) {
      existingBindings.push(binding);
      continue;
    }

    groupedBindings.set(conflictKey, [binding]);
  }

  return Array.from(groupedBindings.values()).flatMap((group) => {
    if (group.length <= 1) {
      return [];
    }
    const uniqueCommands = new Set(group.map((b) => b.command));
    return uniqueCommands.size > 1 ? group : [];
  });
};
const deriveContexts = (bindings: ParsedBinding[]): string[] => {
  const contextSet = new Set<string>(['Global']);

  for (const binding of bindings) {
    if (!binding.when) continue;

    const parts = binding.when.split('&&');
    let baseContext = parts[0].trim().replace(/[()]/g, '');

    if (['normal', 'insert', 'visual', 'command', 'terminal'].includes(baseContext)) {
      baseContext = baseContext.charAt(0).toUpperCase() + baseContext.slice(1);
    }

    if (baseContext && baseContext.length < 50) {
      contextSet.add(baseContext);
    }
  }

  return Array.from(contextSet).slice(0, 20);
};

interface KeymapState {
  hasHydrated: boolean;
  bindings: ParsedBinding[];
  currentLayout: LayoutType;
  inputLayout: InputLayoutType;
  customInputMapping: InputLayoutMapping;
  os: SupportedOs;
  zoomLevel: number;
  conflicts: ParsedBinding[];
  warnings: ParseWarning[];
  parsedMetadata: ParsedMetadata | null;
  parsedOs: SupportedOs | null;
  selectedKey: string | null;
  hoveredKey: string | null;
  hoveredBindingSignature: string | null;
  hoveredContext: string | null;
  activeContext: string;
  contexts: string[];
  rawConfig: string | null;
  uploadedFilename: string | null;
  uploadedOs: DetectedConfigOs | null;
  uploadedFormat: DetectedEditorFormat | null;
  activeModifiers: string[];
  sidebarWidth: number;
  bottomPanelHeight: number;
  sidebarPosition: SidebarPosition;
  setHasHydrated: (hydrated: boolean) => void;
  setBindings: (bindings: ParsedBinding[]) => void;
  setCurrentLayout: (layout: LayoutType) => void;
  setInputLayout: (layout: InputLayoutType) => void;
  setCustomInputMapping: (mapping: InputLayoutMapping) => void;
  setOs: (os: SupportedOs) => void;
  setZoomLevel: (zoomLevel: number) => void;
  setConflicts: (conflicts: ParsedBinding[]) => void;
  setWarnings: (warnings: ParseWarning[]) => void;
  setParsedMetadata: (metadata: ParsedMetadata | null) => void;
  setParsedOs: (os: SupportedOs | null) => void;
  setSelectedKey: (key: string | null) => void;
  setHoveredKey: (key: string | null) => void;
  setHoveredBindingSignature: (signature: string | null) => void;
  setHoveredContext: (context: string | null) => void;
  setActiveContext: (context: string) => void;
  setContexts: (contexts: string[]) => void;
  setRawConfig: (config: string | null) => void;
  setUploadedConfig: (
    filename: string | null,
    os: DetectedConfigOs | null,
    format: DetectedEditorFormat | null,
  ) => void;
  setParseResult: (result: ParseResult | null) => void;
  setActiveModifiers: (modifiers: string[]) => void;
  toggleModifier: (modifier: string) => void;
  setSidebarWidth: (width: number) => void;
  setBottomPanelHeight: (height: number) => void;
  setSidebarPosition: (position: SidebarPosition) => void;
  toggleSidebarPosition: () => void;
}

export const useKeymapStore = create<KeymapState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      bindings: [],
      currentLayout: 'ansi-tkl',
      inputLayout: 'qwerty',
      customInputMapping: DEFAULT_CUSTOM_INPUT_MAPPING,
      os: initialSupportedOs,
      zoomLevel: 1,
      conflicts: [],
      warnings: [],
      parsedMetadata: null,
      parsedOs: null,
      selectedKey: null,
      hoveredKey: null,
      hoveredBindingSignature: null,
      hoveredContext: null,
      activeContext: 'Global',
      contexts: DEFAULT_CONTEXTS,
      rawConfig: null,
      uploadedFilename: null,
      uploadedOs: null,
      uploadedFormat: null,
      activeModifiers: [],
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      bottomPanelHeight: DEFAULT_BOTTOM_PANEL_HEIGHT,
      sidebarPosition: 'right',
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      setBindings: (bindings) =>
        set({
          bindings,
          conflicts: getConflictingBindings(bindings),
        }),
      setCurrentLayout: (layout) =>
        set((state) =>
          state.currentLayout === layout
            ? {}
            : {
              currentLayout: layout,
              ...buildInteractionStateReset(),
            }
        ),
      setInputLayout: (layout) =>
        set((state) =>
          state.inputLayout === layout
            ? {}
            : {
              inputLayout: layout,
              ...buildInteractionStateReset(),
            }
        ),
      setCustomInputMapping: (mapping) => {
        const sanitizedMapping = sanitizeCustomInputMapping(mapping);
        set((state) =>
          areInputMappingsEqual(state.customInputMapping, sanitizedMapping)
            ? {}
            : {
              customInputMapping: sanitizedMapping,
              ...buildInteractionStateReset(),
            }
        );
      },
      setOs: (os) =>
        set((state) =>
          state.os === os
            ? {}
            : {
              os,
              ...buildInteractionStateReset(),
            }
        ),
      setZoomLevel: (zoomLevel) => set({ zoomLevel: clampZoomLevel(zoomLevel) }),
      setConflicts: (conflicts) => set({ conflicts }),
      setWarnings: (warnings) => set({ warnings }),
      setParsedMetadata: (metadata) => set({ parsedMetadata: metadata }),
      setParsedOs: (parsedOs) => set({ parsedOs }),
      setSelectedKey: (key) => set({ selectedKey: key }),
      setHoveredKey: (key) => set({ hoveredKey: key }),
      setHoveredBindingSignature: (signature) => set({ hoveredBindingSignature: signature }),
      setHoveredContext: (context) => set({ hoveredContext: context }),
      setActiveContext: (context) => set({ activeContext: context }),
      setContexts: (contexts) => set({ contexts }),
      setRawConfig: (config) => set({ rawConfig: config }),
      setUploadedConfig: (filename, os, format) => set({ uploadedFilename: filename, uploadedOs: os, uploadedFormat: format }),
      setParseResult: (result) =>
        set((state) => {
          const newContexts = result ? deriveContexts(result.bindings) : DEFAULT_CONTEXTS;
          const newActiveContext = newContexts.includes(state.activeContext)
            ? state.activeContext
            : newContexts[0] ?? 'Global';

          return {
            bindings: result?.bindings ?? [],
            warnings: result?.warnings ?? [],
            conflicts: result ? getConflictingBindings(result.bindings) : [],
            parsedMetadata: result?.metadata ?? null,
            contexts: newContexts,
            activeContext: newActiveContext,
            ...buildInteractionStateReset(),
          };
        }),
      setActiveModifiers: (modifiers) => set({ activeModifiers: modifiers }),
      toggleModifier: (modifier) =>
        set((state) => {
          const isActive = state.activeModifiers.includes(modifier);
          return {
            activeModifiers: isActive
              ? state.activeModifiers.filter((currentModifier) => currentModifier !== modifier)
              : [...state.activeModifiers, modifier],
          };
        }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: clampSidebarWidth(width) }),
      setBottomPanelHeight: (height) =>
        set({ bottomPanelHeight: clampBottomPanelHeight(height) }),
      setSidebarPosition: (position) => set({ sidebarPosition: position }),
      toggleSidebarPosition: () =>
        set((state) => ({
          sidebarPosition: state.sidebarPosition === 'right' ? 'left' : 'right',
        })),
    }),
    {
      name: 'keymap-store',
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState: unknown, currentState) => {
        const persisted = (persistedState as Partial<KeymapState>) || {};
        const merged = { ...currentState, ...persisted };

        if (merged.inputLayout && !INPUT_LAYOUT_OPTIONS.includes(merged.inputLayout)) {
          merged.inputLayout = currentState.inputLayout;
        }

        if (merged.currentLayout && !LAYOUT_TYPES.includes(merged.currentLayout)) {
          merged.currentLayout = currentState.currentLayout;
        }

        return merged;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        bindings: state.bindings,
        conflicts: state.conflicts,
        currentLayout: state.currentLayout,
        inputLayout: state.inputLayout,
        customInputMapping: state.customInputMapping,
        os: state.os,
        zoomLevel: state.zoomLevel,
        warnings: state.warnings,
        parsedMetadata: state.parsedMetadata,
        parsedOs: state.parsedOs,
        selectedKey: state.selectedKey,
        activeContext: state.activeContext,
        contexts: state.contexts,
        rawConfig: state.rawConfig,
        uploadedFilename: state.uploadedFilename,
        uploadedOs: state.uploadedOs,
        uploadedFormat: state.uploadedFormat,
        sidebarWidth: state.sidebarWidth,
        bottomPanelHeight: state.bottomPanelHeight,
        sidebarPosition: state.sidebarPosition,
      }),
    }
  )
);
