# ЕТАП 1: КОНТРАКТИ ДАНИХ ТА ZUSTAND СТОРЫ (STAGE 1)

Цей файл описує конкретні кроки Етапу 1. Для економії токенів виконання розбито на дрібні атомарні операції з проміжною компіляцією.

---

## 🎯 МЕТА ЕТАПУ 1
Створити єдиний надійний шар контрактів даних та глобального стейту Zustand, який замінить локальний `useState` та проп-дрілінг.

---

## 📋 КРОКИ ВИКОНАННЯ

### **Крок 1.1: Інсталяція Zustand та Dexie**
- Встановлення `zustand` та `dexie` в `package.json`.

### **Крок 1.2: Створення контрактів (`src/core/contracts/`)**
1. `src/core/contracts/task.contract.ts`:
   - `AtomicTask` (prompt, engineId, engineConfig, solution, feedback, copilotGuide).
2. `src/core/contracts/campaign.contract.ts`:
   - `QuestStep` (`dialogue`, `sandbox`, `task_ref`, `somatic_break`, `world_event`).
3. `src/core/contracts/profile.contract.ts`:
   - `StudentProfile` (досвід, радар якостей, відкриті картки).

### **Крок 1.3: Створення Zustand Сторінгів (`src/core/state/`)**
1. `useProfileStore.ts`:
   - Досвід, радар якостей (`Resilience`, `Logic`, `Curiosity`, `SpatialIntuition`), ім’я дитини, оновлення.
2. `useSessionStore.ts`:
   - Активний квест, поточний крок `QuestStep`, стан пісочниці.
3. `useThemeStore.ts`:
   - Режими: `Focus` (Денний), `Cozy` (Затишок), `Paper` (Монохромний).

---

## 🔍 ПЕРЕВІРКА РЕЗУЛЬТАТУ
- Запуск `compile_applet` та `lint_applet` для підтвердження відсутності помилок типів TypeScript.
