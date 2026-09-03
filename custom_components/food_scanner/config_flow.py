from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    DOMAIN,
    CONF_API_KEY,
    CONF_MODEL,
    CONF_NOTIFY,
    CONF_EXPIRY_NOTIFY,
    CONF_EXPIRY_NOTIFY_DAYS,
    CONF_EXPIRY_NOTIFY_SERVICE,
    DEFAULT_MODEL,
    DEFAULT_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY,
    DEFAULT_EXPIRY_NOTIFY_DAYS,
    DEFAULT_EXPIRY_NOTIFY_SERVICE,
)


MODEL_SELECTOR = selector.TextSelector(
    selector.TextSelectorConfig(
        type=selector.TextSelectorType.TEXT,
        autocomplete="off",
    )
)


class FoodScannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            user_input[CONF_MODEL] = str(user_input.get(CONF_MODEL) or DEFAULT_MODEL).strip()
            return self.async_create_entry(title="HomeStock", data=user_input)
        schema = vol.Schema({
            vol.Required(CONF_API_KEY): str,
            vol.Optional(CONF_MODEL, default=DEFAULT_MODEL): MODEL_SELECTOR,
        })
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FoodScannerOptionsFlow()


class FoodScannerOptionsFlow(config_entries.OptionsFlowWithReload):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            user_input[CONF_MODEL] = str(user_input.get(CONF_MODEL) or DEFAULT_MODEL).strip()
            return self.async_create_entry(title="", data=user_input)
        current_model = self.config_entry.options.get(CONF_MODEL, self.config_entry.data.get(CONF_MODEL, DEFAULT_MODEL))
        current_notify = self.config_entry.options.get(CONF_NOTIFY, DEFAULT_NOTIFY)
        current_expiry_notify = self.config_entry.options.get(CONF_EXPIRY_NOTIFY, DEFAULT_EXPIRY_NOTIFY)
        current_expiry_days = self.config_entry.options.get(CONF_EXPIRY_NOTIFY_DAYS, DEFAULT_EXPIRY_NOTIFY_DAYS)
        current_notify_service = self.config_entry.options.get(CONF_EXPIRY_NOTIFY_SERVICE, DEFAULT_EXPIRY_NOTIFY_SERVICE)
        schema = vol.Schema({
            vol.Optional(CONF_MODEL, default=current_model): MODEL_SELECTOR,
            vol.Optional(CONF_NOTIFY, default=current_notify): bool,
            vol.Optional(CONF_EXPIRY_NOTIFY, default=current_expiry_notify): bool,
            vol.Optional(CONF_EXPIRY_NOTIFY_DAYS, default=current_expiry_days): vol.All(vol.Coerce(int), vol.Range(min=0, max=365)),
            vol.Optional(CONF_EXPIRY_NOTIFY_SERVICE, default=current_notify_service): str,
        })
        return self.async_show_form(step_id="init", data_schema=schema)
