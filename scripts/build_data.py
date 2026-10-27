"""Собирает игровые данные из WPP 2024 (R-пакет wpp2024, файлы в data/raw/wpp2024).

Выход:
  public/data/index.json      — страны: коды, имя, рождения и SRB по годам 1950–2100
  public/data/mort/<ISO3>.json — e0 и вероятности смерти qx (×1e6) по полу, году, возрасту 0–100

Запуск: python -P scripts/build_data.py
"""
import json
from pathlib import Path

import pycountry
import rdata

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "wpp2024"
OUT = ROOT / "public" / "data"
YEARS = range(1950, 2101)
AGES = range(0, 101)  # 100 — открытый интервал 100+
Q_SCALE = 1_000_000


def load(name):
    return next(iter(rdata.read_rda(str(RAW / f"{name}.rda")).values()))


def by_code_year(df, col):
    return {(int(c), int(y)): float(v) for c, y, v in zip(df["country_code"], df["year"], df[col])}


def a0(m0, sex):
    # Andreev & Kingkade (2015): средняя доля года, прожитая умершими в возрасте 0.
    if sex == "M":
        return 0.14929 - 1.99545 * m0 if m0 < 0.0230 else 0.02832 + 3.26201 * m0 if m0 < 0.08307 else 0.29915
    return 0.14903 - 2.05527 * m0 if m0 < 0.01724 else 0.04667 + 3.88089 * m0 if m0 < 0.06891 else 0.31411


def qx(m, age, sex):
    if age == AGES[-1]:
        return 1.0
    a = a0(m, sex) if age == 0 else 0.5
    return min(1.0, m / (1 + (1 - a) * m))


def countries():
    rows = (RAW / "UNlocations.txt").read_text(encoding="utf-8").splitlines()
    head = rows[0].split("\t")
    i_name, i_code, i_type = head.index("name"), head.index("country_code"), head.index("location_type")
    out = []
    for line in rows[1:]:
        f = line.split("\t")
        if f[i_type] != "4":
            continue
        code = int(f[i_code])
        iso = pycountry.countries.get(numeric=f"{code:03d}")
        out.append({
            "code": code,
            "iso2": iso.alpha_2 if iso else None,
            "iso3": iso.alpha_3 if iso else f"X{code:03d}",
            "name": f[i_name],
        })
    return out


def main():
    locs = countries()
    births = by_code_year(load("misc1dt"), "births") | by_code_year(load("miscproj1dt"), "births")
    srb = by_code_year(load("sexRatio1dt"), "srb")
    e0_hist, e0_proj = load("e01dt"), load("e0proj1dt")
    e0 = {s: by_code_year(e0_hist, f"e0{s}") | by_code_year(e0_proj, f"e0{s}") for s in "MF"}

    index, missing = [], []
    for c in locs:
        k = c["code"]
        if any((k, y) not in births or (k, y) not in srb for y in YEARS):
            missing.append(c["name"])
            continue
        index.append(c | {
            "births": [round(births[(k, y)] * 1000) for y in YEARS],
            "srb": [srb[(k, y)] for y in YEARS],
        })

    mx = load("mx1dt")
    codes = {c["code"] for c in locs}
    q = {}  # (code, sex) -> [year][age]
    for code, year, age, m_m, m_f in zip(mx["country_code"], mx["year"], mx["age"], mx["mxM"], mx["mxF"]):
        code, year, age = int(code), int(year), int(age)
        if code not in codes or year not in YEARS:
            continue
        for sex, m in (("M", m_m), ("F", m_f)):
            table = q.setdefault((code, sex), [[None] * len(AGES) for _ in YEARS])
            table[year - YEARS[0]][age] = round(qx(float(m), age, sex) * Q_SCALE)

    (OUT / "mort").mkdir(parents=True, exist_ok=True)
    for c in index:
        k = c["code"]
        tables = {s: q.get((k, s)) for s in "MF"}
        if any(t is None or any(v is None for row in t for v in row) for t in tables.values()):
            missing.append(c["name"])
            continue
        (OUT / "mort" / f"{c['iso3']}.json").write_text(json.dumps({
            "code": k,
            "scale": Q_SCALE,
            "e0": {s: [round(e0[s][(k, y)], 2) for y in YEARS] for s in "MF"},
            "q": tables,
        }, separators=(",", ":")), encoding="utf-8")

    (OUT / "index.json").write_text(json.dumps({
        "source": "UN DESA Population Division, World Population Prospects 2024 (CC BY 3.0 IGO), via R package wpp2024",
        "years": [YEARS[0], YEARS[-1]],
        "countries": [c for c in index if c["name"] not in missing],
    }, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"countries: {len(locs) - len(missing)}, skipped (incomplete data): {missing}")


if __name__ == "__main__":
    main()
