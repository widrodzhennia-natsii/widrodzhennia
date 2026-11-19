# 🍕 ФАЗА 4 [Lite-Dedicated / L]: РУШІЙ ДРОБІВ (`FractionSlicerEngine`)

**Рівень складності:** Medium-Dedicated (Окремий розроблювальний модуль для Gemini 3.1 - 3.5 Lite)  
**Мета:** Розробити тактильний фізико-наочний рушій для 5 класу НУШ, де учень пальцем/слайдером нарізає цілий об'єкт (дошку, хліб, пиріг) на $N$ часток та експериментує з еквівалентністю $\frac{1}{2} = \frac{2}{4}$.

---

## 🛠️ 1. Контракт та пропси рушія (`src/engines/fraction-slicer/FractionSlicerEngine.tsx`)

```typescript
export interface FractionSlicerConfig {
  targetFractionNumerator: number; // наприклад 3
  targetFractionDenominator: number; // наприклад 4
  itemType?: 'wooden_beam' | 'bread_loaf' | 'cossack_pie';
  instruction?: string;
  customSuccessText?: string;
}
```

---

## 🎨 2. Інтерактивна механіка та Canvas 2D

1. **Верхня зона Stage (Canvas)**:
   - Відображає суцільний об'єкт (наприклад, козацький дерев'яний брус завдовжки 400px).
   - При виборі знаменника (наприклад, $D = 4$) об'єкт розділяється вертикальними пунктирними лініями різу на 4 рівні частини.
   - Клік по секції "зафарбовує" її яскраво-бронзовим/зеленим кольором (вибір чисельника $N$).
2. **Панель керування**:
   - Кількість часток (Знаменник $D$): кнопки `-` / `+` або слайдер від 2 до 12.
   - Обрано часток (Чисельник $N$): прямий тактильний клік по секціях на полотні Canvas.
   - Живий вивід дробу: $\frac{N}{D}$ з ефектом еквівалентності (наприклад: $\frac{2}{4} \equiv \frac{1}{2}$).

---

## 📋 3. Покроковий чекліст для виконання (Lite Agent Checklist)

- [ ] **Крок 4.1**: Створити папку `src/engines/fraction-slicer/`.
- [ ] **Крок 4.2**: Написати `FractionSlicerEngine.tsx` відповідно до пропсів `EngineProps<FractionSlicerConfig>`.
- [ ] **Крок 4.3**: Зареєструвати `FractionSlicerEngine` у `src/engines/registry.ts` під ідентифікатором `fraction-slicer`.
- [ ] **Крок 4.4**: Створити тестовий YAML-блок з `engineId: "fraction-slicer"`.
- [ ] **Крок 4.5**: Перевірити збірку через `compile_applet` та `lint_applet`.
