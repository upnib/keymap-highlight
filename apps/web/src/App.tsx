// App.tsx — Root component that conditionally renders EmptyState or the main layout.
// Mounts useOsReparse once in MainApp to ensure OS-change re-parse runs from a single location.
import { lazy, Suspense, useMemo, useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Route, Switch, useLocation } from 'wouter';
import { parseKleLayout } from '@keymap-highlight/file-parsers';
import { layouts } from '@keymap-highlight/layout-pipeline';
import { useKeymapStore } from './store/useKeymapStore';
import { useConfigParser } from './hooks/useConfigParser';
import { useOsReparse } from './hooks/useOsReparse';

const KeyboardCanvas = lazy(() => import('./components/KeyboardCanvas/KeyboardCanvas').then((m) => ({ default: m.KeyboardCanvas })));
const AppLayout = lazy(() => import('./components/Layout/AppLayout').then((m) => ({ default: m.AppLayout })));
const BottomPanel = lazy(() => import('./components/BottomPanel/BottomPanel').then((m) => ({ default: m.BottomPanel })));
const SidePanel = lazy(() => import('./components/SidePanel/SidePanel').then((m) => ({ default: m.SidePanel })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));

function MainApp() {
  const hasHydrated = useKeymapStore((state) => state.hasHydrated);
  const selectedLayout = useKeymapStore((state) => state.currentLayout);
  const bindings = useKeymapStore((state) => state.bindings);
  const rawConfig = useKeymapStore((state) => state.rawConfig);
  const uploadedFilename = useKeymapStore((state) => state.uploadedFilename);
  const parsedLayout = useMemo(() => parseKleLayout(layouts[selectedLayout]), [selectedLayout]);
  const [, setLocation] = useLocation();
  const parser = useConfigParser();
  const hasLoadedConfig = rawConfig !== null || uploadedFilename !== null;

  useOsReparse(parser.parseWithOs, parser.loadDemoForOs);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (bindings.length === 0 && !hasLoadedConfig) {
      setLocation('/index');
    }
  }, [bindings.length, hasHydrated, hasLoadedConfig, setLocation]);

  if (!hasHydrated || (!hasLoadedConfig && bindings.length === 0)) {
    return (
      <Center h="100vh">
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <AppLayout sidebar={<SidePanel parser={parser} />} bottomPanel={<BottomPanel parser={parser} />}>
      <KeyboardCanvas layout={parsedLayout} />
    </AppLayout>
  );
}

function App() {
  return (
    <Suspense fallback={<Center h="100vh"><Spinner size="lg" /></Center>}>
      <Switch>
        <Route path="/index" component={LandingPage} />
        <Route path="/" component={MainApp} />
        <Route component={MainApp} />
      </Switch>
    </Suspense>
  );
}

export default App;
