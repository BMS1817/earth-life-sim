"""Собирает страна-годовой риск организованного насилия UCDP 26.1.

1989–2025: фактический Organized Violence CY.
1950–1988: Non-State (фактические потери) + ACD (модель по интенсивности,
медиана риска на пересечении 1989–2023). Оценки явно помечены source=early-model.

Запуск: python -P scripts/build_conflicts.py (после build_data.py).
"""
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pycountry
import rdata

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
UCDP = RAW / "ucdp261"
WPP = RAW / "wpp2024"
OUT = ROOT / "public" / "data" / "conflicts"

SUCCESSORS = {
    "Soviet Union": ["RUS", "UKR", "BLR", "KAZ", "UZB", "TKM", "KGZ", "TJK", "ARM", "AZE", "GEO", "MDA", "EST", "LVA", "LTU"],
    "Russia (Soviet Union)": ["RUS", "UKR", "BLR", "KAZ", "UZB", "TKM", "KGZ", "TJK", "ARM", "AZE", "GEO", "MDA", "EST", "LVA", "LTU"],
    "Yugoslavia": ["SRB", "HRV", "BIH", "SVN", "MKD", "MNE", "XKX"],
    "Serbia (Yugoslavia)": ["SRB", "HRV", "BIH", "SVN", "MKD", "MNE", "XKX"],
}
ALIASES = {
    "Zaire": "COD", "DR Congo (Zaire)": "COD", "Upper Volta": "BFA", "Ceylon": "LKA", "Burma": "MMR",
    "Myanmar (Burma)": "MMR", "Rhodesia": "ZWE", "Zimbabwe (Rhodesia)": "ZWE",
    "South West Africa": "NAM", "Tanganyika": "TZA", "Zanzibar": "TZA",
    "British Honduras": "BLZ", "Dahomey": "BEN", "Congo Brazzaville": "COG",
    "Congo Kinshasa": "COD", "East Germany": "DEU", "German Democratic Republic": "DEU",
    "West Germany": "DEU", "North Yemen": "YEM", "South Yemen": "YEM",
    "Yemen (North Yemen)": "YEM", "Yemen (South Yemen)": "YEM",
    "South Vietnam": "VNM", "North Vietnam": "VNM", "Vietnam (North Vietnam)": "VNM",
    "Formosa": "TWN", "Bosnia-Herzegovina": "BIH", "Cambodia (Kampuchea)": "KHM",
    "Cape Verde": "CPV", "Antigua & Barbuda": "ATG", "East Timor": "TLS",
    "Kingdom of eSwatini (Swaziland)": "SWZ", "Madagascar (Malagasy)": "MDG",
    "Samoa (Western Samoa)": "WSM", "Turkey": "TUR", "Ivory Coast": "CIV",
}
UNMATCHED = set()


def load(name):
    return next(iter(rdata.read_rda(str(WPP / f"{name}.rda")).values()))


def by_code_year(df, col):
    return {(int(c), int(y)): float(v) for c, y, v in zip(df["country_code"], df["year"], df[col])}


def iso3(name):
    if name in ALIASES:
        return ALIASES[name]
    try:
        exact = pycountry.countries.get(name=name)
        if exact:
            return exact.alpha_3
        found = pycountry.countries.search_fuzzy(name)
        if found:
            return found[0].alpha_3
    except (LookupError, AttributeError):
        pass
    UNMATCHED.add(name)
    return None


def locations(name, year, iso_to_un):
    if ", " in name:
        codes = []
        for part in name.split(", "):
            codes.extend(locations(part, year, iso_to_un))
        return list(dict.fromkeys(codes))
    if name in SUCCESSORS:
        codes = SUCCESSORS[name]
        if name == "Yugoslavia" and year >= 1992:
            codes = ["SRB", "MNE"]
        if name == "Yugoslavia" and year >= 2006:
            codes = ["SRB"]
        return codes
    if name == "Czechoslovakia":
        return ["CZE", "SVK"]
    if name == "Sudan":
        return ["SDN"] if year >= 2011 else ["SDN", "SSD"]
    if name == "Ethiopia":
        return ["ETH"] if year >= 1993 else ["ETH", "ERI"]
    if name == "Pakistan":
        return ["PAK"] if year >= 1971 else ["PAK", "BGD"]
    if name == "Korea":
        return ["PRK", "KOR"]
    code = iso3(name)
    return [code] if code in iso_to_un else []


def main():
    index = json.loads((ROOT / "public" / "data" / "index.json").read_text(encoding="utf-8"))
    countries = {c["iso3"]: c for c in index["countries"]}
    iso_to_un = {c["iso3"]: c["code"] for c in index["countries"]}
    births = by_code_year(load("misc1dt"), "births") | by_code_year(load("miscproj1dt"), "births")
    cbr = by_code_year(load("misc1dt"), "cbr") | by_code_year(load("miscproj1dt"), "cbr")
    population = {key: round(births[key] / cbr[key] * 1_000_000) for key in births}

    organized = pd.read_csv(UCDP / "OrganizedViolenceCYDataSet26_1.csv")
    acd = pd.read_csv(UCDP / "UcdpPrioConflict_v26_1.csv")
    nonstate = pd.read_csv(UCDP / "NonState_v26_1.csv")

    records = defaultdict(lambda: defaultdict(lambda: {"civilians": 0.0, "parties": 0.0, "population": 0}))

    def add(iso_codes, year, civilian, parties, source):
        valid = [code for code in iso_codes if code in iso_to_un]
        if not valid:
            return
        weights = {code: population[(iso_to_un[code], min(2100, max(1950, year)))] for code in valid}
        total = sum(weights.values())
        for code in valid:
            share = weights[code] / total if total else 1 / len(valid)
            row = records[code][year]
            row["civilians"] += civilian * share
            row["parties"] += parties * share
            row["population"] = weights[code]
            row["source"] = source

    intensity_rates = defaultdict(list)
    organized_lookup = {}
    for row in organized.to_dict("records"):
        if int(row["sb_exist"]) + int(row["ns_exist"]) + int(row["os_exist"]) == 0:
            continue
        codes = locations(row["country"], int(row["year"]), iso_to_un)
        if len(codes) != 1:
            continue
        code = codes[0]
        year = int(row["year"])
        pop = population[(iso_to_un[code], year)]
        organized_lookup[(code, year)] = row
        if year <= 2023 and pop > 0:
            for acd_row in acd[(acd["year"] == year) & (acd["gwno_loc"].astype(str).str.contains(str(row["country_id"]), regex=False))].to_dict("records"):
                intensity = int(acd_row["intensity_level"])
                state_deaths = float(row["sb_total_deaths_best"])
                parties = float(row["sb_deaths_parties"])
                civilians = float(row["sb_deaths_civilians"] + row["sb_deaths_unknown"])
                if state_deaths == 0:
                    state_deaths = float(row["cumulative_total_deaths_in_orgvio_best"])
                    parties = float(row["cumulative_total_deaths_parties_in_orgvio"])
                    civilians = float(row["cumulative_total_deaths_civilians_in_orgvio"] + row["cumulative_total_deaths_unknown_in_orgvio"])
                intensity_rates[intensity].append((
                    state_deaths / pop,
                    parties / pop,
                    civilians / pop,
                ))
    median_rates = {}
    for intensity, rows in intensity_rates.items():
        frame = pd.DataFrame(rows)
        median_rates[intensity] = tuple(float(v) for v in frame.median().tolist())

    for row in acd.to_dict("records"):
        year = int(row["year"])
        if year < 1950 or year > 1988:
            continue
        codes = locations(str(row["location"]), year, iso_to_un)
        if not codes:
            continue
        intensity = int(row["intensity_level"])
        total_rate, party_rate, civilian_rate = median_rates.get(intensity, (0.0, 0.0, 0.0))
        for code in codes:
            pop = population[(iso_to_un[code], year)]
            add([code], year, pop * civilian_rate, pop * party_rate, "early-model")

    for row in nonstate.to_dict("records"):
        year = int(row["year"])
        if year < 1950 or year > 1988:
            continue
        codes = locations(str(row["location"]), year, iso_to_un)
        add(codes, year, 0, float(row["best_fatality_estimate"]), "nonstate")

    for row in organized.to_dict("records"):
        if int(row["sb_exist"]) + int(row["ns_exist"]) + int(row["os_exist"]) == 0:
            continue
        year = int(row["year"])
        codes = locations(row["country"], year, iso_to_un)
        add(
            codes,
            year,
            float(row["cumulative_total_deaths_civilians_in_orgvio"] + row["cumulative_total_deaths_unknown_in_orgvio"]),
            float(row["cumulative_total_deaths_parties_in_orgvio"]),
            "organized",
        )

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    active = 0
    for iso3_code, country in countries.items():
        years = []
        for year in sorted(records[iso3_code]):
            row = records[iso3_code][year]
            years.append({
                "year": year,
                "civilians": round(row["civilians"]),
                "parties": round(row["parties"]),
                "population": row["population"],
                "source": row["source"],
            })
        data = {
            "code": country["code"],
            "population": [population[(country["code"], year)] for year in range(1950, 2101)],
            "years": years,
        }
        (OUT / f"{iso3_code}.json").write_text(json.dumps(data, separators=(",", ":"), allow_nan=False), encoding="utf-8")
        active += len(years)
    print(f"conflicts: {len(countries)} countries, {active} active country-years")
    print("median intensity rates:", median_rates)
    if UNMATCHED:
        print("UNMATCHED:", sorted(UNMATCHED))


if __name__ == "__main__":
    main()
