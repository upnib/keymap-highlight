// DemoPresetModal.tsx - Centered modal wrapper for the shared demo preset picker on the main tool page.
// Reuses the same grouped preset UI as the landing page while giving desktop and mobile a more focused overlay.
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import type { DemoPresetId } from '../../constants/editors';
import { DemoPresetPicker } from './DemoPresetPicker';

type DemoPresetModalProps = {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onLoadPreset: (presetId: DemoPresetId) => void | Promise<void>;
};

export function DemoPresetModal({ isOpen, isLoading = false, onClose, onLoadPreset }: DemoPresetModalProps) {
  const { t } = useTranslation();

  const handleLoadPreset = async (presetId: DemoPresetId) => {
    onClose();
    await onLoadPreset(presetId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="3xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="none" mx={4}>
        <ModalHeader fontSize="md" pb={3}>
          {t('landingPage.loadDemoDefaultsAndPresets')}
        </ModalHeader>
        <ModalCloseButton borderRadius="none" />
        <ModalBody pb={6}>
          <DemoPresetPicker
            isLoading={isLoading}
            onLoadPreset={handleLoadPreset}
            columns={{ base: 1, sm: 2, lg: 3 }}
            minButtonHeight="48px"
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
