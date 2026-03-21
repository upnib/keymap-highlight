// FileUploader.tsx - Drag & Drop file upload component with fallback input
import { Box, Button, Text, useColorModeValue, useToast, VStack } from '@chakra-ui/react';
import { CloudArrowUpIcon } from '@heroicons/react/24/solid';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';

const FILE_ACCEPT = {
  'application/json': ['.json', '.jsonc'],
  'text/plain': ['.keymap', '.txt', '.vimrc', '.lua', '.el', '.emacs', '.nanorc', '.shortcuts', '.py'],
  'application/xml': ['.xml'],
};

interface FileUploaderProps {
  onUpload: (content: string, filename: string) => void;
  children?: React.ReactNode;
}

export function FileUploader({ onUpload, children }: FileUploaderProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const content = await file.text();
        onUpload(content, file.name);
      } catch {
        toast({
          title: t('uploader.errorReadingFileTitle'),
          description: t('uploader.errorReadingFileDescription'),
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [onUpload, t, toast]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: FILE_ACCEPT,
    multiple: false,
    noClick: true,
  });

  const activeBg = useColorModeValue('blue.50', 'whiteAlpha.100');

  return (
    <Box
      {...getRootProps()}
      position="relative"
      p={isDragActive ? 8 : 0}
      border={isDragActive ? '2px dashed' : 'none'}
      borderColor={isDragActive ? 'blue.400' : 'transparent'}
      bg={isDragActive ? activeBg : 'transparent'}
      borderRadius="none"
      transition="all 0.2s"
      _hover={{ borderColor: 'blue.300' }}
    >
      <input {...getInputProps()} data-testid="file-uploader-input" />

      {isDragActive && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={10}
          bg={activeBg}
          borderRadius="none"
        >
          <VStack spacing={2}>
            <CloudArrowUpIcon style={{ width: 48, height: 48, color: '#3182ce' }} />
            <Text color="blue.500" fontWeight="bold">
              {t('uploader.dropFileHere')}
            </Text>
          </VStack>
        </Box>
      )}

      <Box onClick={open}>
        {children ? (
          children
        ) : (
          <Button
            leftIcon={<CloudArrowUpIcon style={{ width: 20, height: 20 }} />}
            colorScheme="gray"
            variant="outline"
            borderRadius="none"
            pointerEvents={isDragActive ? 'none' : 'auto'}
          >
            {t('uploader.loadConfigFile')}
          </Button>
        )}
      </Box>
    </Box>
  );
}
