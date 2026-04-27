import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';

import { computeReach } from './reach';
import { MIN_RUNS, SEGMENT_COUNT } from './constants';
import type { LngLat, Run } from '../types';

const HOME: LngLat = [151.2093, -33.8688]; // Sydney CBD-ish, [lng, lat]

function makeRun(id: number, points: LngLat[], name = `Run ${id}`): Run {
  return { id, name, coords: points };
}

// Build a run that goes from `start` along `bearingDeg` for `distanceM` metres,
// sampled every 100m.
function radial(id: number, start: LngLat, bearingDeg: number, distanceM: number): Run {
  const startPt = turf.point(start);
  const points: LngLat[] = [start];
  const step = 100;
  for (let d = step; d <= distanceM; d += step) {
    const dest = turf.destination(startPt, d / 1000, bearingDeg, { units: 'kilometers' });
    points.push(dest.geometry.coordinates as LngLat);
  }
  return makeRun(id, points);
}

function reverseCoords(run: Run): Run {
  return { ...run, coords: [...run.coords].reverse() };
}

describe('computeReach', () => {
  it('returns no reach points when fewer than MIN_RUNS qualify', () => {
    const runs = [
      radial(1, HOME, 0, 1000),
      radial(2, HOME, 90, 1000),
    ];
    const result = computeReach(runs, HOME);
    expect(result.qualifyingRuns.length).toBe(2);
    expect(result.reachPoints).toHaveLength(0);
    expect(result.totalRuns).toBe(2);
  });

  it('captures the maximum-distance point per 20° segment', () => {
    // 5 radial runs at 0°, 90°, 180°, 270°, and a long one at ~45°
    const runs = [
      radial(1, HOME, 0, 2000),
      radial(2, HOME, 90, 1500),
      radial(3, HOME, 180, 1000),
      radial(4, HOME, 270, 800),
      radial(5, HOME, 45, 5000),
    ];
    const result = computeReach(runs, HOME);
    expect(result.qualifyingRuns).toHaveLength(MIN_RUNS);
    expect(result.reachPoints.length).toBeGreaterThanOrEqual(5);
    expect(result.reachPoints.length).toBeLessThanOrEqual(SEGMENT_COUNT);

    // Segment for 45° is index Math.floor(45/20) = 2 (40°-60°)
    const seg45 = result.reachPoints.find((p) => p.bearing_index === 2);
    expect(seg45).toBeDefined();
    expect(seg45!.run_id).toBe(5);
    expect(seg45!.distance_m).toBeGreaterThan(4500);
  });

  it('qualifies runs that end at home even if they start far away', () => {
    // Five reverse-direction runs: each starts away from home, ends at home.
    const runs = [
      reverseCoords(radial(1, HOME, 0, 1500)),
      reverseCoords(radial(2, HOME, 90, 1500)),
      reverseCoords(radial(3, HOME, 180, 1500)),
      reverseCoords(radial(4, HOME, 270, 1500)),
      reverseCoords(radial(5, HOME, 45, 2500)),
    ];
    const result = computeReach(runs, HOME);
    expect(result.qualifyingRuns).toHaveLength(5);
    expect(result.reachPoints.length).toBeGreaterThanOrEqual(5);
  });

  it('excludes runs whose endpoints are both far from home (passing-through)', () => {
    const farStart: LngLat = [151.5, -33.8688]; // ~25km east of HOME
    // A run that goes from far east, westward through HOME's vicinity, and
    // continues out the other side. Neither endpoint is near home.
    const passing = radial(99, farStart, 270, 50000);
    const baseline = [
      radial(1, HOME, 0, 1000),
      radial(2, HOME, 45, 1000),
      radial(3, HOME, 90, 1000),
      radial(4, HOME, 135, 1000),
      radial(5, HOME, 180, 1000),
    ];
    const result = computeReach([...baseline, passing], HOME);
    expect(result.qualifyingRuns.find((r) => r.id === 99)).toBeUndefined();
    expect(result.qualifyingRuns).toHaveLength(5);
  });

  it('excludes runs whose start point is outside HOME_RADIUS_M', () => {
    const farHome: LngLat = [151.5, -33.8688]; // ~25km east
    const runs = [
      radial(1, HOME, 0, 1000),
      radial(2, HOME, 45, 1000),
      radial(3, HOME, 90, 1000),
      radial(4, HOME, 135, 1000),
      radial(5, HOME, 180, 1000),
      radial(6, farHome, 0, 1000), // starts far from HOME
    ];
    const result = computeReach(runs, HOME);
    expect(result.qualifyingRuns).toHaveLength(5);
    expect(result.qualifyingRuns.find((r) => r.id === 6)).toBeUndefined();
  });

  it('leaves segments empty when no points fall in them', () => {
    // 5 runs all heading roughly east — most segments should be empty.
    const runs = [
      radial(1, HOME, 80, 1000),
      radial(2, HOME, 85, 1000),
      radial(3, HOME, 90, 1000),
      radial(4, HOME, 95, 1000),
      radial(5, HOME, 100, 1000),
    ];
    const result = computeReach(runs, HOME);
    expect(result.reachPoints.length).toBeGreaterThan(0);
    expect(result.reachPoints.length).toBeLessThan(SEGMENT_COUNT);
    // All occupied segments should be near the east bearing band (60°-120°).
    for (const pt of result.reachPoints) {
      expect(pt.bearing_centre).toBeGreaterThanOrEqual(60);
      expect(pt.bearing_centre).toBeLessThanOrEqual(120);
    }
  });
});
