import type { ReachResult } from '../types';

interface Props {
  result: ReachResult;
  onResetHome: () => void;
}

function formatKm(meters: number): string {
  return (meters / 1000).toFixed(2) + ' km';
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export default function Stats({ result, onResetHome }: Props) {
  const { qualifyingRuns, reachPoints, totalRuns } = result;

  const maxReach = reachPoints.reduce(
    (best, p) => (p.distance_m > best.distance_m ? p : best),
    reachPoints[0],
  );
  const meanReach =
    reachPoints.length > 0
      ? reachPoints.reduce((s, p) => s + p.distance_m, 0) / reachPoints.length
      : 0;

  return (
    <div className="sidebar">
      <h1>Run Reach Map</h1>
      <div className="stat">
        <div className="label">Qualifying runs</div>
        <div className="value">{qualifyingRuns.length} of {totalRuns}</div>
        <div className="hint">runs starting or ending within 500m of home</div>
      </div>
      {maxReach && (
        <div className="stat">
          <div className="label">Max reach</div>
          <div className="value">{formatKm(maxReach.distance_m)}</div>
          <div className="hint">{maxReach.run_name} · {formatDate(maxReach.run_date)}</div>
        </div>
      )}
      {reachPoints.length > 0 && (
        <>
          <div className="stat">
            <div className="label">Average reach</div>
            <div className="value">{formatKm(meanReach)}</div>
          </div>
          <div className="stat">
            <div className="label">Segments with data</div>
            <div className="value">{reachPoints.length} of 18</div>
          </div>
        </>
      )}
      <button className="reset-btn" onClick={onResetHome}>Reset home location</button>
    </div>
  );
}
