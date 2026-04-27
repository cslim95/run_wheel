import { STORAGE_KEY_HOME } from './constants';
import type { LngLat } from '../types';

export function getHome(): LngLat | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [lng, lat] = parsed;
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    return [lng, lat];
  } catch {
    return null;
  }
}

export function setHome(home: LngLat): void {
  localStorage.setItem(STORAGE_KEY_HOME, JSON.stringify(home));
}

export function clearHome(): void {
  localStorage.removeItem(STORAGE_KEY_HOME);
}
