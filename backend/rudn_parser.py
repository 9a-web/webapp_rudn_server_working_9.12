"""
Модуль для парсинга расписания РУДН
Адаптировано из рабочего Telegram бота
"""

import requests
from bs4 import BeautifulSoup
import logging
from typing import Dict, List, Optional
import asyncio
import aiohttp

# Настройка логирования
logger = logging.getLogger(__name__)

# Константы API РУДН
BASE_URL = "https://www.rudn.ru/api/v1/education/schedule"
SCHEDULE_URL = "https://www.rudn.ru/education/schedule"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://www.rudn.ru",
    "Referer": SCHEDULE_URL,
}
TIMEOUT = 30


async def get_facultets() -> List[Dict]:
    """Получает список факультетов"""
    try:
        timeout = aiohttp.ClientTimeout(total=TIMEOUT)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(SCHEDULE_URL, headers=HEADERS) as response:
                if response.status != 200:
                    logger.error(f"Ошибка HTTP {response.status} при получении факультетов")
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, "html.parser")
                faculties = []
                
                for opt in soup.select("select[name=facultet] option"):
                    if opt.get("value") and opt["value"]:
                        faculties.append({
                            "id": opt["value"],
                            "name": opt.text.strip()
                        })
                
                logger.info(f"Получено {len(faculties)} факультетов")
                return faculties
    except aiohttp.ClientError as e:
        logger.error(f"Ошибка подключения при получении факультетов: {e}")
        return []
    except Exception as e:
        logger.error(f"Неожиданная ошибка при получении факультетов: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


async def get_filter_data(
    facultet_id: str,
    level_id: str = "",
    kurs: str = "",
    form_code: str = ""
) -> Dict:
    """
    Универсальная функция для получения данных фильтра
    Возвращает уровни, курсы, формы обучения, группы
    """
    try:
        payload = {
            "facultet": facultet_id,
            "level": level_id,
            "kurs": kurs,
            "form": form_code,
            "action": "filterData"
        }
        
        # Удаляем пустые значения
        payload = {k: v for k, v in payload.items() if v != ""}
        
        timeout = aiohttp.ClientTimeout(total=TIMEOUT)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                BASE_URL,
                data=payload,
                headers=HEADERS
            ) as response:
                if response.status != 200:
                    logger.error(f"Ошибка HTTP {response.status} при получении фильтров")
                    return {}
                
                data = await response.json()
                elements = data.get("data", {}).get("elements", {})
                
                logger.debug(f"Получены фильтры для facultet={facultet_id}, level={level_id}, kurs={kurs}, form={form_code}")
                return elements
    except aiohttp.ClientError as e:
        logger.error(f"Ошибка подключения при получении данных фильтра: {e}")
        return {}
    except Exception as e:
        logger.error(f"Неожиданная ошибка при получении данных фильтра: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {}


def extract_options(element_data: Dict, element_name: str) -> List[Dict]:
    """Извлекает опции из элемента данных"""
    if element_name not in element_data:
        return []
    
    element = element_data[element_name]
    options = []
    
    for item in element.get("list", []):
        options.append({
            "value": item.get("value"),
            "label": item.get("label"),
            "name": item.get("name"),
            "disabled": item.get("disabled", False)
        })
    
    return options


async def get_schedule(
    facultet_id: str,
    level_id: str,
    kurs: str,
    form_code: str,
    group_id: str,
    week_number: int = 1
) -> List[Dict]:
    """Получает расписание для конкретной группы (с retry)"""
    max_retries = 2
    
    for attempt in range(max_retries + 1):
        try:
            params = {
                "facultet": facultet_id,
                "level": level_id,
                "kurs": kurs,
                "form": form_code,
                "group": group_id
            }
            
            logger.info(f"Запрос расписания для группы {group_id}, неделя {week_number} (попытка {attempt + 1})")
            
            timeout = aiohttp.ClientTimeout(total=TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    BASE_URL,
                    params=params,
                    headers=HEADERS
                ) as response:
                    if response.status != 200:
                        logger.error(f"Ошибка HTTP {response.status} при получении расписания")
                        if attempt < max_retries:
                            await asyncio.sleep(1)
                            continue
                        return []
                    
                    html = await response.text()
                    
                    if not html.strip():
                        logger.warning("Получен пустой ответ от сервера")
                        return []
                    
                    # Выполняем CPU-емкий парсинг в отдельном потоке, чтобы не блокировать event loop
                    loop = asyncio.get_running_loop()
                    return await loop.run_in_executor(None, parse_html_schedule, html, week_number)
                    
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            logger.error(f"Ошибка подключения при получении расписания (попытка {attempt + 1}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(1)
                continue
            return []
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении расписания: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    return []


def parse_html_schedule(html_content: str, week_number: int = 1) -> List[Dict]:
    """
    Парсит HTML расписание
    week_number: 1 - текущая неделя, 2 - следующая неделя
    """
    try:
        logger.debug(f"Начало парсинга HTML расписания, неделя {week_number}")
        soup = BeautifulSoup(html_content, 'html.parser')
        events = []
        
        # Ищем все таблицы с расписанием
        schedule_tables = soup.find_all('table', class_='edss__table')
        logger.debug(f"Найдено таблиц: {len(schedule_tables)}")
        
        if not schedule_tables:
            logger.warning("Не найдено таблиц расписания")
            return []
        
        if week_number > len(schedule_tables):
            logger.warning(f"Запрошена неделя {week_number}, но найдено только {len(schedule_tables)} таблиц")
            week_number = len(schedule_tables)
        
        table = schedule_tables[week_number - 1]
        rows = table.find_all('tr')
        logger.debug(f"Найдено строк в таблице недели {week_number}: {len(rows)}")
        
        current_day = ""
        rowspan_data = {}
        
        for row_idx, row in enumerate(rows):
            # Проверяем, является ли строка заголовком дня
            day_header = row.find('th')
            if day_header and ('colspan' in day_header.attrs or
                               (day_header.get('class') and any(
                                   'day' in cls.lower() for cls in day_header.get('class', [])))):
                current_day = day_header.get_text(strip=True)
                logger.debug(f"Обнаружен день: {current_day}")
                rowspan_data = {}
                continue
            
            # Парсим данные занятия
            cells = row.find_all('td')
            
            # Собираем все ячейки с учетом rowspan
            current_cells = []
            cell_idx = 0
            
            while cell_idx < 5:  # Ожидаем 5 ячеек
                if cell_idx in rowspan_data and rowspan_data[cell_idx]:
                    current_cells.append(rowspan_data[cell_idx]['cell'])
                    rowspan_data[cell_idx]['count'] -= 1
                    if rowspan_data[cell_idx]['count'] <= 0:
                        del rowspan_data[cell_idx]
                    cell_idx += 1
                elif cells:
                    cell = cells.pop(0)
                    current_cells.append(cell)
                    
                    if cell.has_attr('rowspan'):
                        try:
                            rowspan_count = int(cell['rowspan'])
                            if rowspan_count > 1:
                                rowspan_data[cell_idx] = {
                                    'cell': cell,
                                    'count': rowspan_count - 1
                                }
                        except ValueError:
                            pass
                    cell_idx += 1
                else:
                    current_cells.append(None)
                    cell_idx += 1
            
            if len(current_cells) < 5:
                continue
            
            time_cell, subject_cell, type_cell, teacher_cell, place_cell = current_cells
            
            if not time_cell:
                continue
            
            time_text = time_cell.get_text(strip=True)
            
            if not time_text:
                continue
            
            subject = subject_cell.get_text(strip=True) if subject_cell else ""
            lesson_type = type_cell.get_text(strip=True) if type_cell else ""
            teacher = teacher_cell.get_text(strip=True) if teacher_cell else ""
            auditory = place_cell.get_text(strip=True) if place_cell else ""
            
            if subject and subject != "?":
                event_data = {
                    "day": current_day,
                    "time": time_text,
                    "discipline": subject,
                    "lessonType": lesson_type,
                    "teacher": teacher,
                    "auditory": auditory,
                    "week": week_number
                }
                events.append(event_data)
        
        logger.info(f"Парсинг завершен. Найдено событий: {len(events)}")
        return events
    
    except Exception as e:
        logger.error(f"Ошибка при парсинге расписания: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


# Функции для синхронного использования (если нужно)
def get_facultets_sync() -> List[Dict]:
    """Синхронная версия получения факультетов"""
    try:
        response = requests.get(SCHEDULE_URL, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        faculties = []
        
        for opt in soup.select("select[name=facultet] option"):
            if opt.get("value") and opt["value"]:
                faculties.append({
                    "id": opt["value"],
                    "name": opt.text.strip()
                })
        
        return faculties
    except Exception as e:
        logger.error(f"Ошибка при получении факультетов: {e}")
        return []
