/**
 * Minimal view of the Home Assistant `hass` object that both shells provide:
 * the HA custom panel passes the real one; the dev harness passes a mock.
 */

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
}

export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  floor_id?: string | null;
  icon?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  area_id?: string | null;
  model?: string | null;
  manufacturer?: string | null;
}

export interface EntityRegistryEntry {
  entity_id: string;
  name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  hidden?: boolean;
  entity_category?: string | null;
}

export interface HassLike {
  states: Record<string, HassEntityState>;
  areas: Record<string, AreaRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  entities: Record<string, EntityRegistryEntry>;
  language?: string;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T = unknown>(msg: Record<string, unknown>): Promise<T>;
}

/** Persistence boundary. Panel shell → HA .storage via WebSocket; dev → localStorage. */
export interface LayoutStore {
  load(): Promise<unknown | null>;
  save(layout: unknown): Promise<void>;
}

export const friendlyName = (hass: HassLike, entityId: string): string =>
  (hass.states[entityId]?.attributes.friendly_name as string | undefined) ?? entityId;

export const domainOf = (entityId: string): string => entityId.split(".")[0];
