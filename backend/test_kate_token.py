"""
Тест нового токена VK (Kate Mobile)
"""
from vkpymusic import Service

# Новый токен от Kate Mobile
VK_TOKEN = "vk1.a.lyp1i1MKMUGJ2uEVAkgF9wwGOcCoTmO_Ss2pxI1O9uss8Q1yQTOxIBTclyFZ8KhfUINaAHp9ESPCPR0RYqXBToGB_BnJLnEoh-Giyc4kuvTqfm9sn-FJ6CfEafGsLIwyL-UoYy48Hjp1FnyA23ENxVvsiV2SWDU43L09CRmPJEsx7h0-s9nsquzTe2KbL35iSCNO7TrFff1yHTX52Scrog"
VK_USER_ID = 523439151

def test_kate_mobile_token():
    print("=" * 70)
    print("🎵 Тестирование VK Music API (токен Kate Mobile)")
    print("=" * 70)
    
    # Создаем сервис
    service = Service(user_agent="KateMobileAndroid/93 lite-530 (Android 11; SDK 30; arm64-v8a; Xiaomi M2101K6G; ru)", token=VK_TOKEN)
    print("✅ Сервис создан")
    
    # Тест 1: Поиск треков
    print("\n📝 Тест 1: Поиск 'Imagine Dragons'")
    try:
        tracks = service.search_songs_by_text("Imagine Dragons", count=5)
        if tracks:
            track = tracks[0]
            if "audio_api_unavailable" in (track.url or ""):
                print(f"❌ Заглушка: {track.artist} - {track.title}")
            else:
                print(f"✅ РАБОТАЕТ! Найдено {len(tracks)} треков:")
                for i, t in enumerate(tracks[:5], 1):
                    dur = f"{t.duration // 60}:{t.duration % 60:02d}"
                    print(f"   {i}. {t.artist} - {t.title} [{dur}]")
                    if t.url:
                        print(f"      🔗 URL: {t.url[:80]}...")
        else:
            print("⚠️ Треки не найдены")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 2: Популярные треки
    print("\n📝 Тест 2: Популярные треки")
    try:
        popular = service.get_popular(count=5)
        if popular:
            track = popular[0]
            if "audio_api_unavailable" in (track.url or ""):
                print(f"❌ Заглушка")
            else:
                print(f"✅ Найдено {len(popular)} популярных треков:")
                for i, t in enumerate(popular[:5], 1):
                    dur = f"{t.duration // 60}:{t.duration % 60:02d}"
                    print(f"   {i}. {t.artist} - {t.title} [{dur}]")
        else:
            print("⚠️ Не найдено")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 3: Аудио пользователя
    print(f"\n📝 Тест 3: Мои аудиозаписи (user_id={VK_USER_ID})")
    try:
        my_tracks = service.get_songs_by_userid(user_id=VK_USER_ID, count=5)
        if my_tracks:
            track = my_tracks[0]
            if "audio_api_unavailable" in (track.url or ""):
                print(f"❌ Заглушка")
            else:
                print(f"✅ Найдено {len(my_tracks)} моих треков:")
                for i, t in enumerate(my_tracks[:5], 1):
                    dur = f"{t.duration // 60}:{t.duration % 60:02d}"
                    print(f"   {i}. {t.artist} - {t.title} [{dur}]")
        else:
            print("⚠️ Нет аудиозаписей или профиль закрыт")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 4: Русская музыка
    print("\n📝 Тест 4: Поиск 'Макс Корж'")
    try:
        tracks = service.search_songs_by_text("Макс Корж", count=5)
        if tracks:
            track = tracks[0]
            if "audio_api_unavailable" in (track.url or ""):
                print(f"❌ Заглушка")
            else:
                print(f"✅ Найдено {len(tracks)} треков:")
                for i, t in enumerate(tracks[:5], 1):
                    dur = f"{t.duration // 60}:{t.duration % 60:02d}"
                    print(f"   {i}. {t.artist} - {t.title} [{dur}]")
        else:
            print("⚠️ Не найдено")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 5: Рекомендации
    print("\n📝 Тест 5: Рекомендации")
    try:
        recs = service.get_recommendations(count=5)
        if recs:
            track = recs[0]
            if "audio_api_unavailable" in (track.url or ""):
                print(f"❌ Заглушка")
            else:
                print(f"✅ Рекомендовано {len(recs)} треков:")
                for i, t in enumerate(recs[:5], 1):
                    dur = f"{t.duration // 60}:{t.duration % 60:02d}"
                    print(f"   {i}. {t.artist} - {t.title} [{dur}]")
        else:
            print("⚠️ Нет рекомендаций")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    print("\n" + "=" * 70)
    print("🏁 Тестирование завершено!")
    print("=" * 70)

if __name__ == "__main__":
    test_kate_mobile_token()
