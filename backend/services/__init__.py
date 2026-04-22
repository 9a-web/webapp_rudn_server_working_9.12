"""
services/ — унифицированные сервисы поверх Mongo/Telegram.

Содержит:
- delivery.py    — MessageDelivery: единая точка доставки уведомлений
                   (Telegram Bot + in-app fallback), с guard'ом против pseudo_tid.
"""
