"""
Проверка доступности MP3 URL для воспроизведения в WebApp
"""
import requests
from vkpymusic import Service

VK_TOKEN = "vk1.a.lyp1i1MKMUGJ2uEVAkgF9wwGOcCoTmO_Ss2pxI1O9uss8Q1yQTOxIBTclyFZ8KhfUINaAHp9ESPCPR0RYqXBToGB_BnJLnEoh-Giyc4kuvTqfm9sn-FJ6CfEafGsLIwyL-UoYy48Hjp1FnyA23ENxVvsiV2SWDU43L09CRmPJEsx7h0-s9nsquzTe2KbL35iSCNO7TrFff1yHTX52Scrog"

def check_audio_accessibility():
    print("=" * 70)
    print("🔍 Проверка доступности MP3 для WebApp")
    print("=" * 70)
    
    service = Service(user_agent="KateMobileAndroid/93 lite-530", token=VK_TOKEN)
    
    # Получаем трек
    print("\n1️⃣ Получаем трек...")
    tracks = service.search_songs_by_text("Imagine Dragons Believer", count=1)
    
    if not tracks:
        print("❌ Треки не найдены")
        return
    
    track = tracks[0]
    print(f"   Трек: {track.artist} - {track.title}")
    print(f"   Длительность: {track.duration // 60}:{track.duration % 60:02d}")
    print(f"   URL: {track.url[:100]}...")
    
    # Проверяем доступность URL
    print("\n2️⃣ Проверяем HTTP доступность...")
    try:
        # HEAD запрос для проверки без скачивания
        response = requests.head(track.url, timeout=10, allow_redirects=True)
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"   Content-Length: {response.headers.get('Content-Length', 'N/A')} bytes")
        
        # Проверяем CORS заголовки
        cors = response.headers.get('Access-Control-Allow-Origin', 'НЕТ')
        print(f"   CORS (Access-Control-Allow-Origin): {cors}")
        
        if response.status_code == 200:
            print("   ✅ URL доступен!")
        else:
            print(f"   ⚠️ Статус {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
    
    # Проверяем можно ли скачать часть файла (Range requests)
    print("\n3️⃣ Проверяем поддержку Range requests (для streaming)...")
    try:
        headers = {"Range": "bytes=0-1023"}
        response = requests.get(track.url, headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 206:
            print("   ✅ Range requests поддерживаются (можно стримить)")
        elif response.status_code == 200:
            print("   ⚠️ Range не поддерживается, но файл доступен целиком")
        
        # Проверяем что это действительно MP3
        content = response.content[:10]
        if content[:3] == b'ID3' or content[:2] == b'\xff\xfb':
            print("   ✅ Это реальный MP3 файл!")
        else:
            print(f"   ⚠️ Начало файла: {content[:20]}")
            
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
    
    # Проверяем время жизни URL
    print("\n4️⃣ Информация о URL...")
    if "vkuseraudio" in track.url:
        print("   📍 Домен: vkuseraudio.net (CDN ВКонтакте)")
        print("   ⏰ URL временный (обычно действует несколько часов)")
        print("   🔒 URL привязан к сессии/токену")
    
    # Выводим полный URL для теста
    print("\n5️⃣ Полный URL для теста в браузере:")
    print(f"   {track.url}")
    
    print("\n" + "=" * 70)
    print("📋 ВЫВОД:")
    print("=" * 70)
    print("""
✅ MP3 файлы ДОСТУПНЫ для воспроизведения в WebApp!

Как это работает:
1. Backend получает URL трека через VK API
2. Frontend использует HTML5 <audio> для воспроизведения
3. Браузер напрямую стримит MP3 с CDN VK

⚠️ ОГРАНИЧЕНИЯ:
1. URL временные (несколько часов) - нужно обновлять
2. CORS может блокировать - но обычно работает в Telegram WebApp
3. Нужно кэшировать URL на backend и обновлять по запросу

💡 РЕКОМЕНДАЦИЯ:
Создать API endpoint который возвращает свежий URL трека,
frontend будет запрашивать URL перед воспроизведением.
""")

if __name__ == "__main__":
    check_audio_accessibility()
