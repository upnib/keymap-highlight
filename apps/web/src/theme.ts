// theme.ts - Chakra UI theme configuration for Keymap Highlight.
// Dark-mode first with IBM Plex Sans font family and brand color palette.
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  radii: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
  fonts: {
    heading: '"Inter", "IBM Plex Sans", "Segoe UI Variable", sans-serif',
    body: '"Inter", "IBM Plex Sans", "Segoe UI Variable", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  styles: {
    global: (props: Record<string, unknown>) => ({
      body: {
        bg: 'transparent',
        color: mode('gray.800', 'gray.100')(props),
        lineHeight: '1.4',
      },
      option: {
        backgroundColor: mode('white', 'gray.700')(props),
        color: mode('gray.800', 'gray.100')(props),
      },
      optgroup: {
        backgroundColor: mode('white', 'gray.700')(props),
        color: mode('gray.800', 'gray.100')(props),
      },
    }),
  },
  colors: {
    brand: {
      50: '#F3F4F6',
      100: '#E5E7EB',
      200: '#D1D5DB',
      300: '#9CA3AF',
      400: '#6B7280',
      500: '#4B5563',
      600: '#374151',
      700: '#1F2937',
      800: '#111827',
      900: '#030712',
    },
    gray: {
      750: '#2A303C',
    },
    key: {
      standardLight: '#F9FAFB',
      standardDark: '#1F2937',
      standardStrokeLight: '#D1D5DB',
      standardStrokeDark: '#374151',
      standardTextLight: '#111827',
      standardTextDark: '#F3F4F6',
      modifierLight: '#F3F4F6',
      modifierDark: '#111827',
      modifierStrokeLight: '#9CA3AF',
      modifierStrokeDark: '#4B5563',
      modifierTextLight: '#374151',
      modifierTextDark: '#D1D5DB',
      modifierActiveFill: '#4B5563',
      modifierActiveText: '#FFFFFF',
      actionFillLight: '#E5E7EB',
      actionFillDark: '#374151',
      actionStrokeLight: '#6B7280',
      actionStrokeDark: '#9CA3AF',
      actionTextLight: '#1F2937',
      actionTextDark: '#F9FAFB',
      conflictStrokeLight: '#EF4444',
      conflictStrokeDark: '#DC2626',
      conflictShadowLight: '#FCA5A5',
      conflictShadowDark: '#991B1B',
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'medium',
        borderRadius: 'md',
        letterSpacing: '0.01em',
      },
      defaultProps: {
        colorScheme: 'gray',
      },
    },
    Select: {
      baseStyle: {
        field: {
          borderRadius: 'md',
        },
      },
      defaultProps: {
        focusBorderColor: 'gray.500',
      },
    },
    Input: {
      baseStyle: {
        field: {
          borderRadius: 'md',
        },
      },
      defaultProps: {
        focusBorderColor: 'gray.500',
      },
    },
    Textarea: {
      baseStyle: {
        borderRadius: 'md',
      },
      defaultProps: {
        focusBorderColor: 'gray.500',
      },
    },
    Tabs: {
      variants: {
        line: (props: Record<string, unknown>) => ({
          tab: {
            borderBottom: '2px solid',
            borderColor: 'transparent',
            px: 3,
            py: 2,
            borderRadius: 'md',
            borderBottomRadius: 'none',
            fontSize: 'sm',
            fontWeight: 'medium',
            transition: 'color 0.2s, border-color 0.2s',
            _selected: {
              color: mode('gray.800', 'gray.100')(props),
              borderColor: mode('gray.600', 'gray.400')(props),
            },
          },
          tablist: {
            borderColor: 'transparent',
          },
        }),
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'sm',
      },
    },
    Alert: {
      baseStyle: {
        container: {
          borderRadius: 'md',
        },
      },
    },
  },
});

export default theme;
