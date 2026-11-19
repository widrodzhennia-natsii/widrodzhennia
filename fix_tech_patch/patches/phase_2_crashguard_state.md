# ⚡ ФАЗА 2 [Lite / L]: РОЗШИРЕННЯ `CrashGuard` ТА ПОЙНОГО СТАНУ ЗБЕРЕЖЕННЯ

**Рівень складності:** Low (Доступно для Gemini 3.1 - 3.5 Lite)  
**Мета:** Забезпечити збереження введених у зошит відповідей, вибору варіантів та проміжних блоків у `LocalStorage` (CrashGuard), щоб при вимкненні світла/браузера учень не втрачав нічого.

---

## 🛠️ 1. Оновлення пейлоаду `CrashGuard` (`src/core/storage/crash-guard.ts`)

```typescript
export interface FlashBufferPayload {
  questId: string | null;
  stepIndex: number; // Поточний крок блок-конвеєра
  inputDrafts: Record<string, string | number>; // Збережені чернетки у полях вводу
  completedBlockIds: string[]; // Виконані блоки уроку
  sandboxState: Record<string, any>;
  timestamp: number;
}
```

---

## 📋 2. Покроковий чекліст для виконання (Lite Agent Checklist)

- [ ] **Крок 2.1**: Доповнити інтерфейс `FlashBufferPayload` у `src/core/storage/crash-guard.ts` полями `inputDrafts` та `completedBlockIds`.
- [ ] **Крок 2.2**: У `src/core/state/useSessionStore.ts` додати дії:
  ```typescript
  setInputDraft: (blockId: string, value: string | number) => void;
  markBlockCompleted: (blockId: string) => void;
  ```
- [ ] **Крок 2.3**: У `CrashGuard.init()` налаштувати передзавантаження `inputDrafts` при поверненні на сторінку після аварійного закриття.
- [ ] **Крок 2.4**: Перевірити збереження стану через `compile_applet` та `lint_applet`.
