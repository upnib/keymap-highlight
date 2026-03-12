// InputLayoutSelector.tsx - Selects typing layout remap and accepts custom JSON key-to-key mapping via file upload.
import {
  INPUT_LAYOUT_CUSTOM_KEY_PATTERN,
  INPUT_LAYOUT_OPTIONS,
  type InputLayoutMapping,
  type InputLayoutType,
} from '@keymap-highlight/layout-pipeline';
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  Input,
  Select,
  Text,
} from '@chakra-ui/react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeymapStore } from '../../store/useKeymapStore';

const normalizeCustomInputMapping = (rawMapping: unknown): InputLayoutMapping | null => {
  if (!rawMapping || typeof rawMapping !== 'object' || Array.isArray(rawMapping)) {
    return null;
  }

  const normalizedMapping: InputLayoutMapping = {};

  for (const [sourceKey, targetKey] of Object.entries(rawMapping)) {
    if (typeof targetKey !== 'string') {
      return null;
    }

    const normalizedSourceKey = sourceKey.trim().toLowerCase();
    const normalizedTargetKey = targetKey.trim().toLowerCase();

    if (
      !INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(normalizedSourceKey)
      || !INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(normalizedTargetKey)
    ) {
      return null;
    }

    normalizedMapping[normalizedSourceKey] = normalizedTargetKey;
  }

  return normalizedMapping;
};

export const InputLayoutSelector = () => {
  const { t } = useTranslation();
  const inputLayout = useKeymapStore((state) => state.inputLayout);
  const setInputLayout = useKeymapStore((state) => state.setInputLayout);
  const customInputMapping = useKeymapStore((state) => state.customInputMapping);
  const setCustomInputMapping = useKeymapStore((state) => state.setCustomInputMapping);

  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLayoutChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setInputLayout(event.target.value as InputLayoutType);
    setMappingError(null);
    setUploadedFilename(null);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMappingError(null);
    setUploadedFilename(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') return;

      try {
        const parsedMapping = JSON.parse(text) as unknown;
        const normalizedMapping = normalizeCustomInputMapping(parsedMapping);

        if (!normalizedMapping) {
          setMappingError(t('settings.inputLayoutErrorFormat'));
          return;
        }

        setCustomInputMapping(normalizedMapping);
        setMappingError(null);
      } catch {
        setMappingError(t('settings.inputLayoutErrorJson'));
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const customKeyCount = Object.keys(customInputMapping).length;

  return (
    <FormControl isInvalid={inputLayout === 'custom' && Boolean(mappingError)}>
      <Select
        id="input-layout-select"
        value={inputLayout}
        onChange={handleLayoutChange}
        size="xs"
        h="28px"
        borderRadius="none"
        data-testid="input-layout-selector"
      >
        {INPUT_LAYOUT_OPTIONS.map((layoutOption) => (
          <option key={layoutOption} value={layoutOption}>
            {t(`settings.inputLayoutOptions.${layoutOption}`)}
          </option>
        ))}
      </Select>

      {inputLayout === 'custom' ? (
        <>
          <FormHelperText>
            {t('settings.inputLayoutHelper', { example: '{"a":"b","s":"r"}' })}
          </FormHelperText>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            display="none"
            onChange={handleFileUpload}
            data-testid="custom-input-layout-file-input"
          />
          <Button
            mt={2}
            size="xs"
            variant="outline"
            borderRadius="none"
            onClick={() => fileInputRef.current?.click()}
            title={t('settings.inputLayoutLoadTooltip')}
            data-testid="custom-input-layout-upload-button"
          >
            {t('settings.inputLayoutLoadButton')}
          </Button>
          {uploadedFilename && !mappingError ? (
            <Box mt={1}>
              <Text fontSize="xs" color="green.500" noOfLines={1}>
                <Text as="span" fontFamily="mono" fontSize="sm">{uploadedFilename}</Text>
                {customKeyCount > 0 ? ` (${customKeyCount} keys)` : ''}
              </Text>
            </Box>
          ) : null}
          {mappingError ? <FormErrorMessage>{mappingError}</FormErrorMessage> : null}
        </>
      ) : null}
    </FormControl>
  );
};
