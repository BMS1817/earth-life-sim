# Earth — полный визуальный ребрендинг до 100%

Статус: **production, публикация и post-rebrand профилирование завершены**.
Обновлено: 2026-11-24.

Этот файл обновляется после каждого завершённого этапа: отметка, дата, ссылка на доказательство,
что осталось и новые блокеры. Процент не считается по числу скачанных ZIP: один маленький пакет может
закрыть систему, а большой архив — не покрыть нужные состояния.

## Границы 100%

**Согласовано:** все используемые визуальные состояния игры имеют согласованную замену,
не смешанную с прежним артом; работают RU/EN, desktop/mobile и все выпускаемые пакеты. Не обязательно
сохранять прежнее число файлов или девять отдельных рисунков, если возрастная игра сохраняется
согласованной системой вариантов. Модульные варианты и перекраска разрешены. **Cabbit — целевое
направление людей.** Production и публикация — только после отдельных одобрений.

Визуальный объём: 2D front/side без изометрии; герой/NPC/портреты, среда, дома, предметы, мемориал,
конфликт, карьера/хобби и UI. **Аудио входит в 100%:** музыка и choice/year/inherit должны получить
согласованную бесплатную замену и пройти прослушивание. Страновые флаги и Press Start 2P сохраняются.
Факты/баланс/сейвы не меняются.

## Исходный объём production

- 208 PNG; 9 возрастов: infant, early, child, teen, young, adult, mature, senior, elder.
- 6 внешностей, оба пола, 3 силуэта, 6 тонов кожи; 7 профессий с одеждой/props.
- 3 климата × 3 слоя фона; 3 климата × 3 достатка × обычный/повреждённый дом = 18 домов.
- Портреты/альбом/комнаты трёх климатов, dream/gifted-day, 7 thematic headers и 4 textures.
- Питомцы, велосипед/машина/компьютер/бизнес, хобби, эвакуация, солдат/техника/дым/обломки.
- UI 62 экрана, RU/EN, PC/mobile; offline HTML, Windows WebView2, Android/PWA.

## Этапы

### 0. Правила, каталог и направления — выполнено
- [x] Полный 2D front/side ребрендинг без изометрии; допустимы CC0/CC BY/custom freebie.
- [x] Один пилот; один пакет на одно подтверждение; production не меняется без нового решения.
- [x] Shortlist и отклонённые top-down/isometric/неподходящие варианты — `docs/decisions.md`.

### 1. Основная линия людей — выполнено
- [x] Cabbit Extended: 2342155 байт, CC BY 3.0/OGA-BY 3.0, 110 PNG.
- [x] Дети/взрослые/старики, портреты, walk-циклы и light/dark recolors проверены глазами.
- [x] Доказательства: `.tools/asset-downloads/cabbit-24x32-extended/contact-people.png`,
  `walk-preview.gif`; внутренний credit и SHA-256 сохранены.
- [x] Закрыто: 9 возрастов, профессии, все силуэты/тона/выражения и production-варианты.

### 2. Разнообразие людей — выполнено
- [x] Black Character Pack: 266966 байт, 18 листов 153×128, CC BY 3.0/OGA-BY 3.0; CRC/credit зелёные.
- [x] Дети, взрослые, старики, аристократы и герои с afro-textured hair осмотрены:
  `.tools/asset-downloads/cabbit-black-characters/contact-people.png`; SHA-256 —
  `a9e6ea742d6d55a0a5eeb7e0bef1178e4e2ab44c021506eaf173b6c1b13d0ea0`.
- [x] Согласовать и проверить CC0 bases для типов тел/дополнительных тонов и профессиональной одежды.
- [x] Найти совместимые profession sprites вместо прямого отображения всех карьер на fantasy classes.
  - `Handymen` подтверждён как кандидат на industry/agriculture: 91836 байт, 24×32/48×64,
    idle/walk, CC BY 3.0/OGA-BY 3.0; остальные 5 профессий он не покрывает.
  - `Cabbit Collection` полезен прозрачными модульными листами, но остаётся WIP и требует аудита
    отдельной атрибуции; первым profession-пакетом не выбран.
  - Для типов тел выбран новый `Human Bases (Cabbit Rework)`: CC0, 522679 байт, 24×32/48×64,
    несколько типов тел, N/S/E/W и S/W/E/N, idle/walk. База для outfits/recolors, не готовые лица.
  - `Human Bases (Cabbit Rework)` скачан: SHA-256 `00107a5feb6af66846c285a21bebca925fe30f1091760036d867a9e696b2e8e9`.
    81 прозрачный PNG: 8 типов тел + модульные torso/arms/child/elder/sit/ride. Осмотрены
    `contact-bodies.png` и `recolor-preview.png`: все 6 тонов Earth через существующий алгоритм.
    Bases завершены; profession outfits и отдельные портреты Handymen остаются открытыми.
  - Готовых точных medicine/education/services/pilot в том же стиле пока не найдено; позже
    согласовать модульные props/outfits вместо подмены профессий fantasy-классами.
  - Модульные props: `Stethoscope` (Delapouite, CC BY 3.0, 7157 байт), `Graduate cap`
    (Delapouite, CC BY 3.0, 4837 байт) и `Airplane` (Skoll, CC BY 3.0, 3248 байт).
    Они предлагаются для Cabbit body+portrait, а не как замена базовых людей.
  - `Stethoscope` скачан: SHA-256 `6183d1b6b910e6a1f1bf8cf5b8abe465df76bd98d12760c4af18b27c5cc09689`.
    Создан `stethoscope-32.png` с бинарной alpha в зелёном Earth и осмотрен `medicine-preview.png`.
    Следующий prop — Graduate cap для education.
  - `Graduate cap` скачан: SHA-256 `debce1c54c65ea22eb1e8eaec8de3cf221b0d5765b10938088ee537d23f12466`.
    Создана бинарная синяя иконка 32×32 и осмотрен `education-preview.png`. Следующий prop — Airplane.
  - `Stendhal confectioners` подтверждён для services: Jastiv/Lori Angela Nagel, CC BY 3.0/4.0.
    Выбран `confectionercherrypienpc.png` 3044 байта. Scientist отклонён GPL 2.0, Starship Pilot —
    CC BY-SA 3.0/GPL 3.0 и painted style, Teacher не имеет явной лицензии.
  - Все 7 профессий закрыты на уровне пилота: Handymen для engineering/industry/agriculture,
    Confectioner для services, stethoscope/graduate cap/airplane для medicine/education/pilot.
    `career-matrix.png` осмотрен. Остаются 9 возрастов и production-варианты/integration.
  - Следующий фронт — питомцы, транспорт, lifestyle props и конфликт.
  - `CatnDog.zip` проверен: pzUH/GameArt2D, CC0, 9685855 байт, cat/dog side-view по 8
    анимационных состояний. `tank_right_strip3.png` (2D Tyrant, CC0, 3974 байта) — для war vehicle.
  - Пользователь отклонил Cat & Dog и запросил других питомцев. Альтернативы: German Shepherd
    (CC0, 70748 байт, x1/x2/x3, walk/run/bark), Dog/Wolf 16×16 (CC0, 1145 байт) и Pixel cat
    (CC0, 2111 байт, без анимации). Первая карточка — German Shepherd.
  - German Shepherd скачан: 61 ZIP-запись, SHA-256 `f1d0e3badad9332c73e5b616266aa153c5c78041c1f9cecb55c99206c90cd0ae`.
    CRC, безопасные пути и отсутствие symlinks проверены. Осмотрены `contact-animations.png`,
    `walk-preview.gif` и `run-preview.gif`: 6 кадров walk, 5 run, 3 bark, side-view 29×18.
    Для production нужны eye/palette recolor и проверка масштаба рядом с Cabbit; кошка и транспорт ещё не закрыты.
  - Статичный Pixel cat отклонён пользователем и не скачан. Новый кандидат — `Cat sprites` того же
    Shepardskin: CC0, 19170 байт, side-view, оригинальные спрайты и walk/run GIF в x2/x4.
  - Cat sprites скачан: 8 ZIP-записей, SHA-256 `370fcc5c7c6f6a4388fdde08892b30b126de83518a1a4f94f9282b00b1e28376`.
    CRC/пути/symlinks зелёные; walk/run по 6 кадров, 100/200 мс, плюс 16 статичных поз.
    Осмотрены `contact-sprites.png`, `contact-animations.png`, `walk-preview.gif`, `run-preview.gif`.
    Розовый RGB(164,117,160) удалён только в preview; palette/eye recolor остаётся production-этапом.
  - Единая object-стилистика утверждена гриллом: Cabbit+Kyrise, модуль 16 px, Earth+локальные
    рампы 4–6 тонов, умеренная адаптация. Brief: `assets/art-direction-brief.md`, manifest:
    `assets/asset-manifest.json`. Первый эталон — car 64×40 + отдельная memorial icon 32×32.
    War — эвакуация/последствия с крытым грузовиком, без танка как центрального образа и новой жестокости.
  - Танк 2D Tyrant отклонён по стилю и не скачан. Gop go go скачан и осмотрен, но side-view
    sedans 95–119 px не проходят согласованный предел 64 px; дробный resize запрещён, пакет только референс.
  - `Small city cars` скачан: PixelShack, CC BY 4.0, 5990 байт, SHA-256
    `5ffb58eb095e30f355415155952231c9958a65ee0aff0d2f744aac3e92e70b15`. Выбран blue side 47×20,
    удалены только соседние disconnected pixels и выполнен точный RGB recolor. Scene 64×40 и ручная
    memorial icon 32×32 собраны без дробного ресайза; 13/11 цветов, binary alpha, asset reports зелёные.
    `car-village-preview.png` и `car-memorial-preview.png` осмотрены native/×4/×8; опора исправлена
    после первого монтажа. Атрибуция сохранена. Пользователь одобрил icon 32×32, но отклонил исходную
    scene-машину по 3/4-стилистике. Собрана v2 из одобренной icon-формы в 64×40 без resize:
    `car-village-preview-v2.png`, 11 цветов, report зелёный. Пользователь принял форму, но запросил
    увеличение. Вместо дробного ×1,5 создана ручная native 48×32 scene v3 в кадре 64×40;
    `car-village-preview-v3.png` сохраняет общий ×2 с Cabbit, 11 цветов, report зелёный.
    Пользователь утвердил v3 как единый object-эталон; следующий объект — крытый грузовик эвакуации.
  - Готовые truck-пакеты не прошли gate: isaiah658/Kenney top-down, knik1985 более крупный 3/4,
    A truck открытый и слишком простой, Box truck без ясной карточки лицензии. Собран project-authored
    `war-truck-64.png` в утверждённой стилистике: strict-side, 11 цветов, binary alpha, без оружия.
    `war-truck-village-preview.png` и сравнение с car осмотрены, опора выровнена. Пользователь одобрил.
  - `pH64_electronics_OGA_alpha.png` скачан: PurpleHeart / Stacy Kendra Love, CC BY 4.0, 18538 байт,
    SHA-256 `aa0bdab547120bb1c36b82ae0c9da6d5e5762a385cc80ef8d150b09d37e4fa92`.
    Собран `computer-32.png` из native monitor 17×13, tower 8×14 и ручной keyboard 25×4 без ресайза;
    точный recolor и спокойный экран. 11 цветов, binary alpha, report зелёный. Memorial preview
    рядом с Kyrise осмотрен native/×4/×8. Атрибуция сохранена; пользователь одобрил.
  - Для bicycle не найден подходящий native pixel side-view: мотоциклы/3D/vector исключены. Собраны
    project-authored `bicycle-scene-48.png` (48×32) и `bicycle-icon-32.png`: 6 цветов, binary alpha,
    reports зелёные. `bicycle-village-preview.png`, `bicycle-memorial-preview.png` и reference sheet
    осмотрены; опора выровнена. Пользователь одобрил обе версии.
  - Современного готового soldier Cabbit не найдено. Из уже проверенного Fighter-M-01 собран
    `war-soldier-24.png`: strict-side, холодная форма, шлем выше глаз, без оружия. 34 цвета,
    binary alpha, report зелёный. Три кадра walk, `war-soldier-truck-preview.png` и reference sheet
    осмотрены; перекрытие с гражданским исправлено. Атрибуция Cabbit сохранена; пользователь одобрил.
  - `Smoke & Fire.png` скачан: KnoblePersona, CC BY 3.0, 1450 байт, SHA-256
    `b8c57a8774149004696efbdbd079d00c1b4afaeefaa3a4d55347ec4d5b7824f2`. Только upper smoke,
    fire исключён. `war-smoke-48.png`: native parts, cool-gray recolor, 6 цветов, report зелёный;
    четыре кадра GIF. Project-authored `war-debris-48.png`: 6 цветов, report зелёный.
    `war-aftermath-preview.png` с smoke/debris/truck/soldier осмотрен, plume привязан к обломкам.
    Пользователь одобрил smoke/debris.
  - Все 6 hobby icons собраны в 32×32: project-authored games controller; native pH64 exercise machine,
    speaker и sewing machine; Kyrise open book и fish. Reports зелёные (5–14 цветов, binary alpha).
    `hobby-reference-matrix.png` и `hobby-memorial-preview.png` осмотрены. При аудите исправлено
    происхождение computer keyboard: она project-drawn, не верхняя панель arcade; вид одобренной
    иконки сохранён, report 11 цветов. Hobby-набор одобрен, первая расстановка отклонена.
    В `hobby-memorial-preview-v5.png`: sports и speaker на полу, games поднят по просьбе
    пользователя ещё на 3 px (опора y=97), reading/crafts/nature на остальных полках. Набор закрыт.
  - Все 7 оставшихся object icons собраны в 32×32: home/rental(+Kyrise key), business, career,
    partner, Cabbit child и small pet. 3–30 цветов, binary alpha, reports зелёные.
    `remaining-objects-reference.png` и `remaining-objects-memorial-preview-v2.png` осмотрены.
    По замечанию пользователя rental/partner сдвинуты на 4 px влево к центру правых полок.
    Это закрывает 18 production object names на уровне preview; расстановка одобрена.
  - Добавлены native `object-dog-32.png` и `object-cat-32.png` (8/5 цветов, reports зелёные).
    Собрана `full-object-matrix.png`: все 18 иконок 32×32 на одном листе ×4. Пользователь одобрил
    полную матрицу и pet icons. Следующий этап — полная матрица 9 возрастов.
  - `age-matrix.png` собран: 9 стадий в native 24×32, strict-side и silhouette row. Infant project-authored,
    early/child/teen имеют native row deletion в ногах, не scaling; mature gray pixels, elder cane.
    Все 5–28 цветов, binary alpha, reports зелёные; bottom pivot 31 у всех. Два визуальных прохода:
    исправлены pivot early/teen и рост child/teen. Пользователь одобрил 9 возрастов.
  - `house-matrix.png` собран: все 18 домов native 96×80, project-authored. 10–11 цветов,
    binary alpha, reports зелёные. Достаток меняет геометрию, damaged добавляет roof hole/crack/
    boarded window/rubble без огня. `house-temperate-scene-preview.png` на Village layers 1–3
    осмотрен с Cabbit: задняя опора дома корректна. Пользователь одобрил 18 домов.
  - `interior-matrix.png` собран: north/temperate/tropics 128×96 RGB, 8–9 цветов, reports зелёные.
    `interior-temperate-objects-preview.png` показывает ×2 до 256×192: controller на полке,
    sports/speaker на полу, reading/crafts/nature на остальных полках. Пользователь одобрил.
  - Следующий этап — полный изолированный игровой preview и воспроизводимый asset pipeline.
  - `Handymen` скачан: 91836 байт, SHA-256 `bf935d21bcbfc18ff93912829a589a4fd7f314b8269a82cd8068941cec60ec7e`.
    Проверены blacksmith, goldsmith, ringsmith, woodcutter и T в 24×32/48×64, alpha 0/255,
    CC BY/OGA-BY кредиты. Preview: `contact-professions.png`, `walk-woodcutter.gif`.
    Портретов в пакете нет; они остаются отдельным пробелом.
  - Дома/интерьеры: `Old Frogatto Houses` (CC0, 30746 байт) подтверждён front-view, но не имеет
    климатов/damaged. `Home Objects 1 Revised_1.png` (CC0, 6103 байта, 32×32 transparent)
    подходит мебели мемориала. Stone Home Exterior отклонён из-за CC BY-SA.
  - `Old Frogatto Houses` скачан: 30746 байт, 2 PNG, SHA-256
    `92cdee11b043c2ded66b201785c8f90171e0744cf282bbab9c9c27adea76cf68`. Осмотрены `house.png`
    (857×370) и `frogatto-house.png` (296×192): front-view дома и старейшина, CC0. Фон RGB, для
    production потребуется color-key; климатов/damaged нет, поэтому 18 домов не закрываются.
  - `Home Objects 1 Revised_1.png` скачан: 6103 байт, SHA-256
    `e1ba391f0dfac8b5ebd085a901826ee3da570373f7da9150aa5f0e77003b5272`. Pillow: 192×192 RGBA,
    alpha 0/255; мебель осмотрена в `preview.png`. Стены/интерьер остаются отдельной задачей.
  - Следующий фронт — климатические фоны той же серии 576×324: зима, природа и город.
  - Проверены: Winter Pixel Art Background With Mountain (OGA-BY 3.0, 497527 байт) и
    Simple Seamless City Pixel Art Background (OGA-BY 3.0, 1147930 байт). Winter предложен первым;
    City идёт следующей отдельной карточкой. Green Meadow/Retro Mountain остаются альтернативами.
  - Winter скачан: 497527 байт, 20 записей, SHA-256
    `be2389ca7581c0fc68680dc3b0a4bd27780db0c663afae3141d0c7e0eb72408d`. Найден точный порядок
    Plan 1–5 → background 1: MAE 0,0 с `Preview 1.png`. Осмотрены `pilot-winter.png` и
    `pilot-winter-ui.png`; атрибуция сохранена. City — следующий фон размером 1147930 байт.
  - City скачан: 1147930 байт, SHA-256 `78ad2e6a45f3f70410bfae63cce3082f02f41af7b702e459ced8edb7468f7779`.
    Порядок BG/1 → BG/6 совпал с BG/7 при MAE 0,0. Осмотрены `pilot-city.png` и `pilot-city-ui.png`.
  - Следующий сухой фон: `Desert Clean.png` от Cethiel, CC0, tileable без песчаной бури;
    визуальная совместимость проверяется при монтаже с Cabbit.
  - Desert Clean скачан: 656303 байт, SHA-256 `acc2a398484b2f040813824fb918ca3518bbdcdd22150416f56c68d221dd371d`.
    Источник 1280×640, left/right MAE 0,0. В пилот взят центральный фрагмент 576×324 без
    масштабирования фона; `pilot-desert.png` и `pilot-desert-ui.png` осмотрены. Есть 3 климатических
    направления, но 18 домов, интерьеры и повреждённые состояния ещё не закрыты.
  - `WoodenHouse-Pixel_2.zip` проверен: ChrisTutorials, CC BY 4.0, 32175 байт, два варианта дома
    214×154 и отдельная дверь 32×64. `House Sets` отклонён из-за более top-down проекции.
  - `WoodenHouse-Pixel_2.zip` скачан: SHA-256 `7e07653350645765486d41b026c3af35a5d3f68548832678414bc6722d74c4f4`.
    `House.png` и `House_WithoutDoor.png` имеют 214×182 с тенью, дверь 192×64 содержит 6 кадров.
    Осмотрены дом и `door-animation.gif`; alpha 0/255. 18 домов и damaged-варианты ещё не закрыты.
  - Следующий независимый фронт — аудиоребрендинг: найти спокойную Cabbit/Village музыку и 3 SFX,
    не боевые звуки; визуальные пробелы остаются в плане.
  - Музыкальный стиль — **пасторальный ambient/chiptune или лёгкая акустика**, медленно и без
    выраженного ритма/драматических вступлений. Чистый заметный chiptune и оркестровый cinematic отклонены.
  - Пользователь выбрал **расширенный UI-звук**, а не только 3 сигнала. Предлагаемый лимит — 8 событий:
    choice/year/inherit, кнопка, menu open/close, favorite, error, death. Hover и движение ползунков
    не озвучиваются; отдельные настройки/громкость сохраняются.
  - Лимит расширения подтверждён пользователем: **ровно 8 событий**, не 12 и не все UI-действия.
    Музыка остаётся пасторальной, поиск идёт через game-asset-catalog.
  - При проверке списка обнаружена ошибка счёта menu open/close. Окончательное решение: **8 событий**
    с одним общим `menu` transition для открытия и закрытия: choice, year, inherit, button, menu,
    favorite, error, death. Разные open/close эффекты не вводятся.
  - Музыкальные кандидаты: Peaceful Village (Jon K. Fite, CC BY 3.0, 7424640 байт) — основной
    16-bit вариант; Another August (CC0, 8269313 байт) — ambient-альтернатива; A New Town
    (CC0, 766291 байт) — harp jingle для наследия. Cozy SFX Sampler вернул Access denied и исключён.
  - Peaceful Village скачан: SHA-256 `ca5d5f7dbac84c514471c1235dd83e29a9d9c47d26fbb4bc991ac4c6c14be60a`.
    Исходник 185,55 с, −15,3 LUFS, peak −0,3 dBFS. Preview 72 с с отметки 81 с: −20,3 LUFS,
    true peak −5,5 dBFS, короткие огибающие 250 мс. Он открыт для прослушивания, production не меняется.
  - Kenney Interface Sounds скачан: 834536 байт, 100 OGG, SHA-256
    `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`. Внутренняя CC0 подтверждена.
    Выбраны основной и альтернативный кандидат на каждое из 8 событий; после ослабления −2,5 дБ
    все true peak ≤ −1,7 dBFS. Preview: `.tools/asset-audio/interface-sounds/listen.html`.
  - Следующий gate: пользователь прослушивает музыку и кандидатов SFX и выбирает варианты. До этого
    замены в production нет; затем возобновляются визуальные этапы и интеграционный preview.
  - Пользователь продолжил с рекомендованными вариантами: Peaceful Village и первые кандидаты на
    choice/year/inherit/button/menu/favorite/error/death. Они выбраны для интеграционного preview,
    но окончательная оценка после прослушивания не заявляется завершённой. Следующий фронт — типы тел,
    оставшиеся профессии и одежда.
### 3. Пилот окружения — выполнено
- [x] Village Landscape: 494537 байт, OGA-BY 3.0; четыре отдельных слоя 576×324.
- [x] Собраны и осмотрены `pilot-scene.png` и `pilot-scene-ui.png`; опора персонажей исправлена.
- [x] UI в пилоте — производные Kenney Pixel Adventure CC0; атрибуция сохранена.
- [x] Закрыто: остальные климаты, достаток/повреждения, города и производственные размеры.

### 4. Предметы и иконки — выполнено
- [x] Kyrise V1.2: 724218 байт, CC BY 4.0, 904 PNG; лицензия подтверждена.
- [x] 20 life/memory items отобраны; alpha бинарная; `contact-selected.png` осмотрен.
- [x] Закрыто: современные вещи, профессии, питомцы, транспорт и полный memorial-набор.

### 5. Статичные позы мемориала — выполнено
- [x] Cabbit Lying Down: 29786 байт, CC BY 3.0/OGA-BY 3.0; PNG 192×192 проверен Pillow.
- [x] 48 поз осмотрены; обнажённые базы исключены из игрового отбора.
- [x] Закрыто: интерьер, альбом, dream/gifted-day и привязка поз к каждому герою/поколению.

### 6. Полная матрица людей — выполнено
- [x] Для каждого возраста/пола/силуэта/тона определить готовый спрайт или воспроизводимую модификацию.
- [x] Семь профессий × взрослые возрастные стадии; одежда, props, портрет и memory scene.
- [x] Idle/happy/sad, walk, реакции и стабильный pivot; GIF не менее 3 циклов.
- [x] Портреты родни/поколений и восстановление внешности после reload по прежнему seed.

### 7. Полная матрица среды — выполнено
- [x] Север/умеренный/тропики: sky/far/near, сезонные деревья и корректные края parallax.
- [x] 18 домов: 3 климата × 3 достатка × обычный/damaged; одинаковый масштаб и опора.
- [x] Город/политика, портретные фоны и интерьеры трёх климатов.
- [x] Проверить native 1× и целые ×2/×3/×4 без дробного масштабирования.

### 8. Мемориал, образ жизни и конфликт — выполнено
- [x] Комната памяти, предметы/полки, альбом, главные повороты, dream/gifted-day и узор жизни.
- [x] Питомцы, компьютер/велосипед/машина/дом/бизнес/аренда и шесть хобби.
- [x] Эвакуация, солдат/техника/дым/обломки, повреждённые дома и soften-варианты без новой жестокости.

### 9. UI и иконки всех экранов — выполнено
- [x] Отдельный UI-прототип Kenney: 36 состояний и 13 интерактивных проверок зелёные.
- [x] Выбрать окончательное сочетание нового арта с UI после полного пилота.
- [x] Семь thematic headers, textures, навигация, шкалы, 4 сектора, состояния кнопок/ошибок/пустых зон.
- [x] 62-экранная матрица нового полного арта, RU/EN, keyboard/touch/contrast/pixel ratios.

### 10. Аудиоребрендинг — выполнено
- [x] Найти бесплатную музыку, подходящую Cabbit/Village и чтению решений; отдельная лицензия/автор.
- [x] Найти согласованные `choice`, `year`, `inherit`; не использовать случайные боевые звуки.
- [x] Проверить бесшовный луп, loudness/true peak, отсутствие клиппинга и отдельные opt-in настройки.
- [x] Живое прослушивание музыки и SFX пользователем обязательно до production-замены.
- [x] Проверить RU/EN не требуется, но обязательны offline HTML, Windows, Android/PWA, reload и disable.

### 11. Воспроизводимый asset pipeline — выполнено
- [x] Для каждого источника: автор, лицензия, атрибуция, размер, SHA-256 и разрешённые изменения.
- [x] Только проверенный color-key/палитра/crop/atlas; alpha 0/255, без AA/микселей и пустых кадров.
- [x] Скрипты сборки, manifest, anchors/pivot и численный аудит 208 прежних состояний против новых.
- [x] Не включать PSD/исходные ZIP/демо-код в игру; CraftPix stock/AI-training запреты соблюдены.

### 12. Полный изолированный игровой preview — выполнено
- [x] Реальные решения → семья → смерть → наследник, 3 поколения и 32 избранных момента.
- [x] 33 сценария: 3 климата × 3 достатка × normal/damaged, military и memorial; 9 возрастов.
- [x] 84 экрана (7 views × 6 размеров × RU/EN), PC/mobile; 13 интерактивных проверок.
- [x] 73 файла, 8 SFX + music, 182 теста, TypeScript и `npm run build` зелёные; prototype в build не входит.
- [x] Пользователь осматривает preview и отдельно разрешает production-замену.
- [x] Закрыто: offline HTML, Windows, Android/PWA и production A/B производительности.

### 13. Production-миграция и платформенные проверки — выполнено
- [x] RebrandScene/RebrandAudio перенесены в production, старые статические canvas заменены общим модулем.
- [x] Сейв v10, баланс, данные и игровые действия сохранены; 184 теста зелёные.
- [x] 62-экранный production-аудит: 3 поколения, 32 favorites, politics, memorial, offline reload.
- [x] Старые 206 art-файлов удалены после паритета; production ZIP 809 файлов < 1000.
- [x] 64 rebrand-файла: 55 PNG и 9 аудио; music q5 72 с, −20,2 LUFS/true peak −5,5 dBFS.
- [x] Offline HTML: RU/EN, 3 поколения, 32 favorites, console errors нет.
- [x] Windows WebView2: offline, audio/music, export/import, restart, backup recovery и process restart.
- [x] Android Medium Phone: PWA и offline HTML, portrait/landscape lock, 4 choices, errors нет.
- [x] Android Compact Phone 360 px: PWA и offline HTML, portrait/landscape lock, overflow нет.
- [x] HTML5 ZIP preview: 4 размера, broken images и console errors нет.
- [x] Финальные 184 теста, TypeScript и production build зелёные.

### 14. Публикация — выполнено
- [x] Живое прослушивание production music/SFX подтверждено пользователем.
- [x] Новые social/cover/banner/GIF и 5 screenshots подготовлены и осмотрены.
- [x] Описание RU/EN включает rebrand, `$0 or more` и донат `$2` без преимуществ.
- [x] HTML5/offline/Windows ZIP проверены CRC; hashes записаны в статус.
- [x] GitHub Release `v1.1.0` опубликован; три внешних файла повторно скачаны, SHA-256 совпадают.
- [x] GitHub Pages содержит игру `99c5dfd`; workflow `0fa1c04` разделяет build/deploy, manifest совпадает с `dist`, публичные 62-экранный и RU/EN/offline QA зелёные.
- [x] itch.io обновлён: описание, обложка, GIF/screenshots и три пакета; настройки проверены после reload.
- [x] Offline/Windows скачаны с itch и совпали по SHA-256; HTML5 manifest и центральные файлы проверены.
- [x] Публичный `Run game`, новая жизнь, 4 choices, outcome и бесплатное скачивание работают.
- [x] Мобильный сценарий согласован: desktop embed 1280×720, адаптивная версия на Pages, заметная ссылка в описании.

### 15. Post-rebrand производительность — выполнено
- [x] Startup 3 прогона desktop/mobile, cold/warm/offline: mobile cold 2292/2752 мс, desktop cold
  1054/1223 мс; warm/offline быстрые, cache 5,6–6,9 с. Результат сопоставим со старым P2.
- [x] Жёсткий mobile threshold 2000 мс не пройден, как и раньше; регрессии против 2274/2703 мс нет.
- [x] Runtime desktop/mobile около 60 fps, p95 действий ~16 мс, retained screens 0, listeners/
  documents/timers без роста; ошибок нет.
- [x] Heap за 10 циклов: desktop +3,51%, mobile +8,63%, оба ниже порога 10%. Оптимизация кода
  без новой подтверждённой проблемы не требуется. Отчёты: `shots/perf-rebrand-*`.

## Публикация и профилирование закрыты

Все пакеты и материалы опубликованы на GitHub Pages, GitHub Release и itch.io. Подробные upload ID,
хэши и результаты публичных проверок записаны в `docs/status.md`.
