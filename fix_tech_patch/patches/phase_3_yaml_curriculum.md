# 📜 ФАЗА 3 [Lite-Medium / L]: ДЕКЛАРАТИВНИЙ КАТАЛОГ КОНТЕНТУ ТА YAML-ПАРСЕР

**Рівень складності:** Medium (Доступно для Gemini 3.1 - 3.5 Lite з інструкціями)  
**Мета:** Винести сценарії уроків із TypeScript-коду у чисті `.yaml` файли у папці `/content/` та усунути `if/else` розгалуження у `scenarioBuilderService.ts`.

---

## 📂 1. Структура директорії контенту

```
/content/grades/grade-05/subjects/math/chapters/
  ├── 01-place-values.yaml
  ├── 02-addition-methods.yaml
  ├── 03-multiplication-bridge.yaml
  └── 04-perimeter-camp.yaml
```

---

## 🛠️ 2. Схема YAML-файлу уроку (`01-place-values.yaml`)

```yaml
id: "chapter1_place_values"
grade: 5
subject: "math"
title: "Розділ 1: Розрядний склад двоцифрових чисел"
description: "Розклад чисел на десятки й одиниці для швидкого обчислення дощок мосту."
islandStageName: "Зруйнований міст"

pipeline:
  - type: "block_dialogue"
    id: "d1"
    speaker: "Бобер Брус"
    avatar: "🦫"
    emote: "idea"
    text: "Вітаю на острові! Буря пошкодила переправу. Потрібно полагодити міст!"

  - type: "block_theory_rule"
    id: "t1"
    title: "📖 Розрядний склад числа"
    ruleSummary: "Двоцифрове число складається з двох розрядів: Десятки (10) та Одиниці (1)."
    formulaText: "Число = (Десятки × 10) + Одиниці"
    stepByStepBreakdown:
      - "24 = 20 + 4"
      - "13 = 10 + 3"
      - "20 + 10 = 30; 4 + 3 = 7 -> 37"

  - type: "block_interactive_sandbox"
    id: "s1"
    engineId: "balance-physics"
    instruction: "Зрівноважте терези вантажами для утворення 37!"
    config:
      targetSum: 37
      initialTens: 2
      initialOnes: 4

  - type: "block_somatic_pause"
    id: "som1"
    activityId: "double_sigh"
    durationSec: 45

  - type: "block_notebook_task"
    id: "n1"
    title: "Зошит"
    notebookPrompt: "Обчисли у зошиті: 24 + 13 = ?"
    correctAnswer: 37
    hint: "Додай десятки, потім одиниці."
    reward:
      wood: 25
      stone: 10
      energy: 15
```

---

## 📋 3. Покроковий чекліст для виконання (Lite Agent Checklist)

- [ ] **Крок 3.1**: Створити папку `/content/grades/grade-05/subjects/math/chapters/`.
- [ ] **Крок 3.2**: Написати YAML файли для розділів 1, 2, 3, 4 у створеній папці.
- [ ] **Крок 3.3**: Модернізувати `src/services/yamlCurriculumParser.ts` для підтягування `pipeline` блоків з файлу.
- [ ] **Крок 3.4**: Рефакторити `src/services/scenarioBuilderService.ts` так, щоб він завантажував `pipeline` з YAML за вказаним `chapterId` без хардкодних `if/else`.
- [ ] **Крок 3.5**: Перевірити через `compile_applet` та `lint_applet`.
