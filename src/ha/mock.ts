import type { HassEntityState, HassLike, LayoutStore } from "./types";

/**
 * A fake home shaped like Brian's: Hue lights, Daikin climate units, Zigbee presence.
 * Service calls mutate state so the dev harness feels live.
 */
export function createMockHass(onChange: () => void): HassLike {
  const areas = {
    living: { area_id: "living", name: "客廳" },
    dining: { area_id: "dining", name: "餐廳" },
    master: { area_id: "master", name: "主臥" },
    kid: { area_id: "kid", name: "果的房間" },
    kitchen: { area_id: "kitchen", name: "廚房" },
    entrance: { area_id: "entrance", name: "玄關" },
  };

  const devices = {
    d_hue_go: { id: "d_hue_go", name: "Hue Go", area_id: "living", manufacturer: "Signify", model: "Hue Go" },
    d_dk1: { id: "d_dk1", name: "Daikin 客廳", area_id: "living", manufacturer: "Daikin", model: "BRC1H" },
    d_dk2: { id: "d_dk2", name: "Daikin 主臥", area_id: "master", manufacturer: "Daikin", model: "BRC1H" },
    d_mtg1: { id: "d_mtg1", name: "MTG235 客廳", area_id: "living", manufacturer: "Tuya", model: "MTG235-ZB-RL" },
    d_mtg2: { id: "d_mtg2", name: "MTG235 主臥", area_id: "master", manufacturer: "Tuya", model: "MTG235-ZB-RL" },
    d_co2: { id: "d_co2", name: "SwitchBot Meter Pro CO2", area_id: "master", manufacturer: "SwitchBot", model: "Meter Pro CO2" },
  };

  const reg = (entity_id: string, area_id: string | null, device_id: string | null = null) => ({ entity_id, area_id, device_id });
  const entities = Object.fromEntries(
    [
      reg("light.living_downlight_1", "living"),
      reg("light.living_downlight_2", "living"),
      reg("light.hue_go_1", null, "d_hue_go"),
      reg("light.living_strip", "living"),
      reg("light.dining_pendant", "dining"),
      reg("light.master_ceiling", "master"),
      reg("light.master_wall_lamp", "master"),
      reg("light.kid_ceiling", "kid"),
      reg("light.kitchen_downlight", "kitchen"),
      reg("light.entrance_lights", "entrance"),
      reg("climate.daikin_living", null, "d_dk1"),
      reg("climate.daikin_master", null, "d_dk2"),
      reg("binary_sensor.presence_living", null, "d_mtg1"),
      reg("binary_sensor.presence_master", null, "d_mtg2"),
      reg("sensor.co2_master", null, "d_co2"),
      reg("sensor.temp_master", null, "d_co2"),
      reg("switch.drying_rack", "dining"),
      reg("cover.living_curtain", "living"),
    ].map((e) => [e.entity_id, e]),
  );

  const st = (entity_id: string, state: string, attributes: Record<string, unknown>): HassEntityState => ({ entity_id, state, attributes });
  const states: Record<string, HassEntityState> = Object.fromEntries(
    [
      st("light.living_downlight_1", "on", { friendly_name: "客廳崁燈 1", brightness: 200, color_mode: "color_temp", supported_color_modes: ["color_temp"] }),
      st("light.living_downlight_2", "off", { friendly_name: "客廳崁燈 2", supported_color_modes: ["color_temp"] }),
      st("light.hue_go_1", "on", { friendly_name: "Hue Go", brightness: 120, rgb_color: [255, 120, 60], supported_color_modes: ["hs"] }),
      st("light.living_strip", "on", { friendly_name: "客廳燈條", brightness: 90, rgb_color: [80, 160, 255], supported_color_modes: ["rgb"] }),
      st("light.dining_pendant", "off", { friendly_name: "餐廳吊燈" }),
      st("light.master_ceiling", "off", { friendly_name: "主臥吸頂燈" }),
      st("light.master_wall_lamp", "on", { friendly_name: "主臥壁燈", brightness: 60 }),
      st("light.kid_ceiling", "on", { friendly_name: "果的房間燈", brightness: 255 }),
      st("light.kitchen_downlight", "off", { friendly_name: "廚房崁燈" }),
      st("light.entrance_lights", "off", { friendly_name: "玄關燈" }),
      st("climate.daikin_living", "cool", { friendly_name: "客廳冷氣", current_temperature: 27.5, temperature: 25, fan_mode: "auto", hvac_modes: ["off", "cool", "heat", "dry", "fan_only"], fan_modes: ["auto", "low", "medium", "high"] }),
      st("climate.daikin_master", "off", { friendly_name: "主臥冷氣", current_temperature: 26.1, temperature: 24, fan_mode: "low", hvac_modes: ["off", "cool", "heat"], fan_modes: ["auto", "low", "medium", "high"] }),
      st("binary_sensor.presence_living", "on", { friendly_name: "客廳有人", device_class: "occupancy" }),
      st("binary_sensor.presence_master", "off", { friendly_name: "主臥有人", device_class: "occupancy" }),
      st("sensor.co2_master", "812", { friendly_name: "主臥 CO2", unit_of_measurement: "ppm", device_class: "carbon_dioxide" }),
      st("sensor.temp_master", "26.4", { friendly_name: "主臥溫度", unit_of_measurement: "°C", device_class: "temperature" }),
      st("switch.drying_rack", "off", { friendly_name: "曬衣架" }),
      st("cover.living_curtain", "open", { friendly_name: "客廳窗簾", current_position: 100 }),
    ].map((s) => [s.entity_id, s]),
  );

  const hass: HassLike = {
    states,
    areas,
    devices,
    entities,
    language: "zh-Hant",
    async callService(domain, service, data) {
      const ids = ([] as string[]).concat((data?.entity_id as string | string[]) ?? []);
      for (const id of ids) {
        const s = states[id];
        if (!s) continue;
        const next = { ...s, attributes: { ...s.attributes } };
        if (service === "toggle") next.state = s.state === "on" || s.state === "open" ? (domain === "cover" ? "closed" : "off") : domain === "cover" ? "open" : "on";
        else if (service === "turn_on") next.state = "on";
        else if (service === "turn_off") next.state = "off";
        else if (service === "set_temperature" && typeof data?.temperature === "number") next.attributes.temperature = data.temperature;
        else if (service === "set_hvac_mode" && typeof data?.hvac_mode === "string") next.state = data.hvac_mode;
        else if (service === "set_fan_mode" && typeof data?.fan_mode === "string") next.attributes.fan_mode = data.fan_mode;
        states[id] = next;
      }
      // Replace the states object so React sees a new reference.
      hass.states = { ...states };
      onChange();
    },
    async callWS<T = unknown>() {
      return null as T;
    },
  };
  return hass;
}

export function createLocalStore(key = "dollhouse:layout:v1"): LayoutStore {
  return {
    async load() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    async save(layout) {
      try {
        localStorage.setItem(key, JSON.stringify(layout));
      } catch {
        /* quota or private mode: ignore */
      }
    },
  };
}
