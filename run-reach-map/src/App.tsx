import { useEffect, useMemo, useState } from 'react';

import HomePinSetup from './components/HomePinSetup';
import Map from './components/Map';
import Stats from './components/Stats';
import { MIN_RUNS } from './lib/constants';
import { loadRuns } from './lib/loadRuns';
import { computeReach } from './lib/reach';
import { clearHome, getHome, setHome } from './lib/storage';
import type { LngLat, Run } from './types';
import './App.css';

export default function App() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [home, setHomeState] = useState<LngLat | null>(() => getHome());

  useEffect(() => {
    loadRuns()
      .then(({ runs }) => setRuns(runs))
      .catch((e) => setError(String(e)));
  }, []);

  const result = useMemo(() => {
    if (!runs || !home) return null;
    return computeReach(runs, home);
  }, [runs, home]);

  const handleMapClick = (lngLat: LngLat) => {
    if (!home) {
      setHome(lngLat);
      setHomeState(lngLat);
    }
  };

  const handleReset = () => {
    clearHome();
    setHomeState(null);
  };

  if (error) {
    return (
      <div className="message">
        <h2>Failed to load runs.json</h2>
        <p>{error}</p>
        <p className="hint">Run <code>python extract.py --export</code> to generate it.</p>
      </div>
    );
  }

  if (!runs) {
    return <div className="message">Loading runs…</div>;
  }

  const setupMode = !home;
  const tooFew = result !== null && result.qualifyingRuns.length < MIN_RUNS;

  return (
    <div className="app">
      <Map
        runs={runs}
        home={home}
        reachPoints={result?.reachPoints ?? []}
        setupMode={setupMode}
        onMapClick={handleMapClick}
      />
      {setupMode && <HomePinSetup runCount={runs.length} />}
      {!setupMode && result && !tooFew && (
        <Stats result={result} onResetHome={handleReset} />
      )}
      {!setupMode && result && tooFew && (
        <div className="sidebar">
          <h1>Not enough runs from here</h1>
          <p>
            Only {result.qualifyingRuns.length} of {result.totalRuns} runs
            start within 500m of this location. Need at least {MIN_RUNS}.
          </p>
          <button className="reset-btn" onClick={handleReset}>
            Try a different location
          </button>
        </div>
      )}
    </div>
  );
}
