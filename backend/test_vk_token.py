"""
Проверка прав токена VK
"""
import requests

VK_TOKEN = "vk1.a.mk0aGnVEQZO6YTMVFVF_iaZlah-aNvTAdwMW79D2IVGrL8_P8zCECygB9lJklCTMZCtrXZkYw7p44qzKYS89mt2q72ruQmE15xabhNTSwGMPeNN9w0QWn4yQFyVqZKKBvD4WylzooL-d3XVlgnT80j7CxY_zxpczxg9Ysa79kKxVon4DJ74Hf0tL8vaNRWPRKDiHAlkVFtXn5Oa5F-JbRg"

def check_token():
    print("=" * 60)
    print("🔑 Проверка VK Token")
    print("=" * 60)
    
    # 1. Проверяем базовую информацию о токене
    print("\n📝 Тест 1: Проверка токена (users.get)")
    url = "https://api.vk.com/method/users.get"
    params = {
        "access_token": VK_TOKEN,
        "v": "5.131"
    }
    response = requests.get(url, params=params)
    data = response.json()
    print(f"Ответ: {data}")
    
    if "response" in data and data["response"]:
        user = data["response"][0]
        print(f"✅ Токен валиден! User ID: {user.get('id')}, {user.get('first_name', '')} {user.get('last_name', '')}")
    elif "error" in data:
        print(f"❌ Ошибка: {data['error'].get('error_msg', 'Unknown')}")
    
    # 2. Проверяем права токена
    print("\n📝 Тест 2: Проверка прав токена (account.getAppPermissions)")
    url = "https://api.vk.com/method/account.getAppPermissions"
    params = {
        "access_token": VK_TOKEN,
        "v": "5.131"
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    if "response" in data:
        permissions = data["response"]
        print(f"✅ Код прав: {permissions}")
        
        # Декодируем права
        rights = []
        if permissions & 1: rights.append("notify")
        if permissions & 2: rights.append("friends")
        if permissions & 4: rights.append("photos")
        if permissions & 8: rights.append("audio")  # Важно!
        if permissions & 16: rights.append("video")
        if permissions & 32: rights.append("stories")
        if permissions & 64: rights.append("pages")
        if permissions & 128: rights.append("link")
        if permissions & 256: rights.append("status")
        if permissions & 512: rights.append("notes")
        if permissions & 1024: rights.append("messages")
        if permissions & 2048: rights.append("wall")
        if permissions & 4096: rights.append("ads")
        if permissions & 8192: rights.append("offline")
        if permissions & 16384: rights.append("docs")
        if permissions & 32768: rights.append("groups")
        if permissions & 65536: rights.append("notifications")
        if permissions & 131072: rights.append("stats")
        if permissions & 262144: rights.append("email")
        if permissions & 524288: rights.append("market")
        
        print(f"📋 Разрешения: {', '.join(rights) if rights else 'нет'}")
        
        if permissions & 8:
            print("✅ Право на AUDIO есть!")
        else:
            print("❌ Права на AUDIO НЕТ!")
    elif "error" in data:
        print(f"❌ Ошибка: {data['error'].get('error_msg', 'Unknown')}")
    
    # 3. Пробуем получить аудио напрямую через VK API
    print("\n📝 Тест 3: Прямой запрос аудио (audio.get)")
    url = "https://api.vk.com/method/audio.get"
    params = {
        "access_token": VK_TOKEN,
        "v": "5.131",
        "count": 5
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    if "response" in data:
        print(f"✅ Аудио получено: {len(data['response'].get('items', []))} треков")
        for item in data['response'].get('items', [])[:3]:
            print(f"   - {item.get('artist', '?')} - {item.get('title', '?')}")
    elif "error" in data:
        error = data['error']
        print(f"❌ Ошибка {error.get('error_code')}: {error.get('error_msg', 'Unknown')}")
        if error.get('error_code') == 15:
            print("   ℹ️ Доступ к аудио запрещён (требуется специальный токен от приложения VK)")
    
    # 4. Пробуем поиск через API
    print("\n📝 Тест 4: Поиск аудио (audio.search)")
    url = "https://api.vk.com/method/audio.search"
    params = {
        "access_token": VK_TOKEN,
        "q": "Imagine Dragons",
        "v": "5.131",
        "count": 5
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    if "response" in data:
        items = data['response'].get('items', [])
        print(f"✅ Найдено: {len(items)} треков")
        for item in items[:3]:
            print(f"   - {item.get('artist', '?')} - {item.get('title', '?')}")
    elif "error" in data:
        error = data['error']
        print(f"❌ Ошибка {error.get('error_code')}: {error.get('error_msg', 'Unknown')}")
    
    print("\n" + "=" * 60)
    print("🏁 Проверка завершена")
    print("=" * 60)

if __name__ == "__main__":
    check_token()
