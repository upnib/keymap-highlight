// main.tsx - Application entry point. Mounts the React root inside #root, wraps the tree
// with ChakraProvider for the custom theme, and injects ColorModeScript for SSR-safe dark mode.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import './i18n';
import theme from './theme';
import './styles/globals.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
