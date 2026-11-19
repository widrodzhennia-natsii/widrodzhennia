import React from 'react';
import { EngineAdapter, EngineProps } from './adapter';
import { BalancePhysicsEngine } from './balance-physics/BalancePhysicsEngine';
import { NumberLineEngine } from './number-line/NumberLineEngine';
import { BallisticPhysicsEngine } from './ballistic-physics/BallisticPhysicsEngine';
import { GeometryCannonEngine } from './geometry-cannon/GeometryCannonEngine';
import { FractionSlicerEngine } from './fraction-slicer/FractionSlicerEngine';
import { ProtractorAngleEngine } from './protractor-angle/ProtractorAngleEngine';
import { CoordinatePlaneEngine } from './coordinate-plane/CoordinatePlaneEngine';
import { PlaceValueAbacusEngine } from './place-value-abacus/PlaceValueAbacusEngine';
import { NumberLineScalesEngine } from './number-line-scales/NumberLineScalesEngine';
import { DragSorterProtocolEngine } from './drag-sorter-protocol/DragSorterProtocolEngine';
import { MusicSequencerEarEngine } from './music-sequencer-ear/MusicSequencerEarEngine';
import { ColorPerspectiveStudioEngine } from './color-perspective-studio/ColorPerspectiveStudioEngine';
import { CircuitFlashlightEngine } from './circuit-flashlight/CircuitFlashlightEngine';
import { TimelineCompassMapEngine } from './timeline-compass-map/TimelineCompassMapEngine';
import { PixelEmbroideryGridEngine } from './pixel-embroidery-grid/PixelEmbroideryGridEngine';
import {
  ThesisOutlineBuilderEngine,
  DensityMassLabEngine,
  EcoBalanceSimEngine,
} from './base-extension/BaseExtensionEngines';
import { ColumnArithmeticEngine } from './curriculum-1-12/ColumnArithmeticEngine';
import { PhoneticTranscriptionEngine } from './curriculum-1-12/PhoneticTranscriptionEngine';
import { PolyhedronNet3DEngine } from './curriculum-1-12/PolyhedronNet3DEngine';
import { MatrixDeterminantLabEngine } from './curriculum-1-12/MatrixDeterminantLabEngine';
import { OpticsLensLabEngine } from './curriculum-1-12/OpticsLensLabEngine';
import { PunnettGeneticsLabEngine } from './curriculum-1-12/PunnettGeneticsLabEngine';
import { LogicGatesTracerEngine } from './curriculum-1-12/LogicGatesTracerEngine';

export class EngineRegistry {
  private static registry = new Map<string, EngineAdapter>();

  public static registerEngine(adapter: EngineAdapter): void {
    this.registry.set(adapter.engineId, adapter);
  }

  public static getEngine(engineId: string): EngineAdapter | undefined {
    return this.registry.get(engineId);
  }

  public static hasEngine(engineId: string): boolean {
    return this.registry.has(engineId);
  }

  public static getComponent(engineId: string): React.ComponentType<EngineProps> | null {
    const adapter = this.getEngine(engineId);
    return adapter ? adapter.component : null;
  }

  public static getAllEngines(): EngineAdapter[] {
    return Array.from(this.registry.values());
  }
}

EngineRegistry.registerEngine({
  engineId: 'balance-physics',
  title: 'Інтерактивні Терези',
  description: 'Баланс ваги, порівняння величин та прості рівняння з X',
  component: BalancePhysicsEngine as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'number-line',
  title: 'Числова Променева Вісь',
  description: 'Інтерактивні стрибки по числовій осі',
  component: NumberLineEngine as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'number-line-scales',
  title: 'Шкали й Прилади (Термометр / Мензурка / Годинник)',
  description: 'Вимірювання на шкалах із ціною поділки та налаштування годинника',
  component: NumberLineScalesEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'measurement-scales',
  title: 'Вимірювальні Прилади (Alias)',
  description: 'Аліас рушія вимірювальних шкал',
  component: NumberLineScalesEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'drag-sorter-protocol',
  title: 'Сортувальник Категорій і Протоколів',
  description: 'Класифікація об’єктів по кошиках та впорядкування кроків безпеки',
  component: DragSorterProtocolEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'music-sequencer-ear',
  title: 'Музичний Секвенсор і Слух',
  description: 'Пентатоніка на Web Audio, відтворення мелодій на слух та конструктор ритму',
  component: MusicSequencerEarEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'color-perspective-studio',
  title: 'Студія Кольору та Перспективи',
  description: 'Коло Іттена, змішування відтінків, лінійна перспектива та світлотінь',
  component: ColorPerspectiveStudioEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'ballistic-trajectory',
  title: 'Універсальний Балістичний Рушій',
  description: 'Балістична симуляція з фізикою польоту, гравітацією, вітром та опором повітря',
  component: BallisticPhysicsEngine as unknown as React.ComponentType<EngineProps>,
});

// Backward-compatible alias for YAML files referencing khortytsia-cannon
EngineRegistry.registerEngine({
  engineId: 'khortytsia-cannon',
  title: 'Балістичний Рушій (Legacy Alias)',
  description: 'Аліас універсального балістичного рушія',
  component: BallisticPhysicsEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'geometry-cannon',
  title: 'Геометричний Балістичний Кутомір',
  description: 'Розрахунок дальності та оптимального кута траєкторії',
  component: GeometryCannonEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'fraction-slicer',
  title: 'Тренажер Дробів (Нарізання часток)',
  description: 'Тактильне розбірання цілого на рівні дробові частки',
  component: FractionSlicerEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'protractor-angle',
  title: 'Інтерактивний Транспортир',
  description: 'Вимірювання та побудова кутів у геометрії',
  component: ProtractorAngleEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'coordinate-plane',
  title: 'Топографічна Координатна Сітка',
  description: 'Прокладання маршрутів за координатами (X, Y)',
  component: CoordinatePlaneEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'place-value-abacus',
  title: 'Тактильна Соробан-Рахівниця',
  description: 'Розклад натуральних та десяткових чисел на спицях розрядів',
  component: PlaceValueAbacusEngine as unknown as React.ComponentType<EngineProps>,
});

// --- Stage 4: Completing 18 Base Engines ---
EngineRegistry.registerEngine({
  engineId: 'circuit-flashlight',
  title: 'Електричне Коло та Резистор',
  description: 'Закон Ома для Li-ion, резистора і захисту світлодіода від перегріву',
  component: CircuitFlashlightEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'timeline-compass-map',
  title: 'Хронологічна Стрічка і Компас',
  description: 'Офлайн-азимут сторін світу та впорядкування історичних дат',
  component: TimelineCompassMapEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'pixel-embroidery-grid',
  title: 'Піксельна Вишиванка і Симетрія',
  description: 'Побудова симетричного орнаменту та цифрове кодування рядків',
  component: PixelEmbroideryGridEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'thesis-outline-builder',
  title: 'Конструктор Текстів-Опор',
  description: 'Структурування конспекту: Теза → Аргумент → Факт → Висновок',
  component: ThesisOutlineBuilderEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'density-mass-lab',
  title: 'Лабораторія Густини і Маси',
  description: 'Дослідження ρ = m / V та плавучості тіл у мензурці',
  component: DensityMassLabEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'eco-balance-sim',
  title: 'Симулятор Екологічного Балансу',
  description: 'Баланс озеленення, водозбереження та чистої енергії',
  component: EcoBalanceSimEngine as unknown as React.ComponentType<EngineProps>,
});

// --- Stage 4: Grades 1-12 Subject Engines ---
EngineRegistry.registerEngine({
  engineId: 'column-arithmetic',
  title: 'Стовпчикова Арифметика (1–4 класи)',
  description: 'Порозрядне додавання і віднімання в стовпчик із перенесенням та позикою',
  component: ColumnArithmeticEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'phonetic-transcription',
  title: 'Фонетична Транскрипція (Мова)',
  description: 'Поділ на склади, наголос та звукові фішки у квадратних дужках',
  component: PhoneticTranscriptionEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'polyhedron-net-3d',
  title: '3D-Розгортки Многогранників',
  description: 'Згортання 2D-сітки у 3D-тіло та формула Ейлера V − E + F = 2',
  component: PolyhedronNet3DEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'matrix-determinant-lab',
  title: 'Лабораторія Матриць (10–12 класи)',
  description: 'Інтерактивний розрахунок визначника детермінанта матриць 2×2 та 3×3',
  component: MatrixDeterminantLabEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'optics-lens-lab',
  title: 'Геометрична Оптика: Лінзи',
  description: 'Хід променів у збиральній та розсіювальній лінзах (1/F = 1/d + 1/f)',
  component: OpticsLensLabEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'punnett-genetics-lab',
  title: 'Решітка Пеннета (Генетика)',
  description: 'Схрещування алелів батьків та розщеплення фенотипів у відсотках',
  component: PunnettGeneticsLabEngine as unknown as React.ComponentType<EngineProps>,
});

EngineRegistry.registerEngine({
  engineId: 'logic-gates-tracer',
  title: 'Логічні Вентилі та Трасувальник Коду',
  description: 'Цифрова логіка AND/OR/XOR/NOT та покроковий стек змінних',
  component: LogicGatesTracerEngine as unknown as React.ComponentType<EngineProps>,
});
