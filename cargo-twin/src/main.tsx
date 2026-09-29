import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { StudioApp } from './studio/StudioApp';

const AircraftApp = lazy(() => Promise.all([
  import('./ui/App'),
  import('./styles/app.css'),
]).then(([module]) => ({ default: module.App })));

const aircraftWorkspace = new URLSearchParams(window.location.search).get('workspace') === 'aircraft';

function openAircraft() {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', 'aircraft');
  window.location.assign(url.href);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p style={{ padding: 24 }}>Opening Cargo Twin…</p>}>
      {aircraftWorkspace ? <AircraftApp /> : <StudioApp onOpenAircraft={openAircraft} />}
    </Suspense>
  </StrictMode>,
);
