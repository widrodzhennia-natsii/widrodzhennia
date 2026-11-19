# 🎯 ФАЗА 1 [Lite / L]: УНІФІКАЦІЯ СЦЕНАРНОГО КОНВЕЄРА КВЕСТУ (`Block-Based Story Pipeline`)

**Рівень складності:** Low-Medium (Доступно для Gemini 3.1 - 3.5 Lite)  
**Мета:** Усунути паралельне рендерення `QuestPipeline` та `LessonProgressiveFlow`, об'єднавши всі кроки НУШ та припеченого сюженту в єдину послідовну смугу блоків.

---

## 🛠️ 1. Технічні інтерфейси та контракти (`src/core/contracts/campaign.contract.ts`)

```typescript
export type StoryBlock =
  | {
      type: 'block_dialogue';
      id: string;
      speaker: string;
      avatar: string;
      text: string;
      emote?: 'idea' | 'sweat' | 'question' | 'joy';
    }
  | {
      type: 'block_anchor_fact';
      id: string;
      year: number;
      headline: string;
      contentSummary: string;
      locationLabel: string;
    }
  | {
      type: 'block_theory_rule';
      id: string;
      title: string;
      ruleSummary: string;
      formulaText?: string;
      stepByStepBreakdown: string[];
    }
  | {
      type: 'block_interactive_sandbox';
      id: string;
      engineId: string;
      instruction: string;
      config: Record<string, any>;
    }
  | {
      type: 'block_recognition_quiz';
      id: string;
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }
  | {
      type: 'block_notebook_task';
      id: string;
      title: string;
      notebookPrompt: string;
      correctAnswer: number | string;
      hint: string;
      reward: { wood: number; stone: number; energy: number };
    }
  | {
      type: 'block_boss_challenge';
      id: string;
      title: string;
      contextStory: string;
      notebookPrompt: string;
      correctAnswer: number | string;
      reward: { wood: number; stone: number; energy: number };
    }
  | {
      type: 'block_somatic_pause';
      id: string;
      activityId: 'vocal_humming' | 'double_sigh' | 'muscle_squeeze' | 'eye_eight';
      durationSec: number;
    };
```

---

## 📋 2. Покроковий чекліст для виконання (Lite Agent Checklist)

- [ ] **Крок 1.1**: Оновити `src/core/contracts/campaign.contract.ts`, додавши нові типи блоків.
- [ ] **Крок 1.2**: Модернізувати `src/features/story-player/QuestPipeline.tsx`:
  - Додати підтримку рендерингу для `block_theory_rule`, `block_recognition_quiz`, `block_notebook_task`, `block_boss_challenge`, `block_anchor_fact`.
  - Прибрати дублюючі компоненти зверху.
- [ ] **Крок 1.3**: Модернізувати `src/features/shell/MainHubRouter.tsx`:
  - Видалити рендеринг `<LessonProgressiveFlow />` у правому стовпчику при `nav.activeView === 'game'`.
  - Залишити лише один очищений `<QuestPipeline />`, який послідовно програє масив блоків даного уроку.
- [ ] **Крок 1.4**: Перевірити збірку через `compile_applet` та `lint_applet`.
