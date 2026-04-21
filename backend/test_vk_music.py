"""
Тестовый скрипт для проверки работы VK Music API через vkpymusic
"""
import asyncio
from vkpymusic import Service

# Токен из URL пользователя
VK_TOKEN = "vk1.a.mk0aGnVEQZO6YTMVFVF_iaZlah-aNvTAdwMW79D2IVGrL8_P8zCECygB9lJklCTMZCtrXZkYw7p44qzKYS89mt2q72ruQmE15xabhNTSwGMPeNN9w0QWn4yQFyVqZKKBvD4WylzooL-d3XVlgnT80j7CxY_zxpczxg9Ysa79kKxVon4DJ74Hf0tL8vaNRWPRKDiHAlkVFtXn5Oa5F-JbRg"
VK_USER_ID = 523439151

def test_sync():
    """Синхронный тест API"""
    print("=" * 60)
    print("🎵 Тестирование VK Music API через vkpymusic")
    print("=" * 60)
    
    # Создаем сервис с токеном
    try:
        service = Service(user_agent="VKAndroidApp/8.49-17316", token=VK_TOKEN)
        print("✅ Сервис создан успешно")
    except Exception as e:
        print(f"❌ Ошибка создания сервиса: {e}")
        return
    
    # Тест 1: Поиск треков
    print("\n📝 Тест 1: Поиск треков по запросу 'Imagine Dragons'")
    try:
        tracks = service.search_songs_by_text("Imagine Dragons", count=5)
        if tracks:
            print(f"✅ Найдено {len(tracks)} треков:")
            for i, track in enumerate(tracks[:5], 1):
                duration_min = track.duration // 60
                duration_sec = track.duration % 60
                print(f"   {i}. {track.artist} - {track.title} [{duration_min}:{duration_sec:02d}]")
                print(f"      URL: {track.url[:80]}..." if track.url else "      URL: недоступен")
        else:
            print("⚠️ Треки не найдены")
    except Exception as e:
        print(f"❌ Ошибка поиска: {e}")
    
    # Тест 2: Получение популярных треков
    print("\n📝 Тест 2: Получение популярных треков")
    try:
        popular = service.get_popular(count=5)
        if popular:
            print(f"✅ Найдено {len(popular)} популярных треков:")
            for i, track in enumerate(popular[:5], 1):
                duration_min = track.duration // 60
                duration_sec = track.duration % 60
                print(f"   {i}. {track.artist} - {track.title} [{duration_min}:{duration_sec:02d}]")
        else:
            print("⚠️ Популярные треки не найдены")
    except Exception as e:
        print(f"❌ Ошибка получения популярных: {e}")
    
    # Тест 3: Получение треков пользователя
    print(f"\n📝 Тест 3: Получение аудио пользователя (user_id={VK_USER_ID})")
    try:
        user_tracks = service.get_songs_by_userid(user_id=VK_USER_ID, count=5)
        if user_tracks:
            print(f"✅ Найдено {len(user_tracks)} треков у пользователя:")
            for i, track in enumerate(user_tracks[:5], 1):
                duration_min = track.duration // 60
                duration_sec = track.duration % 60
                print(f"   {i}. {track.artist} - {track.title} [{duration_min}:{duration_sec:02d}]")
        else:
            print("⚠️ Треки пользователя не найдены или профиль закрыт")
    except Exception as e:
        print(f"❌ Ошибка получения треков пользователя: {e}")
    
    # Тест 4: Поиск по артисту
    print("\n📝 Тест 4: Поиск треков артиста 'Макс Корж'")
    try:
        artist_tracks = service.search_songs_by_text("Макс Корж", count=5)
        if artist_tracks:
            print(f"✅ Найдено {len(artist_tracks)} треков:")
            for i, track in enumerate(artist_tracks[:5], 1):
                duration_min = track.duration // 60
                duration_sec = track.duration % 60
                print(f"   {i}. {track.artist} - {track.title} [{duration_min}:{duration_sec:02d}]")
        else:
            print("⚠️ Треки не найдены")
    except Exception as e:
        print(f"❌ Ошибка поиска: {e}")
    
    print("\n" + "=" * 60)
    print("🏁 Тестирование завершено!")
    print("=" * 60)

if __name__ == "__main__":
    test_sync()
