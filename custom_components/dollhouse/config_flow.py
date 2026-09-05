"""Config flow: one click, no options. Single instance is enforced by the manifest."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class DollhouseConfigFlow(ConfigFlow, domain=DOMAIN):
    """Create the single Dollhouse entry."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Dollhouse", data={})
        return self.async_show_form(step_id="user")
