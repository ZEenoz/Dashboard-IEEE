from linebot.v3 import WebhookHandler
from linebot.v3.messaging import Configuration
from config import CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET

configuration = Configuration(access_token=CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(CHANNEL_SECRET)
