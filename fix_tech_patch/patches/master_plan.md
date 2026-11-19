# ГЕНЕРАЛЬНИЙ МУЛЬТИ-ПЛАН: ТРАНСФОРМАЦІЯ В «ОСВІТНІЙ КОМБАЙН»

Мульти-план розбитий на **4 окремі етапи (Stage 1–4)**, що збережені у папці `fix_test_patch/` для економії токенів, оптимізованої перевірки та крокового виконання без перевищення лімітів.

---

## 🗂️ РЕЄСТР ФАЙЛІВ МУЛЬТИ-ПЛАНУ (`fix_test_patch/`)

```text
fix_test_patch/
├── master_plan.md                <-- Огляд магістральної архітектури
├── stage_1_contracts_state.md    <-- ЕТАП 1: Контракти даних та Zustand стори
├── stage_2_storage_resilience.md <-- ЕТАП 2: IndexedDB (Dexie) та Crash-Guard (LocalStorage)
├── stage_3_engines_bus.md        <-- ЕТАП 3: Шина плагінних рушіїв (Adapter & Registry)
└── stage_4_story_pipeline_ui.md  <-- ЕТАП 4: Сценарний плеєр квесту та підключення UI
```

---

## 📌 ПРИНЦИПИ ГЛОБАЛЬНОСТІ ТА СТИЛІВ
1. **Єдине сервісне ядро**: Усі виклики (звукове ядро `soundEngineService`, модалка профілю, імпортер YAML, гейт підказок) керуються через глобальні Zustand-стори та доступні з будь-якого екрана застосунку.
2. **Централізовані стилі**: Трьохрежимна палітра (Фокус, Затишок, Папір) задається глобальними CSS-змінними в `src/styles/variables.css`.

---

## 🚀 КОРОТКИЙ ОГЛЯД ЕТАПІВ

### **ЕТАП 1: Контракти Даних та Zustand Стори (`stage_1_contracts_state.md`)**
- `src/core/contracts/task.contract.ts` (`AtomicTask`).
- `src/core/contracts/campaign.contract.ts` (`QuestStep`).
- `src/core/contracts/profile.contract.ts` (`TraitsRadar`).
- `src/core/state/useProfileStore.ts`, `useSessionStore.ts`, `useThemeStore.ts`.

### **ЕТАП 2: Безвідмовне Сховище (`stage_2_storage_resilience.md`)**
- `src/core/storage/db.ts` (IndexedDB через Dexie.js).
- `src/core/storage/crash-guard.ts` (Синхронний флеш-буфер LocalStorage при закритті/відключенні світла).
- `src/core/storage/content-resolver.ts` (Поєднання нативного контенту з імпортованими YAML квестами).

### **ЕТАП 3: Шина Інтерактивних Рушіїв (`stage_3_engines_bus.md`)**
- `src/engines/adapter.ts` (`EngineProps`).
- `src/engines/registry.ts` (Каталог плагінів за `engineId`).
- Покрокове додавання перших базових рушіїв.

### **ЕТАП 4: Сценарний Плеєр та UI (`stage_4_story_pipeline_ui.md`)**
- `src/features/story-player/QuestPipeline.tsx` (Стейт-машина: Діалог ➔ Пісочниця ➔ Задача ➔ Соматична пауза).
- `DialogueCard.tsx`, `GbaEmoteBubble.tsx`, `TraitsRadar.tsx`.
