"""
Тест vkpymusic с правильной настройкой User-Agent
Библиотека vkpymusic эмулирует официальное приложение VK Android
"""
from vkpymusic import Service
from vkpymusic.models import Song
import json

VK_TOKEN = "vk1.a.mk0aGnVEQZO6YTMVFVF_iaZlah-aNvTAdwMW79D2IVGrL8_P8zCECygB9lJklCTMZCtrXZkYw7p44qzKYS89mt2q72ruQmE15xabhNTSwGMPeNN9w0QWn4yQFyVqZKKBvD4WylzooL-d3XVlgnT80j7CxY_zxpczxg9Ysa79kKxVon4DJ74Hf0tL8vaNRWPRKDiHAlkVFtXn5Oa5F-JbRg"
VK_USER_ID = 523439151

def test_vkpymusic_detailed():
    print("=" * 70)
    print("🎵 Детальное тестирование vkpymusic")
    print("=" * 70)
    
    # Создаем сервис с разными user-agent
    user_agents = [
        "VKAndroidApp/8.49-17316",
        "KateMobileAndroid/93 lite-530 (Android 11; SDK 30; arm64-v8a; Xiaomi M2101K6G; ru)",
        "VKAndroidApp/5.52-4543 (Android 5.1.1; SDK 22; x86_64; Google Nexus 5X; ru; 1920x1080)",
    ]
    
    for ua in user_agents:
        print(f"\n🔧 User-Agent: {ua[:50]}...")
        
        try:
            service = Service(user_agent=ua, token=VK_TOKEN)
            
            # Попробуем поиск
            print("   Поиск 'Imagine Dragons'...")
            tracks = service.search_songs_by_text("Imagine Dragons", count=3)
            
            if tracks:
                track = tracks[0]
                # Проверяем, это заглушка или реальный трек
                if "audio_api_unavailable" in (track.url or ""):
                    print(f"   ❌ Заглушка: {track.artist} - {track.title}")
                else:
                    print(f"   ✅ Реальный трек: {track.artist} - {track.title}")
                    print(f"      Duration: {track.duration}s")
                    print(f"      URL: {track.url[:100] if track.url else 'N/A'}...")
            else:
                print("   ⚠️ Треки не найдены")
                
        except Exception as e:
            print(f"   ❌ Ошибка: {e}")
    
    # Проверяем версию библиотеки и доступные методы
    print("\n" + "=" * 70)
    print("📚 Информация о библиотеке vkpymusic")
    print("=" * 70)
    
    import vkpymusic
    print(f"Версия: {vkpymusic.__version__ if hasattr(vkpymusic, '__version__') else 'N/A'}")
    
    # Показываем доступные методы Service
    service = Service(user_agent="VKAndroidApp/8.49-17316", token=VK_TOKEN)
    methods = [m for m in dir(service) if not m.startswith('_') and callable(getattr(service, m))]
    print(f"Доступные методы Service: {', '.join(methods[:15])}...")
    
    print("\n" + "=" * 70)
    print("🏁 Тест завершён")
    print("=" * 70)

if __name__ == "__main__":
    test_vkpymusic_detailed()
