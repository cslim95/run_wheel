import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap, LngLatBoundsLike, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { fitBoundsForRuns, reachMarkersGeoJson, reachSegmentsGeoJson, tracksGeoJson } from '../lib/geo';
import type { LngLat, ReachPoint, Run } from '../types';

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const SRC_TRACKS = 'tracks';
const SRC_SEGMENTS = 'segments';
const SRC_REACH = 'reach';
const LYR_TRACKS = 'tracks-line';
const LYR_SEGMENTS_FILL = 'segments-fill';
const LYR_SEGMENTS_LINE = 'segments-line';
const LYR_REACH_POINTS = 'reach-points';

interface Props {
  runs: Run[];
  home: LngLat | null;
  reachPoints: ReachPoint[];
  setupMode: boolean;
  onMapClick?: (lngLat: LngLat) => void;
}

export default function Map({ runs, home, reachPoints, setupMode, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const homeMarkerRef = useRef<Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE,
      center: home ?? [151.2093, -33.8688],
      zoom: 11,
    });
    mapRef.current = map;

    map.on('click', (e) => {
      onMapClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    });

    map.on('load', () => {
      map.addSource(SRC_TRACKS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(SRC_SEGMENTS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource(SRC_REACH, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: LYR_TRACKS,
        type: 'line',
        source: SRC_TRACKS,
        paint: {
          'line-color': '#dc2626',
          'line-opacity': 0.35,
          'line-width': 2,
        },
      });

      map.addLayer({
        id: LYR_SEGMENTS_FILL,
        type: 'fill',
        source: SRC_SEGMENTS,
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'intensity'],
            0, '#fde68a',
            0.5, '#f97316',
            1, '#7c2d12',
          ],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: LYR_SEGMENTS_LINE,
        type: 'line',
        source: SRC_SEGMENTS,
        paint: {
          'line-color': '#7c2d12',
          'line-opacity': 0.6,
          'line-width': 0.8,
        },
      });

      map.addLayer({
        id: LYR_REACH_POINTS,
        type: 'circle',
        source: SRC_REACH,
        paint: {
          'circle-radius': 5,
          'circle-color': '#7c2d12',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cursor in setup mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = setupMode ? 'crosshair' : '';
  }, [setupMode]);

  // Update tracks when runs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SRC_TRACKS) as maplibregl.GeoJSONSource | undefined;
      src?.setData(tracksGeoJson(runs));
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [runs]);

  // Update reach geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !home) return;
    const maxReach = reachPoints.reduce((m, p) => Math.max(m, p.distance_m), 0);
    const apply = () => {
      const segSrc = map.getSource(SRC_SEGMENTS) as maplibregl.GeoJSONSource | undefined;
      const reachSrc = map.getSource(SRC_REACH) as maplibregl.GeoJSONSource | undefined;
      segSrc?.setData(reachSegmentsGeoJson(home, reachPoints, maxReach));
      reachSrc?.setData(reachMarkersGeoJson(reachPoints, maxReach));
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [home, reachPoints]);

  // Home marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }
    if (home) {
      homeMarkerRef.current = new maplibregl.Marker({ color: '#7c2d12' })
        .setLngLat(home)
        .addTo(map);
    }
  }, [home]);

  // Fit-to-bounds when entering setup mode (no home yet)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !setupMode) return;
    const bounds = fitBoundsForRuns(runs);
    if (bounds) {
      const apply = () => map.fitBounds(bounds as LngLatBoundsLike, { padding: 60, duration: 0 });
      if (map.isStyleLoaded()) apply();
      else map.once('load', apply);
    }
  }, [setupMode, runs]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
