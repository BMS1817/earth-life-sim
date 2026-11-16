import json
import math
import statistics
import urllib.request
from pathlib import Path

import pyreadr

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "vdem-v16.RData"
MANUAL = ROOT / "data" / "manual" / "politics.json"
OUT = ROOT / "public" / "data" / "politics"
START = 1950
END = 2025
SOURCE = "Coppedge et al. (2026), V-Dem Country-Year Dataset v16, doi:10.23696/vdemds26"
LICENSE = "CC BY-SA 4.0"
COLUMNS = [
    "country_name", "country_text_id", "year", "v2x_regime", "v2x_polyarchy",
    "v2x_libdem", "v2x_elecoff", "v2x_ex_hereditary", "v2ex_hogw", "v2ex_hosw",
    "v2ex_legconhog", "v2ex_legconhos", "v2ex_elechog", "v2ex_elechos",
    "v2eltype_0", "v2eltype_6",
]
FORMS = {"presidential": 0, "semiPresidential": 1, "parliamentary": 2, "monarchy": 3, "council": 4}
LEADERS = {"popular": 0, "legislature": 1, "appointed": 2, "hereditary": 3}
TERM_YEARS = {"presidential": 5, "semiPresidential": 5, "parliamentary": 4, "monarchy": 0, "council": 4}
TERM_LIMITS = {"presidential": 2, "semiPresidential": 2, "parliamentary": 0, "monarchy": 0, "council": 0}


def number(value, default=None):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return default
    return float(value)


def derive(row):
    hereditary = number(row.get("v2x_ex_hereditary"), 0)
    hogw = number(row.get("v2ex_hogw"), 0)
    hosw = number(row.get("v2ex_hosw"), 0)
    leg_hog = number(row.get("v2ex_legconhog"), 0)
    leg_hos = number(row.get("v2ex_legconhos"), 0)
    direct_hog = number(row.get("v2ex_elechog"), 0)
    direct_hos = number(row.get("v2ex_elechos"), 0)
    if hereditary >= 0.5:
        form = "monarchy"
    elif direct_hos >= 0.5:
        form = "semiPresidential" if leg_hog >= 0.5 or hogw >= 0.75 else "presidential"
    elif direct_hog >= 0.5:
        form = "presidential"
    elif hosw >= 0.75 and hogw < 0.75 and leg_hog < 0.5:
        form = "presidential"
    elif hogw >= 0.75 and leg_hog >= 0.5:
        form = "parliamentary"
    elif leg_hog >= 0.5 or leg_hos >= 0.5:
        form = "parliamentary"
    elif hogw >= 0.25 and hosw >= 0.25:
        form = "semiPresidential"
    else:
        form = "council"
    if form == "monarchy":
        leader = "hereditary"
    elif form in ("presidential", "semiPresidential"):
        leader = "popular"
    elif form == "parliamentary":
        leader = "legislature"
    else:
        leader = "appointed"
    return form, leader


def main():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve("https://raw.githubusercontent.com/vdeminstitute/vdemdata/master/data/vdem.RData", RAW)
    manual = json.loads(MANUAL.read_text(encoding="utf-8"))
    index = json.loads((ROOT / "public" / "data" / "index.json").read_text(encoding="utf-8"))
    frame = pyreadr.read_r(str(RAW))["vdem"][COLUMNS]
    frame = frame[(frame.year >= START) & (frame.year <= END)]
    records = {}
    for row in frame.to_dict("records"):
        row["year"] = int(row["year"])
        records[(row["country_text_id"], row["year"])] = row

    world = {}
    for year in range(START, END + 1):
        rows = [row for (iso, row_year), row in records.items() if row_year == year and number(row.get("v2x_regime")) is not None]
        aggregate = {"year": year}
        for key in ["v2x_polyarchy", "v2x_libdem", "v2x_elecoff", "v2x_ex_hereditary", "v2ex_hogw", "v2ex_hosw", "v2ex_legconhog", "v2ex_legconhos", "v2ex_elechog", "v2ex_elechos"]:
            values = [number(row.get(key)) for row in rows]
            aggregate[key] = statistics.median(value for value in values if value is not None)
        aggregate["v2x_regime"] = round(statistics.median(number(row["v2x_regime"]) for row in rows))
        world[year] = aggregate

    def source_row(iso3, year):
        code = manual["aliases"].get(iso3, iso3)
        row = records.get((code, year))
        if row and number(row.get("v2x_regime")) is not None:
            return row, False, code
        predecessor = manual["predecessors"].get(iso3)
        if predecessor and year < predecessor["before"]:
            reference = predecessor["source"]
            return (world[year], True, reference) if reference == "_world" else (records.get((reference, year), world[year]), True, reference)
        fallback = manual["fallbacks"].get(iso3)
        if fallback:
            reference = fallback["source"]
            return (world[year], True, reference) if reference == "_world" else (records.get((reference, year), world[year]), True, reference)
        return world[year], True, "_world"

    OUT.mkdir(parents=True, exist_ok=True)
    summary = {"source": SOURCE, "license": LICENSE, "years": [START, END], "count": len(index["countries"]), "profiles": {}}
    for country in index["countries"]:
        iso3 = country["iso3"]
        arrays = {key: [] for key in ["regime", "polyarchy", "liberal", "elected", "form", "leader", "termYears", "termLimits", "estimated"]}
        references = set()
        for year in range(START, END + 1):
            row, estimated, reference = source_row(iso3, year)
            if estimated:
                references.add(reference)
            form, leader = derive(row)
            fallback = manual["fallbacks"].get(iso3, {})
            if estimated and iso3 in manual["fallbacks"]:
                form = fallback.get("form", form)
                leader = fallback.get("leader", leader)
            override = next((item for item in manual["termLimitOverrides"].get(iso3, []) if year >= item["from"] and year <= item.get("to", END)), None)
            term_limit = override.get(form, TERM_LIMITS[form]) if override else TERM_LIMITS[form]
            arrays["regime"].append(int(number(row.get("v2x_regime"), 0)))
            arrays["polyarchy"].append(round(number(row.get("v2x_polyarchy"), 0), 3))
            arrays["liberal"].append(round(number(row.get("v2x_libdem"), 0), 3))
            arrays["elected"].append(round(number(row.get("v2x_elecoff"), 0), 3))
            arrays["form"].append(FORMS[form])
            arrays["leader"].append(LEADERS[leader])
            arrays["termYears"].append(TERM_YEARS[form])
            arrays["termLimits"].append(term_limit)
            arrays["estimated"].append(1 if estimated else 0)

        code = manual["aliases"].get(iso3, iso3)
        direct_years = {year for year in range(START, END + 1) if not source_row(iso3, year)[1]}
        elections = {
            "parliamentary": sorted({year for (iso, year), row in records.items() if iso == code and year in direct_years and number(row.get("v2eltype_0"), 0) == 1}),
            "presidential": sorted({year for (iso, year), row in records.items() if iso == code and year in direct_years and number(row.get("v2eltype_6"), 0) == 1}),
        }
        profile = {
            "iso3": iso3,
            "source": SOURCE,
            "license": LICENSE,
            "years": [START, END],
            "fallbackReferences": sorted(references),
            "elections": elections,
            **arrays,
        }
        length = END - START + 1
        assert all(len(value) == length for value in arrays.values()), iso3
        assert all(value in range(4) for value in arrays["regime"]), iso3
        assert all(value in FORMS.values() for value in arrays["form"]), iso3
        assert all(value in LEADERS.values() for value in arrays["leader"]), iso3
        (OUT / f"{iso3}.json").write_text(json.dumps(profile, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        summary["profiles"][iso3] = {
            "estimatedYears": sum(arrays["estimated"]),
            "fallbackReferences": sorted(references),
            "parliamentaryElections": len(elections["parliamentary"]),
            "presidentialElections": len(elections["presidential"]),
        }
    (OUT / "_index.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "profiles": len(index["countries"]),
        "years": [START, END],
        "fullyObserved": sum(1 for item in summary["profiles"].values() if item["estimatedYears"] == 0),
        "withEstimates": sum(1 for item in summary["profiles"].values() if item["estimatedYears"] > 0),
        "estimatedYears": sum(item["estimatedYears"] for item in summary["profiles"].values()),
        "output": str(OUT),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
