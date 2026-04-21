"""
Модуль для получения данных о погоде через wttr.in API
"""

import aiohttp
import logging
from typing import Optional
from models import WeatherResponse

logger = logging.getLogger(__name__)

WEATHER_API_URL = "http://wttr.in/Moscow?format=j1"

# Маппинг кодов погоды wttr.in на иконки
WEATHER_ICON_MAP = {
    "113": "☀️",  # Clear/Sunny
    "116": "⛅",  # Partly cloudy
    "119": "☁️",  # Cloudy
    "122": "☁️",  # Overcast
    "143": "🌫️",  # Mist
    "176": "🌦️",  # Patchy rain possible
    "179": "🌨️",  # Patchy snow possible
    "182": "🌧️",  # Patchy sleet possible
    "185": "🌧️",  # Patchy freezing drizzle possible
    "200": "⛈️",  # Thundery outbreaks possible
    "227": "🌨️",  # Blowing snow
    "230": "❄️",  # Blizzard
    "248": "🌫️",  # Fog
    "260": "🌫️",  # Freezing fog
    "263": "🌦️",  # Patchy light drizzle
    "266": "🌧️",  # Light drizzle
    "281": "🌧️",  # Freezing drizzle
    "284": "🌧️",  # Heavy freezing drizzle
    "293": "🌦️",  # Patchy light rain
    "296": "🌧️",  # Light rain
    "299": "🌧️",  # Moderate rain at times
    "302": "🌧️",  # Moderate rain
    "305": "🌧️",  # Heavy rain at times
    "308": "🌧️",  # Heavy rain
    "311": "🌧️",  # Light freezing rain
    "314": "🌧️",  # Moderate or heavy freezing rain
    "317": "🌨️",  # Light sleet
    "320": "🌨️",  # Moderate or heavy sleet
    "323": "🌨️",  # Patchy light snow
    "326": "❄️",  # Light snow
    "329": "❄️",  # Patchy moderate snow
    "332": "❄️",  # Moderate snow
    "335": "❄️",  # Patchy heavy snow
    "338": "❄️",  # Heavy snow
    "350": "🌧️",  # Ice pellets
    "353": "🌦️",  # Light rain shower
    "356": "🌧️",  # Moderate or heavy rain shower
    "359": "🌧️",  # Torrential rain shower
    "362": "🌨️",  # Light sleet showers
    "365": "🌨️",  # Moderate or heavy sleet showers
    "368": "🌨️",  # Light snow showers
    "371": "❄️",  # Moderate or heavy snow showers
    "374": "🌧️",  # Light showers of ice pellets
    "377": "🌧️",  # Moderate or heavy showers of ice pellets
    "386": "⛈️",  # Patchy light rain with thunder
    "389": "⛈️",  # Moderate or heavy rain with thunder
    "392": "⛈️",  # Patchy light snow with thunder
    "395": "⛈️",  # Moderate or heavy snow with thunder
}


def get_weather_icon(weather_code: str) -> str:
    """Получить иконку погоды по коду"""
    return WEATHER_ICON_MAP.get(weather_code, "🌡️")


async def get_moscow_weather() -> Optional[WeatherResponse]:
    """
    Получить текущую погоду в Москве через wttr.in API
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(WEATHER_API_URL, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    logger.error(f"Weather API returned status {response.status}")
                    return None
                
                data = await response.json()
                
                # Извлекаем данные из ответа
                current = data.get("current_condition", [{}])[0]
                
                temperature = int(current.get("temp_C", 0))
                feels_like = int(current.get("FeelsLikeC", 0))
                humidity = int(current.get("humidity", 0))
                wind_speed = int(current.get("windspeedKmph", 0))
                weather_code = current.get("weatherCode", "113")
                
                # Получаем описание погоды (на русском из lang_ru если есть)
                weather_desc = current.get("lang_ru", [{}])
                if weather_desc and len(weather_desc) > 0:
                    description = weather_desc[0].get("value", "Ясно")
                else:
                    description = current.get("weatherDesc", [{}])[0].get("value", "Clear")
                
                # Получаем иконку
                icon = get_weather_icon(weather_code)
                
                return WeatherResponse(
                    temperature=temperature,
                    feels_like=feels_like,
                    humidity=humidity,
                    wind_speed=wind_speed,
                    description=description,
                    icon=icon
                )
    
    except aiohttp.ClientError as e:
        logger.error(f"Network error fetching weather: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error fetching weather: {e}", exc_info=True)
        return None
