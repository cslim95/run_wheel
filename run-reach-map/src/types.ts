export interface RawRun {
  id: number;
  name: string;
  type?: string;
  start_date?: string;
  distance_m?: number;
  moving_time_s?: number;
  start_latlng?: [number, number];
  coords: [number, number][]; // [lat, lng] as written by the Python exporter
}

export interface RunsFile {
  generated_at: string;
  athlete_id: number | null;
  runs: RawRun[];
}

// Internal Run uses [lng, lat] throughout — converted at the JSON load boundary.
export interface Run {
  id: number;
  name: string;
  type?: string;
  start_date?: string;
  distance_m?: number;
  moving_time_s?: number;
  coords: [number, number][]; // [lng, lat]
}

export interface ReachPoint {
  bearing_centre: number; // degrees, segment midpoint (e.g. 10, 30, 50, ...)
  bearing_index: number;  // 0..SEGMENT_COUNT-1
  distance_m: number;
  coord: [number, number]; // [lng, lat]
  run_id: number;
  run_name: string;
  run_date?: string;
}

export interface ReachResult {
  qualifyingRuns: Run[];
  reachPoints: ReachPoint[];
  totalRuns: number;
}

export type LngLat = [number, number];
