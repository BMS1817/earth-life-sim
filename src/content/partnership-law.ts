const SAME_SEX_MARRIAGE_YEAR: Record<string, number> = {
  NLD: 2001, BEL: 2003, ESP: 2005, CAN: 2005, ZAF: 2006,
  NOR: 2009, SWE: 2009, PRT: 2010, ISL: 2010, ARG: 2010,
  DNK: 2012, BRA: 2013, FRA: 2013, URY: 2013, NZL: 2013,
  GBR: 2014, LUX: 2015, IRL: 2015, USA: 2015, COL: 2016,
  FIN: 2017, MLT: 2017, DEU: 2017, AUS: 2017, AUT: 2019,
  ECU: 2019, TWN: 2019, CRI: 2020, CHE: 2022, CHL: 2022,
  MEX: 2022, SVN: 2022, CUB: 2022, AND: 2023, EST: 2024,
  GRC: 2024, LIE: 2025, THA: 2025,
  ABW: 2024, CUW: 2024, BES: 2012, GRL: 2016, FRO: 2017,
  IMN: 2016, GIB: 2016, FLK: 2017, GGY: 2017, JEY: 2018,
  SHN: 2017, PCN: 2015, GUM: 2015, MNP: 2015, VIR: 2015,
  PRI: 2015, SGS: 2014, IOT: 2014, ATA: 2016,
  GUF: 2013, GLP: 2013, MTQ: 2013, REU: 2013, MYT: 2013,
  SPM: 2013, WLF: 2013, PYF: 2013, NCL: 2013,
};

const SAME_SEX_MARRIAGE_INTERVALS: Record<string, [number, number][]> = {
  BMU: [[2017, 2017], [2018, 2021]],
};

export function canRegisterMarriage(iso3: string, year: number, sameSex: boolean): boolean {
  if (!sameSex) return true;
  const intervals = SAME_SEX_MARRIAGE_INTERVALS[iso3];
  if (intervals) return intervals.some(([from, to]) => year >= from && year <= to);
  const from = SAME_SEX_MARRIAGE_YEAR[iso3];
  return from !== undefined && year >= from;
}
