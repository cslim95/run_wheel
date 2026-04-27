import * as turf from '@turf/turf';

import { HOME_RADIUS_M, MIN_REACH_M, MIN_RUNS, SEGMENT_COUNT, SEGMENT_DEGREES } from './constants';
import type { LngLat, ReachPoint, ReachResult, Run } from '../types';

export function computeReach(runs: Run[], home: LngLat): ReachResult {
  const homePt = turf.point(home);

  const qualifyingRuns = runs.filter((r) => {
    if (!r.coords.length) return false;
    const start = turf.point(r.coords[0]);
    const end = turf.point(r.coords[r.coords.length - 1]);
    const startDist = turf.distance(homePt, start, { units: 'meters' });
    const endDist = turf.distance(homePt, end, { units: 'meters' });
    return startDist <= HOME_RADIUS_M || endDist <= HOME_RADIUS_M;
  });

  if (qualifyingRuns.length < MIN_RUNS) {
    return { qualifyingRuns, reachPoints: [], totalRuns: runs.length };
  }

  const buckets: (ReachPoint | null)[] = Array(SEGMENT_COUNT).fill(null);

  for (const run of qualifyingRuns) {
    for (const coord of run.coords) {
      const pt = turf.point(coord);
      const dist = turf.distance(homePt, pt, { units: 'meters' });
      if (dist < MIN_REACH_M) continue;
      let bearing = turf.bearing(homePt, pt);
      if (bearing < 0) bearing += 360;
      const idx = Math.floor(bearing / SEGMENT_DEGREES) % SEGMENT_COUNT;

      const current = buckets[idx];
      if (!current || dist > current.distance_m) {
        buckets[idx] = {
          bearing_centre: idx * SEGMENT_DEGREES + SEGMENT_DEGREES / 2,
          bearing_index: idx,
          distance_m: dist,
          coord,
          run_id: run.id,
          run_name: run.name,
          run_date: run.start_date,
        };
      }
    }
  }

  return {
    qualifyingRuns,
    reachPoints: buckets.filter((b): b is ReachPoint => b !== null),
    totalRuns: runs.length,
  };
}
