# Глибокий аудит проєкту (Скрипт-аналіз коду, контенту та UI ↔ Код паритету)

> **Мета аудиту:** Виявити неробочі механізми, вшиті навчальні матеріали всередині системного коду (`src/`), розбіжності з папочною структурою `/content/`, мертвий код та невідповідності між візуальними елементами сторінок і їхньою реальною логікою.

---

## 1. Зведена діагностика (Executive Summary)

У результаті автоматизованого та ручного аналізу всіх ~90 файлів у `src/` та 3 YAML-файлів у `content/` виявлено **5 критичних системних проблем**:

1. **Порушення принципу розділення «Рушій (`src/`) vs Навчальний контент (`/content/`)»:**
   Значна частина сценаріїв про Хортицю (1556–1557), Бобра Бруса, козацькі човни, число `3425`, розміри `480 см × 540 см`, репліки персонажів, підказки та базові предмети («Математика», «Історія України») жорстко вшиті у TypeScript/TSX-файли комбайна та UI-компоненти.
2. **Зламаний конвеєр завантаження `/content/` та конфлікт схем парсера:**
   - `ContentLoaderService.initCache()` завантажує **всі** `.yaml` файли з `/content/` як уроки, включаючи `blueprints/01-timber-gate.yaml`, перетворюючи креслення (blueprint) на фейковий урок.
   - `ContentLoaderService.getGrades()` скидає **всі** розпарсені файли з `/content/` (у т.ч. урок з `history/chapters/01-khortytsia-defense.yaml`) у предмет `math`, залишаючи предмет `history` назавжди порожнім (`chapters: []`).
   - Фактичні файли в `/content/` використовують типи `type: "fact"`, `type: "interactive_engine"`, `type: "blueprint_task"`, `engineConfig:` і `hints:`, які `YamlCurriculumParser` частково або повністю ігнорує (зокрема `interactive_engine` відкидається, `blueprint_task` парситься як зламаний `block_notebook_task` без креслення та правильної відповіді).
3. **Ефект «розщепленого мозку» (Split-Brain State & Orphan Components):**
   - У проєкті виявлено **14 файлів-сиріт (0 імпортів в активному коді)**, зокрема `ClassSubjectSelector.tsx`, куди було додано слухач режиму видалення `nush_delete_mode_enabled`, тоді як активний маршрутизатор `MainHubRouter.tsx` рендерить `BookshelfView.tsx` (який цей режим ігнорує).
   - Стан профілю та прогресу роздвоєний між `useProfileStore` (`edu_student_profile_v1`, оновлюється у `QuestPipeline`) та `useGameProgress` (`edu_game_progress_v1`, читається у `Header`, `ProgressBar`, `IslandScene`, `WorldMapView`, `ClassicTopicListView`, `ModalsContainer`). Через це проходження квестів у плеєрі не просуває прогрес на карті, сцені чи в хедері.
4. **Несумісність контрактів інтерактивних рушіїв (Engine Config Mismatch):**
   `YamlCurriculumParser` зберігає лише `targetNumber` і `targetValue` у `config`, обрізаючи всі специфічні параметри інших рушіїв (`targetSum` для `BalancePhysicsEngine`, `startNumber`/`addend` для `NumberLineEngine`, `correctAngle`/`correctPower` для `KhortytsiaCannonEngine`, `targetNumerator`/`targetDenominator` для `FractionSlicerEngine`, `targetAngle` для `ProtractorAngleEngine`, `targetPoint` для `CoordinatePlaneEngine`).
5. **Кнопки та опції UI без робочої логіки або з помилковою поведінкою:**
   Ігнорування 5 із 7 типів файлів в імпортері (`manifest`, `avatar`, `blueprint`, `voice_config`, `media`), невидимість імпорту в `7 клас`, неробочі режими `append` / `extend_lesson` для системних книг, мертвий `HintGate`, невикористаний проп `onImportProfile`, помилкові статуси навігації в `Header`.

---

## 2. Аудит завантаження `/content/` та конфліктів парсерів

### Поточний стан папки `/content/`
У `/content/` знаходяться 3 файли:
- `/content/grades/grade-05/subjects/history/chapters/01-khortytsia-defense.yaml`
- `/content/grades/grade-05/subjects/math/blueprints/01-timber-gate.yaml`
- `/content/grades/grade-05/subjects/math/chapters/01-numbers-and-operations.yaml`

### Виявлені збої в завантаженні та парсингу

| Компонент / Рядки | Опис збою | Наслідок у програмі |
|---|---|---|
| `src/services/contentLoaderService.ts:46-57` | `import.meta.glob('/content/**/*.yaml')` пропускає лише `map.yaml`, `subject.yaml`, `registry.yaml`. Папка `blueprints/` **не виключена** і не маршрутизується в `YamlBlueprintParser`. | `01-timber-gate.yaml` парситься як звичайний урок (`parseQuestYaml`), отримує fallback-діалог від `"Бобер Брус"` (рядок `yamlCurriculumParser.ts:246`) і потрапляє на мапу курсу як розділ. |
| `src/services/contentLoaderService.ts:338-363` | `getGrades()` жорстко створює `mathSubject` і `historySubject`, але передає `chapters: this.getChapters()` у `mathSubject`, а в `historySubject` ставить `chapters: []`. Ігноруються `subjectId` та `gradeId` із YAML/шляху файлу. | Урок `01-khortytsia-defense.yaml` (з папки `history`) опиняється всередині «Математики», а «Історія України» завжди порожня. |
| `src/services/contentLoaderService.ts:326-333, 382-416` | `getGrades()` повертає лише масив `[grade5, grade6Preview]`. `normalizeGradeId` знає про `grade_7`, але 7–11 класів немає в дереві класів. | На екрані `ClassDoorsHall` («Двері Класу (5–11)») показуються лише двері 5 та 6 класу; курси, імпортовані у 7 клас через `DropZoneModal`, зникають із видимості. |
| `src/services/contentLoaderService.ts:221, 225` | `formatQuestToChapter()` ставить `islandStageName: quest.islandStageName || 'Локація експедиції'`. Поле завжди truthy. | `MainHubRouter.tsx:114` (`{game.currentChapter?.islandStageName && <IslandScene ... />}`) **завжди** рендерить річку/міст/бобра навіть там, де локації немає. |
| `src/services/yamlCurriculumParser.ts:76-85` | Нормалізація типів блоків не знає про `interactive_engine` (є в `01-khortytsia-defense.yaml:40`). | Блок `khortytsia-cannon-task` з типом `interactive_engine` **повністю відкидається** під час парсингу; урок втрачає інтерактивний тренажер. |
| `src/services/yamlCurriculumParser.ts:82, 211-220` | `type: "blueprint_task"` (у `01-numbers-and-operations.yaml:39`) підпадає під `rawType.includes('task')` → перетворюється на `block_notebook_task`. Парсер не підтримує `blueprintId`, а в самому YAML немає `correctAnswer`. | Завдання `quest-timber-gate` відкривається без креслення та з порожньою правильною відповіддю (`correctAnswer: ""`). |
| `src/services/yamlCurriculumParser.ts:143-151` | `block_anchor_fact` не зчитує вкладений масив `hints:` (який є в обох уроках у `/content/`). | Вбудовані в YAML підказки/питання ігноруються. |
| `src/services/yamlCurriculumParser.ts:507-546` | Клас `YamlBlueprintParser` реалізовано, але **ніде в проєкті не викликається (0 посилань)**. | Креслення з `/content/**/blueprints/*.yaml` та завантажені користувачем блупрінти не парсяться і не прив'язуються до завдань. |
| `src/services/contentLoaderService.ts:285-321` | `getWorldMapSchemaForSubject()` бере єдиний `mapSchema` у кастомної книги або генерує змійку `generateNonOverlappingMapLayout`, але **не читає** `mapTopology` із YAML-уроків або `map.yaml` із `/content/`. | Індивідуальні `mapTopology` всередині `/content/*.yaml` ігноруються; `getWorldMapSchema()` (рядки 273–280) взагалі повертає статичний заглушковий `getDefaultWorldMap()`. |

---

## 3. Вшитий навчальний контент у коді комбайну (`src/`)

Усі нижченаведені навчальні сюжети, історичні факти, персонажі, формули, параметри вправ та базові предмети знаходяться безпосередньо в коді комбайну, хоча мають походити виключно з `/content/` або імпортованих пакетів:

| Файл | Рядки | Що саме вшито в код |
|---|---|---|
| `src/features/shell/MainHubRouter.tsx` | 43–54 | Постійний банер позапрограмного історичного кейсу Хортиці та модальне вікно `KhortytsiaDefenseEpisodeModal` просто на стартовій сторінці вибору класів (`doors`). |
| `src/components/story/HistorySideQuestsBanner.tsx` | 15–34 | Вшитий опис: *«Оборона Хортиці: Бій з галерами загарбників»*, *«Балістичний рушій: розрахунок кута та потужності фальконета для захисту Січі»*. |
| `src/components/story/KhortytsiaDefenseEpisodeModal.tsx` | 12–13, 30–108 | Повноцінний захардкоджений урок: *«Хортицька засіка Дмитра Вишневецького (1556–1557)»*, облога Девлет-Ґерая, січень/осінь 1557, Чорна Скеля, вбудований запуск гармати з фіксованими повідомленнями. |
| `src/engines/khortytsia-cannon/KhortytsiaCannonEngine.tsx` | 27, 191, 235, 292, 388–489 | Весь інтерфейс балістичного рушія прив'язаний до Хортиці 1557: написи на canvas *«Скелі Хортиці»*, *«💥 1557»*, кнопки *«Залп фальконета!»*, два захардкоджені історичні етапи (*«СІЧЕНЬ 1557 — ПЕРША ПЕРЕМОГА!»*, *«ОСІНЬ 1557 — ВАЖКА ОБЛОГА»*, текст про Дмитра Вишневецького та Девлет-Ґерая). |
| `src/engines/coordinate-plane/CoordinatePlaneEngine.tsx` | 148, 159, 162 | Навчальний сюжет вшитий у рушій: *«Козацька чайка успішно прибула...»*, *«Фарватер Хортиці»*, *«Прокладіть фарватер козацького човна»*. |
| `src/engines/geometry-cannon/GeometryCannonEngine.tsx` *(сирота)* | 131, 165 | Вшитий сюжет *«Оборона Хотина, 1621»*, *«козацький окоп»*. |
| `src/services/contentLoaderService.ts` | 71, 82–87 | Метод `initKhortytsiaCharacters()` щоразу реєструє персонажів: `Отаман Дмитро` (`🧔`), `Джура Тарас` (`👦`), `Сокіл-Орлик` (`🤖`). |
| `src/services/contentLoaderService.ts` | 341–363, 512, 570 | Жорстко прописані предмети «Математика (Основний курс НУШ)» (5 кл.) та «Історія України (5 Клас)», а також спеціальні прапорці `math-05-khortytsia` / `nush_khortytsia_deleted_v1`. |
| `src/services/yamlCurriculumParser.ts` | 244–249 | Fallback-блок діалогу при порожньому пайплайні жорстко підставляє `speaker: 'Бобер Брус'`, `avatar: '🦫'`. |
| `src/core/audio/formant-synth.ts` | 13–14 | Захардкоджені голосові пресети `бобер` та `бобер брус` у системному аудіосинтезаторі. |
| `src/core/ingestion/text-shorthand-parser.ts` | 190 | Вбудована підстановка аватара `🦫` / `🦉` для слів `бобер` / `сова`. |
| `src/core/state/useProfileStore.ts` | 19–21 | Дефолтний профіль містить `avatarId: 'beaver_brus'`, `currentGrade: 5`, `selectedSubjectId: 'math_5'`. |
| `src/components/story/IslandScene.tsx` | 21, 32, 74–76 | Жорстка візуалізація 🦫 + 4-секційного мосту через річку (4 етапи розрахунку) для будь-якого уроку, де заповнено `islandStageName`. |
| `src/features/story-player/QuestPipeline.tsx` | 401–404, 420–421, 482 | Fallback-креслення `'Ширина': '480 см'`, `'Висота': '540 см'`; fallback-ціль для рушія `3425`; жорстко вшита порада в `CopilotBar`: *«Поцікавтеся у дитини, чому вона обрала саме цей спосіб розкладу!»*. |
| `src/components/learning/CatchFormulaMiniGame.tsx` | 55 | Міні-гра жорстко вшита під тему додавання розрядів: *(Десятки ➔ Одиниці ➔ Сума)*. |
| `src/components/learning/HintGate.tsx` & `ModalsContainer.tsx` | `HintGate.tsx:55-68`, `ModalsContainer.tsx:25` | Підказка за замовчуванням *«Помнож десятки й одиниці окремо!»* та вшитий блок *«Запитання з Історії України»* навіть для інших предметів. |
| `src/features/importer/DropZoneModal.tsx` | 28–33, 246, 272–387, 441–463 | 1) Рядок 246: при імпорті будь-якого курсу жорстко ставиться `islandStageName: 'Острів Хортиця'` (тому на сцені завжди з'являється бобер/річка!). 2) У `fullAiSystemPromptSpec` вшиті приклади з Хортицею, 1557 роком, Бобром Брусом та числом `3425`. 3) Список класів/предметів зафіксований на 5–7 класах і 3 категоріях. |
| `src/features/importer/RawTextPasteTab.tsx` | 19–32, 78 | Вбудований зразок `sampleShorthand` та AI-промт містять `1557 рік`, `Бобер Брус`, `3 × 5 колод`, `3425`. |
| `src/components/layout/SubjectHubView.tsx` & `ClassicTopicListView.tsx` & `MainHubRouter.tsx` | `SubjectHubView:49`, `ClassicTopicListView:24`, `MainHubRouter:100` | У хлібних крихтах та заголовках жорстко вписано `🚪 5 Клас` і `5 класу НУШ`, незалежно від реально обраного класу. |
| `src/components/layout/Header.tsx` | 65 | Вшита назва проєкту «Відродження Нації» без конфігурації брендингу/кампанії. |

---

## 4. Мертвий код та файли-сироти (Orphan Files)

Скрипт перевірки графу імпортів виявив **14 файлів у `src/` з 0 посиланнями** в активному додатку (не імпортуються ніде):

| # | Файл | Рядків | Суть проблеми та залишковий вплив |
|---|---|---|---|
| 1 | `src/components/layout/ClassSubjectSelector.tsx` | 201 | **Критичний дубль:** Саме сюди було додано реакцію на перемикач режиму видалення (`nush_delete_mode_enabled` + слухач `nush_storage_change`), але активний UI використовує `BookshelfView.tsx`, через що налаштування з профілю не діють на полицю книг. |
| 2 | `src/components/layout/ChapterMapView.tsx` | 103 | Стара версія мапи розділів; замінена на `WorldMapView.tsx`. |
| 3 | `src/components/layout/YamlImportResolverModal.tsx` | 634 | Старий імпортер із великим обсягом вшитих Хортицьких шаблонів; замінений на `DropZoneModal.tsx`. |
| 4 | `src/components/learning/LessonProgressiveFlow.tsx` | 230 | Старий покроковий плеєр уроку; замінений на `QuestPipeline.tsx`. |
| 5 | `src/components/learning/NotebookPrompt.tsx` | 27 | Невикористаний компонент чорновика. |
| 6 | `src/components/learning/TaskCard.tsx` | 71 | Невикористана картка завдання. |
| 7 | `src/components/story/ResourcePanel.tsx` | 25 | Невикористана панель ресурсів. |
| 8 | `src/core/contracts/blueprint.schema.ts` | 23 | Zod-схема блупрінтів; повністю відірвана від парсера та імпортера. |
| 9 | `src/core/contracts/task.contract.ts` | 34 | Старий контракт завдань. |
| 10 | `src/engines/geometry-cannon/GeometryCannonEngine.tsx` | 242 | Залишковий рушій («Оборона Хотина, 1621»), не зареєстрований в `EngineRegistry`. |
| 11 | `src/hooks/useTaskValidation.ts` | 34 | Залишковий хук валідації. |
| 12 | `src/services/progressService.ts` | 93 | Невикористаний сервіс прогресу. |
| 13 | `src/resources/versionInfo.ts` | 10 | Невикористані метадані версії. |
| 14 | `src/resources/changelog.json` | — | Невикористаний список змін. |

Також у `src/services/yamlCurriculumParser.ts` (рядок 507) експортується клас **`YamlBlueprintParser`**, який має **0 викликів** у коді, а `src/core/storage/content-resolver.ts` (`StorageContentResolver`) також ніким не використовується (замість нього `DialogueCard` імпортує `src/core/ingestion/content-resolver.ts`).

---

## 5. Неробочі механізми та розсинхронізація UI ↔ Код

### 5.1. Двоетапний розкол стану (Dual State Split-Brain)
1. **Прогрес учня роздвоєний між двома незалежними сховищами:**
   - `QuestPipeline.tsx` (рядки 34, 61, 237, 349, 430, 456) записує завершення квестів та XP у Zustand-стор **`useProfileStore`** (`localStorage: edu_student_profile_v1`).
   - `App.tsx`, `MainHubRouter.tsx`, `ModalsContainer.tsx`, `useAppNavigation.ts` читають прогрес (`currentChapterIndex`, `currentTaskIndex`, `completedTaskIds`, `resources`) із хука **`useGameProgress`** (`localStorage: edu_game_progress_v1`), методи якого (`completeCurrentTask`) **ніхто ніколи не викликає**.
   - **Результат:** Проходження уроків у `QuestPipeline` не оновлює лічильник у `ProgressBar`, ресурси (`wood/stone/energy`) у `Header`, етапи мосту в `IslandScene`, поточну мітку 📍 на `WorldMapView` і не розблоковує наступні розділи у `ClassicTopicListView`.

2. **Реактивність налаштувань профілю ↔ Книжкова полиця (`BookshelfView`):**
   - `ProfileModal.tsx` (рядки 50–55, 218–237) записує прапорець `nush_delete_mode_enabled` у `localStorage` та надсилає подію `nush_storage_change`.
   - `BookshelfView.tsx` (який реально рендериться в `MainHubRouter.tsx:60`):
     - **не читає** `nush_delete_mode_enabled` і **не слухає** `nush_storage_change`;
     - **завжди показує** кнопку масового видалення `🧹 Очистити імпортовані (N)` (рядки 82–92), яку просили прибрати;
     - **завжди блокує** видалення `math` та `history` (рядки 30–33, 160–169), хоча кнопка видалення для кастомних курсів там є й без режиму в налаштуваннях.

### 5.2. Непрацюючі контракти інтерактивних рушіїв (Engine Pipeline Bugs)
`QuestPipeline.tsx` і `YamlCurriculumParser.ts` передають в рушії несумісні поля `config`:

| Рушій (`src/engines/*`) | Які ключі `config` очікує компонент | Що передає `YamlCurriculumParser` / `QuestPipeline` | Результат |
|---|---|---|---|
| `balance-physics` (`BalancePhysicsEngine.tsx`) | `targetSum`, `initialTens`, `initialOnes` | `YamlCurriculumParser:168` передає лише `targetNumber`, `targetValue`. `QuestPipeline:418` передає `targetValue`, `targetNumber`. | `config.targetSum === undefined` → `diff = NaN`, терези **ніколи не врівноважаться** для уроків із YAML чи `block_boss_challenge`. |
| `number-line` (`NumberLineEngine.tsx`) | `startNumber`, `addend` | У YAML-парсері обрізаються, залишаються лише `targetNumber`/`targetValue`. | Працюють лише захардкоджені дефолти рушія. |
| `khortytsia-cannon` (`KhortytsiaCannonEngine.tsx`) | `correctAngle`, `correctPower` | У `01-khortytsia-defense.yaml` передаються `targetDistanceMeters`, `windSpeedMs`, `gravity`, `maxAttempts`, `successMessage`, `failureMessage`. | Конфіг із YAML не зчитується (ще й сам блок `interactive_engine` відкидається парсером). |
| `fraction-slicer` (`FractionSlicerEngine.tsx`) | `targetNumerator`, `targetDenominator` | Обрізаються `YamlCurriculumParser:168`. | Ігноруються налаштування дробів з YAML. |
| `protractor-angle` (`ProtractorAngleEngine.tsx`) | `targetAngle`, `toleranceDegrees` | Обрізаються `YamlCurriculumParser:168`. | Ігноруються налаштування кута з YAML. |
| `coordinate-plane` (`CoordinatePlaneEngine.tsx`) | `targetPoint`, `obstacles` | Обрізаються `YamlCurriculumParser:168`. | Ігноруються координати з YAML. |
| `place-value-abacus` (`PlaceValueAbacusEngine.tsx`) | `targetValue` | Працює (`targetValue` передається). | Єдиний рушій, де ключі збігаються. |

### 5.3. Збої імпортера (`DropZoneModal.tsx` & `ArchiveExtractor.ts`)
1. **5 із 7 типів файлів у черзі не імпортуються:**
   Випадаючий список (рядки 712–719) пропонує: `lesson`, `world_map`, `manifest`, `avatar`, `blueprint`, `voice_config`, `media`. Але:
   - `handleImportExecute()` (рядки 190–195) фільтрує лише `fileType === 'lesson'` і бере перший `world_map`.
   - Кнопка `🚀 Додати` рендериться **лише** при `item.fileType === 'lesson'` (рядок 751).
   - Завантажені **`blueprint`**, **`manifest`**, **`avatar`**, **`voice_config`**, **`media`** взагалі ігноруються при натисканні імпорту (`StoredCustomVolume` навіть не має полів для збереження `blueprints` або `avatars`).
2. **Множинний вибір не працює:** У `processFiles` (рядок 72) береться лише `files[0]`, а `<input type="file">` (рядок 622) не має атрибута `multiple`.
3. **Режими `➕ Додати епізод` (`append`) і `🔗 Розширити урок` (`extend_lesson`) ламаються на системних книгах:**
   `ContentLoaderService.registerCustomVolume()` (рядки 441–476) шукає `targetSubjectId` лише в масиві `storedVolumes` (`localStorage`). Оскільки системні `'math'` та `'history'` там відсутні, `volIndex === -1` → код провалюється вниз (рядки 479–500) і **створює нову окрему книгу** замість додавання епізоду чи розширення уроку.
4. **Несинхронізований список предметів при зміні класу в імпортері:**
   Зміна `selectedGrade` (рядок 438) не оновлює `targetSubjectId` та `targetChapterId`; якщо обрати 6 або 7 клас, у селекті `Оберіть книгу` може бути порожній список.

### 5.4. Інші збої UI та навігації
- **`Header.tsx` vs `App.tsx` (рядки `App.tsx:36`, `Header.tsx:30-41, 111`):** `App.tsx` передає у `Header` лише `'game'` або `'selector'`. Через це:
  - кнопка повернення показується навіть на стартовому екрані `'doors'` (`activeView !== 'doors'` завжди `true`);
  - гілки `case 'chapter_map'` і `case 'bookshelf'` у `getNavigationLabel()` є **мертвим кодом** (ніколи не виконуються).
- **Мертва система підказок (`HintGate` / `useHintGate`):** `ModalsContainer.tsx:15, 22-30` рендерить `HintGate`, але жоден компонент у проєкті не викликає `hintGate.openGate()`. У `QuestPipeline.tsx:353, 460` замість відкриття `HintGate` при помилці використовується браузерний `alert(...)`.
- **Невикористаний проп імпорту профілю:** `ModalsContainer.tsx:40` передає `onImportProfile={game.importProfileData}` у `ProfileModal`, а `ProfileModalProps` описує його (рядок 30), але компонент не деструктурує його і **не має кнопки імпорту/експорту профілю**.
- **Розкид блокування розділів (`WorldMapView` vs `ClassicTopicListView`):**
  У `ClassicTopicListView.tsx:39` всі розділи після першого (`idx > currentChapterIndex`) заблоковані кнопкою `🔒 Виконайте попередні` (і через баг `useGameProgress` ніколи не розблокуються), тоді як у `WorldMapView.tsx` усі вузли можна клікнути й відкрити вільно.
- **Текстовий блок у `block_anchor_fact` / `StoryPanel`:**
  - У `StoryPanel.tsx:16-28` тексти, які містять підрядки `"імпортовано"` або `"чернетк"`, примусово замінюються на шаблонну заглушку *«Експедиційна програма вивчення...»*.
  - У `QuestPipeline.tsx:136, 140-143` заголовок `currentStep.headline` дублюється двічі підряд у шапці й `<h3>`; а при імпорті уроків з `blocks:` і типом `fact`, де замість `contentSummary` було лише поле `text` без мапінгу чи з обривом на `hints:`, в `YamlCurriculumParser` регулярний вираз `pipeReg` / `inlineReg` може обрізати або не зчитати багаторядковий чи вкладений контент.

---

## 6. Матриця інтерактивних елементів: Візуальні кнопки/панелі ↔ Логіка в коді

| Екран / Модал | Елемент UI (Кнопка / Панель / Поле) | Файл і рядок | Статус | Коментар |
|---|---|---|---|---|
| **Header** | Логотип «Відродження Нації» + кнопка «До класів/карти» | `Header.tsx:59, 111-120` | ⚠️ З багом | Через `App.tsx:36` (`'selector'`) кнопка навігації видно навіть на головному екрані `'doors'`, а підписи `'bookshelf'`/`'chapter_map'` недосяжні. |
| **Header** | Перемикач теми (`☀️ Фокус / 🌙 Затишок / 📄 Папір`) | `Header.tsx:81-89` | ✅ Працює | Перемикає `data-theme`, змінні є у `variables.css`. |
| **Header** | Кнопки `🎵 Музика` та `🔔 Звук` | `Header.tsx:91-109` | ✅ Працює | Керують `useAudioEngine`. |
| **Header** | Бейджі ресурсів (`🪵`, `🪨`, `⚡`) | `Header.tsx:70-76` | ❌ Заглушка / Не оновл. | Читають `useGameProgress`, який не оновлюється з `QuestPipeline`. |
| **Header** | Кнопка `👤 Профіль` | `Header.tsx:122-129` | ✅ Працює | Відкриває `ProfileModal`. |
| **Doors (`doors`)** | Картки класів у «Двері Класу (5–11)» | `ClassDoorsHall.tsx:38-70` | ⚠️ Частково | Заголовок обіцяє **5–11 класи**, але рендеряться лише **2 двері (5 та 6)**. |
| **Doors (`doors`)** | Банер Хортиці + кнопка `▶ Дослідити` | `MainHubRouter.tsx:44-54`, `HistorySideQuestsBanner.tsx:36-43` | ⚠️ Порушення арх. | Працює, але є вшитим навчальним контентом поза `/content/`. |
| **Bookshelf (`bookshelf`)** | Кнопка `🧹 Очистити імпортовані (N)` | `BookshelfView.tsx:82-92` | ⚠️ Небажана опція | Залишилася в UI всупереч вимозі прибрати масове очищення. Використовує `window.confirm`. |
| **Bookshelf (`bookshelf`)** | Кнопка `🗑️` на картці предмета | `BookshelfView.tsx:160-169` | ⚠️ Розсинхрон | Видима завжди для кастомних книг і прихована для `math`/`history`, повністю ігнорує перемикач режиму видалення з `ProfileModal` (бо слухач залишився в мертвому `ClassSubjectSelector.tsx`). |
| **Bookshelf (`bookshelf`)** | Кнопка `➕ Додати нову книгу (YAML)` | `BookshelfView.tsx:93-97` | ✅ Працює | Відкриває `DropZoneModal`. |
| **SubjectHub (`subject_hub`)** | Перемикач `🗺️ Мапа` / `📋 Теми` | `SubjectHubView.tsx:56-77` | ✅ Працює | Перемикає `WorldMapView` та `ClassicTopicListView`. |
| **SubjectHub (`subject_hub`)** | Хлібні крихти `🚪 5 Клас ➔ ...` | `SubjectHubView.tsx:49`, `MainHubRouter.tsx:100` | ⚠️ З багом | Жорстко показує `5 Клас` навіть для 6 класу. |
| **WorldMapView** | Кнопка `🔍 Розгорнути / Згорнути мапу` | `WorldMapView.tsx:58-65` | ✅ Працює | Змінює висоту мапи (`280px` ↔ `500px`). |
| **WorldMapView** | Вузли мапи + SVG-лінії + мітка `📍` | `WorldMapView.tsx:74-159` | ⚠️ З багом | 1) Не враховує розмір контейнера при координатному зсуві. 2) Поточна позиція `📍` читає `currentChapterIndex` із непрацюючого `useGameProgress`. 3) Для `/content/` бере авто-сітку замість `mapTopology` (бо `initCache` її не зберігає). |
| **ClassicTopicListView** | Кнопки `📖 Повний урок` / `🎯 Тільки вправи` / `🔒 Виконайте попередні` | `ClassicTopicListView.tsx:90-115` | ❌ Зламано | Усі розділи з `idx > 0` назавжди заблоковані (`idx <= currentChapterIndex`), оскільки `currentChapterIndex` ніде не збільшується. `🎯 Тільки вправи` мовчки повертає всі кроки, якщо в уроці немає вправ. |
| **Game (`game`)** | `ProgressBar` та `IslandScene` | `MainHubRouter.tsx:105-121` | ❌ Зламано | Прогрес прив'язаний до `useGameProgress` (завжди `0 / 4`). `IslandScene` рендериться примусово через fallback `islandStageName`. |
| **Game (`game`)** | `QuestPipeline`: перехід по кроках (кружечки-індикатори) | `QuestPipeline.tsx:94-112` | ✅ Працює | Дозволяє перемикатися між етапами. |
| **Game (`game`)** | `QuestPipeline`: `block_recognition_quiz` | `QuestPipeline.tsx:247-308` | ✅ Працює | Перевіряє вибір, програє звук, дає перейти далі. |
| **Game (`game`)** | `QuestPipeline`: `block_notebook_task` і `block_boss_challenge` | `QuestPipeline.tsx:312-469` | ⚠️ З багом | 1) Замість `HintGate` при помилці викликається заборонений в iFrame `window.alert()`. 2) Підмішує fallback-креслення `480×540` і ціль `3425`. 3) У рушії `balance-physics` не передається `targetSum`. |
| **Game (`game`)** | `CopilotBar` (порадник знизу) | `QuestPipeline.tsx:482` | ⚠️ Заглушка | Показує один і той самий захардкоджений текст для всіх предметів і завдань. |
| **ProfileModal** | Вкладки `Огляд`, `Радар`, `Щоденник`, `Керування курсами` | `ProfileModal.tsx:110-158` | ⚠️ З багом | Огляд показує ресурси з `useGameProgress` (не оновл.), а Радар/Щоденник читають із `game.profile`, де взагалі **відсутні поля `traits` і `journal`** (`ModalsContainer.tsx:35-38` передає `...game.profile` і лише `studentName` з `useProfileStore`! Тому Радар і Щоденник завжди порожні/дефолтні!). |
| **ProfileModal** | Перемикач `🛠️ Режим керування імпортованим контентом` | `ProfileModal.tsx:218-237` | ❌ Не працює для Bookshelf | Оновлює `localStorage`, але `BookshelfView` його не читає (читає лише мертвий `ClassSubjectSelector`). |
| **ProfileModal** | Кнопка `🗑️ Видалити` у списку імпортованих курсів | `ProfileModal.tsx:263-270` | ⚠️ З багом | Видаляє з `localStorage` (з `window.confirm`), але `BookshelfView` не підписаний на `nush_storage_change`, тож полиця не оновлюється до перезавантаження/переходу. |
| **ProfileModal** | Імпорт профілю (`onImportProfile`) | `ProfileModal.tsx:30`, `ModalsContainer.tsx:40` | ❌ Відсутній UI | Проп передається, але кнопки чи форми імпорту в `ProfileModal` немає. |
| **DropZoneModal** | Вибір файлу / Drag & Drop | `DropZoneModal.tsx:612-642` | ⚠️ З багом | Обробляє лише 1-й файл (`files[0]`). Вкладена `<Button>` усередині `div` з `onClick` дає подвійне спрацювання вибору файлу. |
| **DropZoneModal** | Дропдаун типів файлу (7 типів, вкл. `blueprint`, `avatar`, `manifest`, `voice_config`, `media`) | `DropZoneModal.tsx:706-719` | ❌ 5/7 ігноруються | Імпортуються лише `lesson` і частково `world_map`. Усі інші типи в черзі неможливо додати окремо і вони ігноруються кнопкою масового імпорту. |
| **DropZoneModal** | Режими `Додати епізод` / `Розширити урок` | `DropZoneModal.tsx:510-578` | ❌ Не працює для системних | Для системних книг (`math`, `history`) замість додавання/розширення створюється нова дубльована книга. |
| **DropZoneModal** | Цільовий клас `7 Клас` | `DropZoneModal.tsx:443` | ❌ Веде в нікуди | Курси, імпортовані в `grade_7`, зберігаються, але ніколи не відображаються у `ClassDoorsHall`. |
| **HintGate** | Модал підказки (`HintGate`) | `ModalsContainer.tsx:22-30` | ❌ Повністю мертвий | Жодна кнопка у всьому UI не викликає `openGate()`. |

> **Додаткова критична знахідка по `ProfileModal` (`ModalsContainer.tsx:35-38`):**
> Оскільки `ModalsContainer` передає в `ProfileModal` об'єкт `{ ...game.profile, studentName: profile.studentName }`, а `game.profile` (тип `LegacyGameProfile`) **не має** властивостей `traits` та `journal`, які зберігаються в `useProfileStore` (`profile.traits`, `profile.journal`), вкладки **«📊 Радар»** і **«📖 Щоденник»** у профілі **ніколи не відображають реальних балів і записів учня**!

---

## 7. Рекомендована послідовність усунення порушень

1. **Уніфікація сховища стану (Прибрати Split-Brain):**
   - Злити `useGameProgress` та `useProfileStore` в єдиний стор (або переключити `App`, `MainHubRouter`, `ModalsContainer`, `Header`, `ProgressBar`, `WorldMapView`, `ClassicTopicListView` повністю на `useProfileStore` + `useSessionStore`).
   - Видалити 14 мертвих файлів-сиріт (у т.ч. `ClassSubjectSelector.tsx`, `YamlImportResolverModal.tsx`, `GeometryCannonEngine.tsx`, тощо), попередньо перенісши потрібну логіку (наприклад, слухач `nush_delete_mode_enabled` → у `BookshelfView.tsx`).
2. **Винесення всього навчального контенту з `src/` у `/content/`:**
   - Прибрати з `MainHubRouter` постійний банер `HistorySideQuestsBanner` та `KhortytsiaDefenseEpisodeModal` — історичний епізод уже перенесений у `/content/grades/grade-05/subjects/history/chapters/01-khortytsia-defense.yaml`.
   - Очистити `KhortytsiaCannonEngine`, `CoordinatePlaneEngine`, `IslandScene`, `QuestPipeline`, `DropZoneModal`, `RawTextPasteTab`, `YamlCurriculumParser`, `ContentLoaderService`, `formant-synth.ts` від вшитих сюжетів Хортиці, Бобра Бруса, 1557, 3425, 480×540 та підказок.
   - Повністю замінити жорстко задані `mathSubject`, `historySubject` та фіксований масив `[grade5, grade6Preview]` у `ContentLoaderService.getGrades()` на динамічне сканування структури `/content/grades/<grade>/subjects/<subject>/` (підтримуючи 5–11 класи та `subject.yaml` / `map.yaml`).
3. **Виправлення парсерів YAML, Блупрінтів та Мап:**
   - Узгодити схему YAML у `/content/` та `YamlCurriculumParser`: підтримати `blocks:`, `type: fact`, `type: interactive_engine`, `type: blueprint_task`, `engineConfig:`, `hints:`, `mapTopology:`.
   - Виключити `**/blueprints/*.yaml` зі списку уроків у `ContentLoaderService.initCache()`, завантажувати їх через `YamlBlueprintParser` + `BlueprintSchema` із прив'язкою до папки предмета (`grade/subject/blueprints/`), і підтягувати за `blueprintId` усередині `QuestPipeline`.
   - Уніфікувати `config` для всіх 7 рушіїв у `EngineRegistry` (особливо `targetSum` vs `targetValue` / `targetNumber`, `engineConfig` передача без обрізання полів).
4. **Відновлення паритету UI ↔ Код:**
   - Підключити `BookshelfView.tsx` до `nush_delete_mode_enabled` + `nush_storage_change` (та прибрати кнопку масового очищення).
   - Полагодити `Header` (передавати реальний `activeView` з `useSessionStore`), `SubjectHubView` (динамічна назва класу), `ProfileModal` (передавати `traits`/`journal` з `useProfileStore`, або прибрати/реалізувати `onImportProfile`), `HintGate` (підключити кнопку виклику підказки замість `window.alert`).
   - Доробити в `DropZoneModal` імпорт `blueprint`, `manifest`, `avatar`, `voice_config`, `media`, множинне завантаження файлів, прибрати хардкод `islandStageName: 'Острів Хортиця'`, та дозволити `append`/`extend_lesson` на базові предмети.
