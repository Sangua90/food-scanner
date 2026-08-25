from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    DOMAIN,
    CONF_API_KEY,
    CONF_MODEL,
    CONF_NOTIFY,
    DEFAULT_MODEL,
    DEFAULT_NOTIFY,
)


class FoodScannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="Food Scanner", data=user_input)

        schema = vol.Schema(
            {
                vol.Required(CONF_API_KEY): str,
                vol.Optional(CONF_MODEL, default=DEFAULT_MODEL): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FoodScannerOptionsFlow(config_entry)


class FoodScannerOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current_model = self.config_entry.options.get(
            CONF_MODEL,
            self.config_entry.data.get(CONF_MODEL, DEFAULT_MODEL),
        )
        current_notify = self.config_entry.options.get(CONF_NOTIFY, DEFAULT_NOTIFY)

        schema = vol.Schema(
            {
                vol.Optional(CONF_MODEL, default=current_model): str,
                vol.Optional(CONF_NOTIFY, default=current_notify): bool,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
