"""Русские названия стран из Unicode CLDR (Unicode License).

Вход: data/raw/cldr_ru_territory.json (cldr-localenames-full/main/ru/territories.json).
Выход: public/data/countries_ru.json — {ISO3: название на русском}.

Запуск: python -P scripts/build_country_names.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"

MANUAL = {"X412": "Косово"}


def main():
    cldr = json.loads((ROOT / "data" / "raw" / "cldr_ru_territory.json").read_text(encoding="utf-8"))
    territories = cldr["main"]["ru"]["localeDisplayNames"]["territories"]
    index = json.loads((OUT / "index.json").read_text(encoding="utf-8"))
    names, missing = {}, []
    for c in index["countries"]:
        if c["iso3"] in MANUAL:
            names[c["iso3"]] = MANUAL[c["iso3"]]
        elif c["iso2"] and c["iso2"] in territories:
            names[c["iso3"]] = territories[c["iso2"]]
        else:
            missing.append(c["iso3"])
    (OUT / "countries_ru.json").write_text(
        json.dumps(names, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"countries: {len(names)}, missing: {missing}")


if __name__ == "__main__":
    main()
