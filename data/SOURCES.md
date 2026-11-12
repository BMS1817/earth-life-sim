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
