/**
 * Local history of used tools. Stores ONLY tool id, timestamp and tool
 * settings — never file contents or file names.
 */
import { idbClear, idbDelete, idbGet, idbSet } from './idb';
import { getSettings } from './settings';

export interface HistoryEntry {
  toolId: string;
  lastUsed: number;
  count: number;
  settings?: object;
}

const KEY = 'entries';
const MAX = 30;
type Listener = () => void;
const listeners = new Set<Listener>();

export async function getHistory(): Promise<HistoryEntry[]> {
  const list = (await idbGet<HistoryEntry[]>('history', KEY)) ?? [];
  return list.sort((a, b) => b.lastUsed - a.lastUsed);
}

export async function recordToolUse(toolId: string, settings?: object): Promise<void> {
  if (!getSettings().history) return;
  const list = await getHistory();
  const existing = list.find((e) => e.toolId === toolId);
  const entry: HistoryEntry = {
    toolId,
    lastUsed: Date.now(),
    count: (existing?.count ?? 0) + 1,
    settings: settings ?? existing?.settings,
  };
  const next = [entry, ...list.filter((e) => e.toolId !== toolId)].slice(0, MAX);
  await idbSet('history', KEY, next);
  listeners.forEach((l) => l());
}

export async function clearHistory(): Promise<void> {
  await idbClear('history');
  await idbClear('toolSettings');
  listeners.forEach((l) => l());
}

export async function loadToolSettings<T extends object>(toolId: string, defaults: T): Promise<T> {
  if (!getSettings().history) return defaults;
  const saved = await idbGet<Partial<T>>('toolSettings', toolId);
  if (!saved || typeof saved !== 'object') return defaults;
  // Only take keys that exist in defaults and have the same type.
  const out = { ...defaults };
  for (const k of Object.keys(defaults) as (keyof T)[]) {
    if (k in saved && typeof saved[k] === typeof defaults[k]) out[k] = saved[k] as T[keyof T];
  }
  return out;
}

export function saveToolSettings(toolId: string, settings: object): void {
  if (!getSettings().history) return;
  void idbSet('toolSettings', toolId, settings);
}

export async function forgetTool(toolId: string): Promise<void> {
  const list = await getHistory();
  await idbSet('history', KEY, list.filter((e) => e.toolId !== toolId));
  await idbDelete('toolSettings', toolId);
  listeners.forEach((l) => l());
}

export function onHistoryChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
