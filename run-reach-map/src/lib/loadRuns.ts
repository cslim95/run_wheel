import type { RawRun, Run, RunsFile } from '../types';

function toInternal(raw: RawRun): Run {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    start_date: raw.start_date,
    distance_m: raw.distance_m,
    moving_time_s: raw.moving_time_s,
    coords: raw.coords.map(([lat, lng]) => [lng, lat] as [number, number]),
  };
}

export async function loadRuns(url = '/runs.json'): Promise<{ runs: Run[]; generatedAt: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  const data = (await resp.json()) as RunsFile;
  return {
    runs: data.runs.map(toInternal),
    generatedAt: data.generated_at,
  };
}
