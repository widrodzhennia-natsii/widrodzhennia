# ЕТАП 2: БЕЗВІДМОВНЕ ОФЛАЙН-СХОВИЩЕ (STAGE 2)

Опис етапу побудови Dexie/IndexedDB та аварійного LocalStorage флеш-буфера для витримування раптових вимкнень світла.

---

## 🎯 МЕТА ЕТАПУ 2
Забезпечити 100% збереження прогресу у випадку аварійного вимкнення пристрою (Blackout Defense).

---

## 📋 КРОКИ ВИКОНАННЯ

### **Крок 2.1: Створення бази Dexie (`src/core/storage/db.ts`)**
- Таблиці: `profile`, `campaigns`, `tasks`, `journalEntries`.
- Автоматичний виклик `navigator.storage.persist()`.

### **Крок 2.2: Аварійний флеш-буфер (`src/core/storage/crash-guard.ts`)**
- Синхронне дзеркалювання поточного кроку у `LocalStorage`.
- Слухачі `visibilitychange` та `pagehide` для примусового збереження.

### **Крок 2.3: Content Resolver (`src/core/storage/content-resolver.ts`)**
- Об'єднання вшитого контенту `content/` з імпортованими YAML квестами від вчителів/батьків.

---

## 🔍 ПЕРЕВІРКА РЕЗУЛЬТАТУ
- Запуск `compile_applet` та `lint_applet`.
