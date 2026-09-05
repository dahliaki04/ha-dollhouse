"""Dollhouse: draw your home in minutes, drag entities onto a 2D/3D floor plan.

The integration is deliberately thin. It serves the bundled frontend, registers a
sidebar panel, and persists the layout JSON in .storage over two WebSocket
commands. All drawing and rendering happens in the browser.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, PANEL_URL_PATH, STATIC_URL, STORAGE_KEY, STORAGE_VERSION, VERSION

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
FRONTEND_FILE = "ha-dollhouse.js"


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """YAML is not used; everything is set up from the config entry."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Serve the frontend, register the panel and the storage WebSocket API."""
    store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    hass.data.setdefault(DOMAIN, {})["store"] = store

    if not hass.data[DOMAIN].get("static_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        hass.data[DOMAIN]["static_registered"] = True

    if not hass.data[DOMAIN].get("ws_registered"):
        websocket_api.async_register_command(hass, ws_layout_get)
        websocket_api.async_register_command(hass, ws_layout_save)
        hass.data[DOMAIN]["ws_registered"] = True

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Dollhouse",
        sidebar_icon="mdi:home-floor-1",
        frontend_url_path=PANEL_URL_PATH,
        require_admin=False,
        config={
            "_panel_custom": {
                "name": "dollhouse-panel",
                "module_url": f"{STATIC_URL}/{FRONTEND_FILE}?v={VERSION}",
                "embed_iframe": False,
                "trust_external": False,
            }
        },
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove the sidebar panel. Static path and WS commands stay registered (HA has no unregister)."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    return True


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/layout/get"})
@websocket_api.async_response
async def ws_layout_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the saved layout (or null)."""
    store: Store[dict[str, Any]] = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    connection.send_result(msg["id"], {"layout": (data or {}).get("layout")})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/layout/save",
        vol.Required("layout"): dict,
    }
)
@websocket_api.async_response
async def ws_layout_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Persist the layout. Only admins may write."""
    if not connection.user.is_admin:
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "admin required")
        return
    layout = msg["layout"]
    if layout.get("version") != 1 or not isinstance(layout.get("rooms"), list):
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, "not a Dollhouse layout")
        return
    store: Store[dict[str, Any]] = hass.data[DOMAIN]["store"]
    await store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})
