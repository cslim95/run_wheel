import * as turf from '@turf/turf';

import { SEGMENT_DEGREES } from './constants';
import type { LngLat, ReachPoint, Run } from '../types';

export function tracksGeoJson(runs: Run[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: runs
      .filter((r) => r.coords.length >= 2)
      .map((r) => ({
        type: 'Feature',
        properties: { id: r.id },
        geometry: { type: 'LineString', coordinates: r.coords },
      })),
  };
}

export function reachMarkersGeoJson(
  reachPoints: ReachPoint[],
  maxReachM: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: reachPoints.map((rp) => ({
      type: 'Feature',
      properties: {
        run_id: rp.run_id,
        run_name: rp.run_name,
        distance_m: rp.distance_m,
        intensity: maxReachM > 0 ? rp.distance_m / maxReachM : 0,
      },
      geometry: { type: 'Point', coordinates: rp.coord },
    })),
  };
}

/**
 * Build segment fan polygons. For each occupied segment, render a wedge from
 * home along the segment's bearing range, terminating at the reach distance
 * curve. Empty segments are simply not drawn — that's the "skip empty" behaviour.
 *
 * The wedge is rendered as a triangle: home → arc-start → arc-end.
 * For visual consistency we colour each wedge by its intensity (distance / max).
 */
export function reachSegmentsGeoJson(
  home: LngLat,
  reachPoints: ReachPoint[],
  maxReachM: number,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const homePt = turf.point(home);
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  for (const rp of reachPoints) {
    const startBearing = rp.bearing_index * SEGMENT_DEGREES;
    const distKm = rp.distance_m / 1000;

    // Sample a few points along the arc for a smoother wedge edge.
    const arcSteps = 6;
    const ring: LngLat[] = [home];
    for (let s = 0; s <= arcSteps; s++) {
      const b = startBearing + (s / arcSteps) * SEGMENT_DEGREES;
      const p = turf.destination(homePt, distKm, b, { units: 'kilometers' });
      ring.push(p.geometry.coordinates as LngLat);
    }
    ring.push(home); // close

    features.push({
      type: 'Feature',
      properties: {
        bearing_index: rp.bearing_index,
        bearing_centre: rp.bearing_centre,
        distance_m: rp.distance_m,
        intensity: maxReachM > 0 ? rp.distance_m / maxReachM : 0,
        run_id: rp.run_id,
        run_name: rp.run_name,
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function fitBoundsForRuns(runs: Run[]): [LngLat, LngLat] | null {
  if (runs.length === 0) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const r of runs) {
    for (const [lng, lat] of r.coords) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
