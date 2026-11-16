"""Собирает данные для генерации семьи из UN WPP 2024 и UN Households 2022.

Выход: public/data/family/<ISO3>.json и _world.json.
Запуск: python -P scripts/build_family.py (после scripts/build_data.py).
"""
import json
import math
from pathlib import Path

import pandas as pd
import rdata

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
WPP = RAW / "wpp2024"
OUT = ROOT / "public" / "data" / "family"
YEARS = list(range(1950, 2101))
AGE_BANDS = list(range(10, 55, 5))


def load(name):
    return next(iter(rdata.read_rda(str(WPP / f"{name}.rda")).values()))


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def ref_year(value):
    if isinstance(value, (pd.Timestamp,)):
        return int(value.year)
    text = str(value)
    if "/" in text:
        return int(text.split("/")[-1])
    return int(text[:4])


def households(index_by_code):
    path = RAW / "undesa_pd_2022_hh-size-composition.xlsx"
    df = pd.read_excel(path, sheet_name="HH size and composition 2022", header=4)
    result = {}
    world = {}
    for row in df.to_dict("records"):
        code = int(row["ISO Code"])
        if code not in index_by_code:
            continue
        year = ref_year(row["Reference date (dd/mm/yyyy)"])
        couple = number(row["Couple with children"])
        single = number(row["Single parent with children"])
        denominator = (couple or 0) + (single or 0)
        item = {
            "year": year,
            "size": number(row["Average household size (number of members)"]),
            "children": number(row["Under age 15 years among households with at least one member under age 15 years"]),
            "singleParent": single / denominator if single is not None and denominator > 0 else None,
        }
        result.setdefault(code, []).append(item)
        births = index_by_code[code]["births"][min(max(year, 1950), 2100) - 1950]
        for key in ("size", "children", "singleParent"):
            value = item[key]
            if value is not None:
                weighted, weight = world.setdefault((year, key), [0.0, 0.0])
                world[(year, key)] = [weighted + value * births, weight + births]

    world_rows = {}
    for (year, key), (weighted, weight) in world.items():
        world_rows.setdefault(year, {"year": year, "size": None, "children": None, "singleParent": None})[key] = weighted / weight
    for code in result:
        result[code].sort(key=lambda row: row["year"])
    return result, [world_rows[y] for y in sorted(world_rows)]


def fertility(index_by_code):
    tfr = load("tfr1dt").set_index(["country_code", "year"])["tfr"].to_dict()
    tfr.update(load("tfrproj1dt").set_index(["country_code", "year"])["tfr"].to_dict())
    asfr = load("percentASFR1dt")
    grouped = asfr.groupby(["country_code", "year", (asfr["age"] // 5 * 5).rename("band")])["pasfr"].sum()
    result = {}
    world = {}
    for code, country in index_by_code.items():
        rows = []
        ages = []
        for year in YEARS:
            value = float(tfr[(code, year)])
            rows.append(round(value, 6))
            weights = [float(grouped.get((code, year, band), 0.0)) / 100 for band in AGE_BANDS]
            if abs(sum(weights) - 1) > 1e-5:
                raise ValueError(f"ASFR sum: {code} {year} {sum(weights)}")
            ages.append([round(weight, 8) for weight in weights])
            births = country["births"][year - 1950]
            world.setdefault(year, [0.0, 0.0, [0.0] * len(AGE_BANDS)])
            world[year][0] += value * births
            world[year][1] += births
            for i, weight in enumerate(weights):
                world[year][2][i] += weight * births
        result[code] = (rows, ages)
    world_tfr = []
    world_ages = []
    for year in YEARS:
        weighted, births, ages = world[year]
        world_tfr.append(round(weighted / births, 6))
        world_ages.append([round(value / births, 8) for value in ages])
    return result, (world_tfr, world_ages)


def main():
    index = json.loads((ROOT / "public" / "data" / "index.json").read_text(encoding="utf-8"))
    by_code = {country["code"]: country for country in index["countries"]}
    household_rows, world_households = households(by_code)
    fertility_rows, world_fertility = fertility(by_code)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    for code, country in by_code.items():
        tfr, mother_age = fertility_rows[code]
        data = {
            "code": code,
            "households": household_rows.get(code, []),
            "tfr": tfr,
            "motherAge": mother_age,
        }
        (OUT / f"{country['iso3']}.json").write_text(
            json.dumps(data, separators=(",", ":"), allow_nan=False), encoding="utf-8"
        )
    world = {
        "code": -1,
        "households": world_households,
        "tfr": world_fertility[0],
        "motherAge": world_fertility[1],
    }
    (OUT / "_world.json").write_text(json.dumps(world, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"family: {len(by_code)} countries + world; households: {len(household_rows)} countries")


if __name__ == "__main__":
    main()
