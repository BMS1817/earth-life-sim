"""Собирает доходы на душу населения из Maddison Project Database 2023 (CC BY 4.0).

Вход: data/raw/maddison/mpd2023.xlsx, лист «Full data» (countrycode, year, gdppc, 2011$).
Выход:
  public/data/income.json — {ISO3: [gdppc за 1950–2022]}, пропуски интерполированы,
  края достроены ближайшим значением. Поле "_world" — медиана по странам за год
  (fallback для стран вне MPD). После 2022 игра держит уровень 2022 (см. SOURCES.md).

Запуск: python -P scripts/build_income.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "maddison" / "mpd2023.xlsx"
OUT = ROOT / "public" / "data"
Y0, Y1 = 1950, 2022


def main():
    df = pd.read_excel(RAW, sheet_name="Full data")
    df = df[(df["year"] >= Y0) & (df["year"] <= Y1)]
    series = {}
    for code, g in df.groupby("countrycode"):
        s = g.set_index("year")["gdppc"].reindex(range(Y0, Y1 + 1))
        s = s.interpolate().ffill().bfill()
        if s.isna().any():
            continue
        series[code] = [round(v) for v in s]
    world = pd.DataFrame(series).median(axis=1)
    series["_world"] = [round(v) for v in world]
    (OUT / "income.json").write_text(json.dumps({
        "source": "Maddison Project Database 2023 (CC BY 4.0), gdppc in 2011 international dollars",
        "years": [Y0, Y1],
        "gdp": series,
    }, separators=(",", ":")), encoding="utf-8")
    print(f"countries: {len(series) - 1} + _world fallback, years {Y0}–{Y1}")


if __name__ == "__main__":
    main()
