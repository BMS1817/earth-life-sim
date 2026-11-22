# Источники данных

## UN World Population Prospects 2024
- **Что:** рождения, соотношение полов при рождении (SRB), e0, коэффициенты смертности mx
  по полу и возрасту 0–100, 1950–2023 (оценка) и 2024–2100 (средний вариант прогноза).
- **Автор:** United Nations, Department of Economic and Social Affairs, Population Division.
  World Population Prospects 2024. https://population.un.org/wpp/
- **Как получено:** R-пакет `wpp2024` 1.1-3 (https://github.com/PPgp/wpp2024), файлы
  `mx1dt`, `e01dt`, `e0proj1dt`, `misc1dt`, `miscproj1dt`, `sexRatio1dt`, `UNlocations`.
  Прямая выгрузка с population.un.org слишком медленная (обрывы на ~5 КБ/с).
- **Лицензия:** Creative Commons Attribution 3.0 IGO —
  https://creativecommons.org/licenses/by/3.0/igo/
- **Изменения (требование лицензии — отметить):** `scripts/build_data.py` пересчитывает mx
  в вероятности смерти qx (a = 0.5; для возраста 0 — Andreev & Kingkade 2015), округляет,
  раскладывает по странам в `public/data/`. Ватикан пропущен (нет рождений).

## Коды стран
- ISO 3166 через Python-пакет `pycountry` (данные Debian iso-codes, LGPL-2.1).
  Территории без ISO-кода получают код `X<номер ООН>`.

## Названия стран и история
- Русские названия: Unicode CLDR (`cldr-localenames-full/main/ru/territories.json`,
  Unicode License, https://github.com/unicode-org/cldr-json). Косово — вручную.
- Эпохи стран (`src/content/eras.ts`) и каталог мировых событий (`src/content/history.ts`) —
  справочные факты, сверка по Wikipedia (CC BY-SA 4.0).

## Имена
- **Что:** списки личных имён по полу для всех стран, до 30 на пол (`public/data/names.json`).
- **Источник:** Python-пакет Faker (MIT, https://github.com/joke2k/faker), провайдеры
  `person.<locale>` — 82 локали; страна получает свою локаль или региональный fallback
  (таблица в `scripts/build_names.py`). CN, PK, PH — ручные списки
  `data/manual/names_extra.json` (общие имена, справочно: Wikipedia, CC BY-SA 4.0).
- **Ограничение:** выбор в игре равновероятный по списку — весов частотности у Faker нет.
  Отклонённый кандидат: philipperemy/name-dataset — построен на утечке Facebook, не открытый
  источник.

## Семья и рождаемость (v0.2a)
- **Домохозяйства:** United Nations, DESA, Population Division (2022), Database on Household
  Size and Composition 2022. https://www.un.org/development/desa/pd/data/household-size-and-composition
  Файл `undesa_pd_2022_hh-size-composition.xlsx`: 196 стран/территорий, наблюдения 1960–2021.
  Используются средний размер домохозяйства, среднее число детей до 15 лет в домохозяйствах
  с детьми и доля однородительских домохозяйств среди домохозяйств с детьми.
- **Возраст матери и рождаемость:** UN WPP 2024, R-пакет `wpp2024`, `percentASFR1dt.rda`
  (годовые доли рождений по возрасту матери 10–54, 1950–2100), `tfr1dt.rda`, `tfrproj1dt.rda`.
- **Лицензия обоих наборов:** Creative Commons Attribution 3.0 IGO —
  https://creativecommons.org/licenses/by/3.0/igo/ (лицензия также указана внутри XLSX ООН).
- **Изменения:** `scripts/build_family.py` группирует возраст матери в 5-летние доли,
  объединяет исторический и прогнозный TFR, переводит типы домохозяйств в долю однородительских,
  рассчитывает взвешенный по рождениям мировой fallback и создаёт `public/data/family/*.json`.
- **Ограничения:** год наблюдения домохозяйства не всегда совпадает с годом рождения героя;
  интерполяция и распределение отдельных членов семьи — игровая модель, не индивидуальная
  демографическая статистика. Число старших сибсов калибруется после ограничения возраста матери,
  чтобы среднее соответствовало наблюдению; тесты — `tests/people.test.ts`.
  Возраст отца, характеры и распределение романтических предпочтений —
  помеченные игровые оценки.

## Организованное насилие (v0.2b)
- **Основа:** UCDP Country-Year Dataset on Organized Violence within Country Borders 26.1,
  7132 строки, 199 стран, 1989–2025. `organizedviolencecy-261-csv.zip`, codebook
  `UCDP_OrganizedViolenceCY_Codebook_261.pdf`. Используются погибшие мирные/неустановленные,
  погибшие стороны и активность по стране-году.
- **1950–1988:** UCDP/PRIO Armed Conflict Dataset 26.1 (`UcdpPrioConflict_v26_1.csv`) и
  UCDP Non-State Conflict Dataset 26.1 (`NonState_v26_1.csv`). Non-State даёт фактические
  потери; ACD — только интенсивность. Для ACD риск оценивается медианой смертей на население
  по уровню интенсивности на пересечении 1989–2023 и помечается `early-model`.
- **Ограничения:** One-Sided Violence до 1989 не моделируется; ранняя ACD — оценка, не точные
  смерти. После 2025 — вероятностный сценарий по активным годам 2016–2025, связные
  пятилетние эпизоды для сохранения частоты без ежегодных искусственных начал/завершений; не прогноз.
- **Население:** UN WPP 2024, `births / cbr * 1e6` по стране и году. Конфликты СССР, Югославии,
  Чехословакии, Судана, Эфиопии и Пакистана распределяются по современным республикам пропорционально
  населению. Списки и псевдонимы — в `scripts/build_conflicts.py`.
- **Лицензия:** Creative Commons Attribution 4.0 International (https://ucdp.uu.se/downloads/),
  redistribution с указанием UCDP разрешён. Используются открытые ZIP, API-токен не требуется.
- **Изменения:** агрегация по ISO3, распределение исторических государств, округление смертей,
  вычисление модели ранней интенсивности. Выход `public/data/conflicts/*.json`.

## Регистрация однополых браков
- Справочник `src/content/partnership-law.ts`: год начала регистрации по странам и территориям,
  включая периоды отмены/восстановления на Бермудах. Партнёрство без брака законом не ограничивается
  в игровой модели; гражданские союзы отдельно не симулируются.
- Источник: Wikipedia, «Same-sex marriage», хронологическая таблица дат вступления в силу
  (https://en.wikipedia.org/wiki/Same-sex_marriage), CC BY-SA 4.0; проверено 2026-11-15.

## Визуальные референсы и шрифт
- **Референсы:** доска пользователя «1 in a billion» на Pinterest и открытые наборы Kenney Pixel UI,
  Kenney UI Pack RPG Extension, Mana Soul GUI (все три набора — CC0). Использованы только для выбора
  направления силуэтов, природы и фиолетово-золотых рамок; изображения не входят в игру.
- **Производство арта:** прежние оригинальные модели и CSS — `scripts/blender/build_all.py`,
  `index.html`, `assets/palette.hex`. Текущий модульный пакет сгенерирован Kimi по запросу
  владельца проекта с использованием его доски референсов; чужие спрайты не копируются. Исходники —
  `assets/kimi/`, производственное преобразование и проверка — `scripts/build_kimi_art.py`,
  выход — `public/art/kimi/`.
- **Флаги стран:** пакет `flag-icons` 7.6.0, Panayiotis Lipiridis, MIT
  (https://github.com/lipis/flag-icons). `scripts/build-flags.mjs` копирует 235 используемых ISO2 SVG
  в `public/flags/4x3/`; загружается только флаг текущей страны, без CDN и системных emoji.
  Лицензия сохранена в `public/licenses/flag-icons.txt`. Для записи без ISO2 флаг не показывается.
- **Шрифт заголовков:** Press Start 2P, CodeMan38 / The Press Start 2P Project Authors.
  Источник: https://github.com/google/fonts/tree/main/ofl/pressstart2p . Поддерживает Cyrillic и
  Cyrillic Extended. Исходный `public/fonts/PressStart2P-Regular.ttf` конвертируется без изменения
  начертаний в `PressStart2P-Regular.woff2` командой `npm run fonts`. Лицензия SIL OFL 1.1
  сохранена в `public/fonts/OFL.txt`. Основной текст остаётся системным шрифтом.

## Доходы
- **Что:** ВВП на душу населения (межд. доллары 2011 г.) по странам, 1950–2022
  (`public/data/income.json`).
- **Автор:** Bolt, Jutta and Jan Luiten van Zanden (2024), Maddison Project Database 2023.
  https://www.rug.nl/ggdc/historicaldevelopment/maddison/ ; файл через DataverseNL,
  doi:10.34894/INZBF2.
- **Лицензия:** Creative Commons Attribution 4.0 International.
- **Изменения:** линейная интерполяция пропусков, края достроены ближайшим значением;
  страны вне MPD используют `_world` (медиана по странам). После 2022 года игра держит
  уровень 2022.

## Политические данные (v0.4P)
- **V-Dem v16:** Varieties of Democracy, Coppedge et al. (2026), Country-Year Dataset v16,
  doi:10.23696/vdemds26, https://v-dem.net/data/the-v-dem-dataset/ . Лицензия CC BY-SA 4.0;
  производный набор сохраняет указание авторства и CC BY-SA 4.0 в каждом JSON и в UI. Источник
  файлов для сборки: официальный репозиторий https://github.com/vdeminstitute/vdemdata
  (`data/vdem.RData`, кодбук). `scripts/build_politics.py` выбирает 16 переменных, переводит их
  в игровые категории и создаёт `public/data/politics/<ISO3>.json`: 236 профилей по 76 лет
  (1950–2025), 149 без оценочных лет, 87 с явными fallback; всего 5556 оценочных country-year.
  `data/manual/politics.json` задаёт ISO-алиасы, предшественников, метрополии, региональные и
  мировые fallback и отдельные ручные ограничения переизбраний. Фактические национальные годы
  выборов сохраняются отдельно; местные циклы, формы по индикаторам и сроки без наблюдений —
  помеченные игровые оценки. После 2025 года используется сценарий последнего режима, не прогноз.
  Сырые RData остаются в `data/raw/` и не коммитятся. Повторная сборка: `npm run politics-data`.
- **Constitute:** условия https://www.constituteproject.org/content/terms не дают подходящей общей
  открытой лицензии для встроенного производного массива и запрещают коммерческое использование.
  Данные и тексты Constitute в игру не копируются.
- **International IDEA Voter Turnout:** https://www.idea.int/data-tools/data/voter-turnout и
  https://www.idea.int/terms-and-conditions . Экспорт не встраивается из-за некоммерческих и
  дополнительных лицензионных ограничений; местные выборы этот набор также не покрывает.


## Оригинальные звуковые сигналы (P4)
- `public/audio/choice.wav`, `year.wav`, `inherit.wav` синтезированы специально для Earth кодом
  `scripts/build_audio.py` по запросу владельца проекта: чистые тона, короткие огибающие и
  детерминированный шум; внешние записи, библиотеки сэмплов и платные пакеты не используются.
- PCM WAV, mono, 22050 Hz, 16 bit. Повторная генерация: `npm run audio`. Измерение уровней —
  FFmpeg `ebur128=peak=true`; источники и результат проверки записаны в `docs/status.md`.

- **Музыка:** `public/audio/music.ogg` — оригинальный 72-секундный ambient-chiptune луп,
  синтезированный `scripts/build_music.py`: тёплые аккорды, редкие ноты, без выраженного ритма и
  внешних сэмплов. WAV генерируется во временной `.tools/music/`, публикация использует OGG Vorbis
  через локальный FFmpeg. Повторная генерация также входит в `npm run audio`.
