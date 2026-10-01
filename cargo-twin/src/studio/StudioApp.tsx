import { useStudio } from './useStudio';
import { StudioWorkspace } from './StudioWorkspace';
import './studio.css';
import './usability.css';

export function StudioApp({ onOpenAircraft }: { onOpenAircraft?: () => void }) {
  const studio = useStudio();
  return <StudioWorkspace studio={studio} onOpenAircraft={onOpenAircraft} />;
}
