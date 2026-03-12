// InfoPanel - right-sidebar metadata and reusable binding list container.
// Keeps overview stats above the list when no key is selected.
// Reuses BindingList for full and selected-key filtered list behavior.
// Ensures nested list area can shrink correctly in flex layouts to avoid being obscured by sibling panels.
// Treats uploaded OS "unknown" as OS-unspecified to avoid converted source labels.
import { useMemo } from 'react';
import {
  Badge,
  Box,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useKeymapStore } from '../../store/useKeymapStore';
import { BindingList } from '../ListView/BindingList';

function splitSourceNameLabel(sourceName: string): {
  prefix: string;
  filename: string;
} {
  const taggedNameMatch = sourceName.match(/^(\([^)]*\)\s+)(.+)$/);

  if (!taggedNameMatch) {
    return {
      prefix: '',
      filename: sourceName,
    };
  }

  return {
    prefix: taggedNameMatch[1],
    filename: taggedNameMatch[2],
  };
}

function OverviewStats({
  totalBindings,
  totalConflicts,
  totalWarnings,
  sourceName,
}: {
  totalBindings: number;
  totalConflicts: number;
  totalWarnings: number;
  sourceName: string | null;
}) {
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const valueColor = useColorModeValue('gray.800', 'gray.100');
  const cardBg = useColorModeValue('gray.50', 'gray.750');
  const { t } = useTranslation();
  const sourceLabel = sourceName ? splitSourceNameLabel(sourceName) : null;

  return (
    <VStack align="stretch" spacing={4} mb={4} flexShrink={0}>
      <HStack spacing={2} align="center">
        <Icon
          as={InformationCircleIcon}
          boxSize={5}
          color="gray.400"
          aria-hidden="true"
        />
        <Heading as="h3" size="sm" color={valueColor}>
          {t('infoPanel.layoutOverview')}
        </Heading>
        {sourceLabel && (
          <Badge colorScheme="gray" variant="subtle" fontSize="2xs" borderRadius="none" textTransform="none">
            {sourceLabel.prefix}
            <Text as="span" fontFamily="mono" fontSize="sm">
              {sourceLabel.filename}
            </Text>
          </Badge>
        )}
      </HStack>

      <HStack spacing={3}>
        <StatCard
          label={t('infoPanel.bindings')}
          value={totalBindings}
          bg={cardBg}
          valueColor={valueColor}
          labelColor={labelColor}
          testId="stat-bindings"
        />
        <StatCard
          label={t('infoPanel.conflicts')}
          value={totalConflicts}
          bg={cardBg}
          valueColor={totalConflicts > 0 ? 'red.500' : valueColor}
          labelColor={labelColor}
        />
        <StatCard
          label={t('infoPanel.warnings')}
          value={totalWarnings}
          bg={cardBg}
          valueColor={totalWarnings > 0 ? 'yellow.500' : valueColor}
          labelColor={labelColor}
        />
      </HStack>

      {totalBindings === 0 && (
        <Text fontSize="sm" color={labelColor} fontStyle="italic">
          {t('infoPanel.emptyOverview')}
        </Text>
      )}
    </VStack>
  );
}

function StatCard({
  label,
  value,
  bg,
  valueColor,
  labelColor,
  testId,
}: {
  label: string;
  value: number;
  bg: string;
  valueColor: string;
  labelColor: string;
  testId?: string;
}) {
  return (
    <Box
      flex="1"
      bg={bg}
      borderRadius="none"
      p={1}
      textAlign="center"
      data-testid={testId}
    >
      <Text fontSize="lg" fontWeight="semibold" color={valueColor}>
        {value}
      </Text>
      <Text fontSize="2xs" color={labelColor} textTransform="uppercase">
        {label}
      </Text>
    </Box>
  );
}

export function InfoPanel() {
  const bindings = useKeymapStore((s) => s.bindings);
  const conflicts = useKeymapStore((s) => s.conflicts);
  const os = useKeymapStore((s) => s.os);
  const uploadedFilename = useKeymapStore((s) => s.uploadedFilename);
  const uploadedOs = useKeymapStore((s) => s.uploadedOs);
  const parsedMetadata = useKeymapStore((s) => s.parsedMetadata);

  const displaySourceName = useMemo(() => {
    const metadataName = parsedMetadata?.sourceName ?? null;
    if (metadataName?.startsWith('(demo)')) {
      return metadataName;
    }
    if (!uploadedFilename) {
      return metadataName ?? parsedMetadata?.sourceEditor ?? null;
    }
    if (!uploadedOs || uploadedOs === 'unknown' || os === uploadedOs) {
      return uploadedFilename;
    }
    const osLabel = os === 'win' ? 'Windows' : os === 'mac' ? 'MacOS' : 'Linux';
    return `(convert for ${osLabel}) ${uploadedFilename}`;
  }, [os, parsedMetadata?.sourceEditor, parsedMetadata?.sourceName, uploadedFilename, uploadedOs]);

  return (
    <Box data-testid="info-panel" display="flex" flexDirection="column" h="full" minH={0} overflow="hidden">
      <Box flex="1" display="flex" flexDirection="column" minH={0} overflow="hidden">
        <OverviewStats
          totalBindings={bindings.length}
          totalConflicts={conflicts.length}
          totalWarnings={parsedMetadata?.totalWarnings ?? 0}
          sourceName={displaySourceName}
        />
        <BindingList />
      </Box>
    </Box>
  );
}
