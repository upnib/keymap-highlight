// SidePanel.tsx — Side panel with a compact metadata bar and full binding list.
// The main title uses mono font, while mobile actions reuse the shared demo picker modal for consistency.
// Desktop mode keeps a strict flex/min-height chain so the list viewport is limited to the top edge of the bottom panel.
import { useState } from 'react';
import { Box, Button, HStack, Heading, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { DocumentArrowUpIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import type { ConfigParserControls } from '../../hooks/useConfigParser';
import { DemoPresetModal } from '../DemoPresetPicker/DemoPresetModal';
import { FileUploader } from '../Uploader/FileUploader';
import { WarningBanner } from './WarningBanner';
import { InfoPanel } from './InfoPanel';

type SidePanelProps = {
  parser: ConfigParserControls;
};

export function SidePanel({ parser }: SidePanelProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isDemoPresetModalOpen, setIsDemoPresetModalOpen] = useState(false);
  const sectionBorder = useColorModeValue('gray.300', 'whiteAlpha.200');
  const panelBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const noticeBg = useColorModeValue('gray.50', 'gray.750');
  const noticeText = useColorModeValue('orange.700', 'orange.300');

  const { isParsing, handleUpload, handleLoadDemo } = parser;

  return (
    <>
      <VStack spacing={0} align="stretch" h="full" minH={0} bg={panelBg}>
        <Box px={4} pt={3} pb={2} borderBottom="1px" borderColor={sectionBorder}>
          <Heading
            as="h1"
            size="sm"
            mb={1}
            letterSpacing="tight"
            fontFamily="mono"
            _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
            display="inline-block"
            onClick={() => setLocation('/index')}
          >
            {t('app.name')}
          </Heading>
          <Text fontSize="xs" color={textColor} noOfLines={2}>
            {t('app.description')}
          </Text>
        </Box>

        <Box
          display={{ base: 'block', md: 'none' }}
          px={4}
          py={3}
          borderBottom="1px"
          borderColor={sectionBorder}
          bg={noticeBg}
          data-testid="mobile-notice"
        >
          <Text fontSize={{ base: 'md', md: 'lg' }} color={noticeText} mb={2}>
            {t('mobile.notice')}
          </Text>
          <HStack spacing={2}>
            <FileUploader onUpload={handleUpload}>
              <Button
                leftIcon={<DocumentArrowUpIcon width={14} height={14} />}
                size="xs"
                colorScheme="gray"
                borderRadius="none"
                isLoading={isParsing}
              >
                {t('mobile.loadConfig')}
              </Button>
            </FileUploader>
            <Button
              size="xs"
              variant="outline"
              borderRadius="none"
              isDisabled={isParsing}
              onClick={() => setIsDemoPresetModalOpen(true)}
            >
              {t('mobile.loadDemo')}
            </Button>
          </HStack>
        </Box>

        <Box flex="1" minH={0} overflow="hidden" display="flex" flexDirection="column" px={4} py={4}>
          <VStack spacing={4} align="stretch" flex="1" minH={0} overflow="hidden">
            <WarningBanner />
            <InfoPanel />
          </VStack>
        </Box>
      </VStack>
      <DemoPresetModal
        isOpen={isDemoPresetModalOpen}
        isLoading={isParsing}
        onClose={() => setIsDemoPresetModalOpen(false)}
        onLoadPreset={handleLoadDemo}
      />
    </>
  );
}
