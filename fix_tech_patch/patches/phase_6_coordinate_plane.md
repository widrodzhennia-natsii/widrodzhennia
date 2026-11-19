# 🗺️ ФАЗА 6 [Lite-Dedicated / L]: РУШІЙ КООРДИНАТНОЇ СІТКИ (`CoordinatePlaneEngine`)

**Рівень складності:** Medium-Dedicated (Окремий розроблювальний модуль для Gemini 3.1 - 3.5 Lite)  
**Мета:** Розробити інтерактивну топографічну координатну сітку $(X, Y)$ для навігації козацьких чайок повз скелі та мілини навколо Хортиці.

---

## 🛠️ 1. Контракт та пропси рушія (`src/engines/coordinate-plane/CoordinatePlaneEngine.tsx`)

```typescript
export interface CoordinatePlaneConfig {
  targetPoint: { x: number; y: number };
  obstacles?: Array<{ x: number; y: number; label: string }>;
  gridSize?: { width: number; height: number }; // наприклад 10x10
  instruction?: string;
  theme?: 'river_map' | 'canyon_topography';
}
```

---

## 🎨 2. Інтерактивна механіка та Canvas 2D

1. **Координатна сітка Canvas (400x300)**:
   - Осі $OX$ та $OY$ з чітко пронованими поділками від 0 до 10.
   - Відображення перешкод (скелі Дніпра, підводні мілини) на відповідних координатах.
   - Козацька чайка (човен), яка переміщується при зміні точок $X$ та $Y$.
2. **Панель вводу та навігації**:
   - Два інтерактивні лічильники: `Координата X` та `Координата Y`.
   - Індикатор фарватера: «Обережно: мілина!» або «Безпечний фарватер досягнуто!».

---

## 📋 3. Покроковий чекліст для виконання (Lite Agent Checklist)

- [ ] **Крок 6.1**: Створити папку `src/engines/coordinate-plane/`.
- [ ] **Крок 6.2**: Написати `CoordinatePlaneEngine.tsx` з координатними осями та анімацією переміщення човна.
- [ ] **Крок 6.3**: Зареєструвати рушій у `src/engines/registry.ts` під ідентифікатором `coordinate-plane`.
- [ ] **Крок 6.4**: Перевірити збірку через `compile_applet` та `lint_applet`.
