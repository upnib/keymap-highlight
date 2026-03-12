// WarningBanner.tsx - Displays parsing warnings with collapsible details
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  CloseButton,
  Collapse,
  List,
  ListItem,
  Text,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeymapStore } from '../../store/useKeymapStore';

export const WarningBanner = () => {
  const { t } = useTranslation();
  const warnings = useKeymapStore((state) => state.warnings);
  const { isOpen, onOpen, onClose, onToggle } = useDisclosure({ defaultIsOpen: true });
  const detailsColor = useColorModeValue('gray.600', 'gray.300');
  const warningTextColor = useColorModeValue('gray.600', 'gray.300');
  const warningCodeColor = useColorModeValue('gray.500', 'gray.400');
  const scrollThumbColor = useColorModeValue('gray.300', 'gray.600');

  useEffect(() => {
    if (warnings.length > 0) {
      onOpen();
    }
  }, [warnings, onOpen]);

  if (warnings.length === 0) return null;

  return (
    <Box data-testid="warning-banner">
      <Alert status="warning" variant="left-accent" borderRadius="none">
        <AlertIcon alignSelf="flex-start" mt={1} />
        <Box flex="1">
          <AlertTitle fontSize="sm" mb={1}>
            {t('warning.bannerTitle', { count: warnings.length })}
          </AlertTitle>
          <AlertDescription display="block">
            <Text
              fontSize="xs"
              color={detailsColor}
              onClick={onToggle}
              cursor="pointer"
              _hover={{ textDecoration: 'underline' }}
              mb={isOpen ? 2 : 0}
            >
              {isOpen ? t('warning.hideDetails') : t('warning.showDetails')}
            </Text>
            <Collapse in={isOpen} animateOpacity>
              <List
                spacing={1}
                maxH="150px"
                overflowY="auto"
                sx={{
                  '&::-webkit-scrollbar': { width: '4px' },
                  '&::-webkit-scrollbar-track': { width: '6px' },
                  '&::-webkit-scrollbar-thumb': { background: scrollThumbColor, borderRadius: '0' },
                }}
              >
              {warnings.map((w) => (
                  <ListItem key={`${w.line ?? '0'}-${w.code ?? w.message}`} fontSize="xs" color={warningTextColor}>
                    <Text as="span" fontWeight="bold" mr={1}>
                      {t('warning.lineLabel')} {w.line || '?'}:
                    </Text>
                    {w.message}
                    {w.code && (
                      <Text as="span" ml={1} color={warningCodeColor}>
                        ({w.code})
                      </Text>
                    )}
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </AlertDescription>
        </Box>
        <CloseButton
          position="absolute"
          right="8px"
          top="8px"
          onClick={onClose}
          size="sm"
          borderRadius="none"
        />
      </Alert>
    </Box>
  );
};
