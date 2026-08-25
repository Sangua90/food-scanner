DOMAIN = "food_scanner"

CONF_API_KEY = "api_key"
CONF_MODEL = "model"
CONF_NOTIFY = "notify"
CONF_EXPIRY_NOTIFY = "expiry_notify"
CONF_EXPIRY_NOTIFY_DAYS = "expiry_notify_days"
CONF_EXPIRY_NOTIFY_SERVICE = "expiry_notify_service"

DEFAULT_MODEL = "gemini-3.5-flash-lite"
DEFAULT_NOTIFY = True
DEFAULT_EXPIRY_NOTIFY = True
DEFAULT_EXPIRY_NOTIFY_DAYS = 3
DEFAULT_EXPIRY_NOTIFY_SERVICE = ""

SERVICE_SCAN_IMAGE = "scan_image"
SERVICE_CONSUME_PRODUCT = "consume_product"
SERVICE_SET_STOCK = "set_stock"
SERVICE_REMOVE_PRODUCT = "remove_product"
SERVICE_CLEAR_ARCHIVE = "clear_archive"
