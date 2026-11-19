import { readFileSync, writeFileSync } from "node:fs";

const index = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const russian = JSON.parse(readFileSync("public/data/countries_ru.json", "utf-8"));
const display = new Intl.DisplayNames(["en"], { type: "region" });
const result = {};
for (const country of index.countries) {
  if (country.iso2) result[country.iso3] = display.of(country.iso2);
  else if (country.iso3 === "X412") result[country.iso3] = "Kosovo";
  else result[country.iso3] = country.name;
}
result.X412 = "Kosovo";
const source = `export const COUNTRIES_EN: Record<string, string> = ${JSON.stringify(result, null, 2)};\n`;
writeFileSync("src/content/en/countries.ts", source);
console.log(`Названия стран: ${Object.keys(result).length}, русских имён в исходнике: ${Object.keys(russian).length}`);
