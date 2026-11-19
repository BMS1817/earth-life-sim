export type Climate = "north" | "temperate" | "tropics";

const TROPICS = new Set([
  "BRA", "COL", "VEN", "GUY", "SUR", "GUF", "ECU", "PER", "BOL", "PRY",
  "PAN", "CRI", "NIC", "HND", "SLV", "GTM", "BLZ", "MEX", "CUB", "DOM", "HTI", "JAM",
  "IND", "BGD", "LKA", "MMR", "THA", "LAO", "VNM", "KHM", "MYS", "IDN", "PHL", "PNG",
  "NGA", "GHA", "CIV", "SEN", "MLI", "BFA", "NER", "TCD", "CAF", "CMR", "GAB", "COG",
  "COD", "UGA", "KEN", "TZA", "RWA", "BDI", "SSD", "ETH", "SOM", "GNQ", "GIN", "GNB",
  "SLE", "LBR", "TGO", "BEN", "MDG", "COM", "MUS", "SYC",
]);

const NORTH = new Set([
  "RUS", "CAN", "USA", "SWE", "NOR", "FIN", "ISL", "DNK", "EST", "LVA", "LTU",
  "BLR", "UKR", "POL", "DEU", "GBR", "IRL", "KAZ", "MNG", "GRL",
]);

export function climateForCountry(iso3: string): Climate {
  return TROPICS.has(iso3) ? "tropics" : NORTH.has(iso3) ? "north" : "temperate";
}
