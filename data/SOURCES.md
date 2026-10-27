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
