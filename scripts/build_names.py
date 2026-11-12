"""Собирает списки имён по странам из Python-пакета Faker (MIT).

Выход:
  public/data/names.json — {ISO2: {"M": [...], "F": [...]}} для всех стран index.json

Правила:
  - страна с локалью Faker (ru_RU → RU) получает свои списки (до N самых частых);
  - CN, PK, PH — ручные списки из data/manual/names_extra.json (источник — SOURCES.md);
  - остальные страны — региональный fallback (FALLBACK ниже);
  - выбор имени в игре равновероятный по списку, НЕ по частоте (у Faker нет весов).

Запуск: python -P scripts/build_names.py
"""
import importlib
import json
from pathlib import Path

from faker.config import AVAILABLE_LOCALES

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
TOP_N = 30

# Региональный fallback: ISO2 -> локаль Faker. Страны со своей локалью сюда не входят.
FALLBACK = {
    # Арабский мир
    **{c: "ar_SA" for c in ("EG", "LY", "TN", "SD", "SY", "IQ", "JO", "KW", "LB",
                            "OM", "QA", "YE", "AE", "BH", "MR", "SO", "DJ", "KM", "ER")},
    "DZ": "ar_DZ", "MA": "ar_DZ", "PS": "ar_PS",
    # Испаноязычная Латинская Америка и Карибы
    **{c: "es_CO" for c in ("CU", "DO", "GT", "HN", "NI", "PA", "PE", "PR", "SV",
                            "UY", "VE", "BO", "CR", "EC", "PY", "GQ")},
    # Франкофонные страны
    **{c: "fr_FR" for c in ("ML", "NE", "SN", "CI", "BJ", "TG", "GN", "TD", "CF",
                            "CG", "CD", "GA", "HT", "MU", "RE", "GP", "MQ", "GF",
                            "NC", "PF", "MC", "YT", "WF")},
    # Англоязычные страны
    **{c: "en_GB" for c in ("AU", "BB", "BS", "BZ", "BW", "CY", "DM", "FJ", "GD",
                            "GM", "GY", "JM", "KI", "KN", "LC", "LS", "MT", "NR",
                            "PG", "SB", "SZ", "TO", "TT", "TV", "VC", "VU", "WS",
                            "AG", "AI", "BM", "CK", "FK", "GI", "GU", "KY", "MH",
                            "MP", "MS", "NU", "PW", "SG", "SH", "TC", "VG", "VI",
                            "AS", "FM", "GL", "NF", "PN", "TK", "CA", "US")},
    **{c: "en_KE" for c in ("TZ", "UG", "RW", "SS", "ET", "MW", "ZM", "ZW", "MZ", "NA", "LR", "SL")},
    "NG": "en_NG", "GH": "tw_GH", "ZA": "en_NG",
    # Португалоязычные
    **{c: "pt_PT" for c in ("AO", "CV", "GW", "MZ", "ST", "TL")},
    # Постсоветское пространство и соседи
    **{c: "ru_RU" for c in ("BY", "KZ", "KG", "TJ", "TM", "MN", "MD", "RS", "BA",
                            "ME", "AL", "XK")},
    "UZ": "uz_UZ", "AZ": "az_AZ", "AM": "hy_AM", "GE": "ka_GE", "UA": "uk_UA",
    # Европа без своей локали
    "BE": "nl_BE", "CH": "de_CH", "AT": "de_AT", "LI": "de_LI", "LU": "de_LU",
    "SE": "sv_SE", "NO": "no_NO", "DK": "da_DK", "FI": "fi_FI", "IS": "is_IS",
    "EE": "et_EE", "LV": "lv_LV", "LT": "lv_LV", "CZ": "cs_CZ", "SK": "sk_SK",
    "SI": "sl_SI", "HR": "hr_HR", "HU": "hu_HU", "PL": "pl_PL", "RO": "ro_RO",
    "BG": "bg_BG", "GR": "el_GR", "TR": "tr_TR", "IT": "it_IT", "SM": "it_IT",
    "ES": "es_ES", "AD": "es_ES", "PT": "pt_PT", "NL": "nl_NL", "DE": "de_DE",
    "FR": "fr_FR", "IE": "ga_IE", "GB": "en_GB", "MK": "mk_MK",
    # Азия
    "IN": "hi_IN", "BD": "bn_BD", "NP": "ne_NP", "LK": "si_LK", "BT": "ne_NP",
    "MV": "si_LK", "AF": "fa_IR", "IR": "fa_IR", "IL": "he_IL", "JP": "ja_JP",
    "KR": "ko_KR", "KP": "ko_KR", "TH": "th_TH", "VN": "vi_VN", "KH": "vi_VN",
    "LA": "th_TH", "MM": "th_TH", "MY": "id_ID", "ID": "id_ID", "BN": "id_ID",
    "TW": "ja_JP", "HK": "ja_JP", "MO": "ja_JP",
    # Остальное — английский интернациональный
    "DEFAULT": "en",
}


def locale_lists(loc):
    try:
        mod = importlib.import_module(f"faker.providers.person.{loc}")
    except ImportError:
        return None
    p = mod.Provider
    m, f = getattr(p, "first_names_male", None), getattr(p, "first_names_female", None)
    if not m or not f:
        return None
    return {"M": sorted(set(m))[:TOP_N], "F": sorted(set(f))[:TOP_N]}


def main():
    locales = {loc: locale_lists(loc) for loc in AVAILABLE_LOCALES}
    locales = {k: v for k, v in locales.items() if v}
    extra = json.loads((ROOT / "data" / "manual" / "names_extra.json").read_text(encoding="utf-8"))
    index = json.loads((OUT / "index.json").read_text(encoding="utf-8"))

    by_iso2 = {}
    for loc, lists in locales.items():
        if "_" in loc:
            by_iso2.setdefault(loc.split("_")[1], lists)

    names, covered = {}, 0
    for c in index["countries"]:
        iso2 = c["iso2"]
        if not iso2:
            continue
        if iso2 in extra:
            names[iso2] = extra[iso2]
        elif iso2 in by_iso2:
            names[iso2] = by_iso2[iso2]
        else:
            loc = FALLBACK.get(iso2, FALLBACK["DEFAULT"])
            names[iso2] = locales[loc]
            covered += 1
        if len(names[iso2]["M"]) < 5 or len(names[iso2]["F"]) < 5:
            raise ValueError(f"{iso2}: слишком короткий список имён")

    (OUT / "names.json").write_text(json.dumps({
        "source": "Faker (MIT) person providers + manual lists (see data/SOURCES.md)",
        "selection": "uniform over list, no frequency weights",
        "countries": names,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"countries: {len(names)}, via fallback: {covered}, locales used: {len(locales)}")


if __name__ == "__main__":
    main()
