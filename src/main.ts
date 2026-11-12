import { randomSeed, rngFromSeed } from "./core/rng.ts";
import { createBirth } from "./core/life.ts";
import { applyChoice, advanceYear, createLifeState, pickYearEvents } from "./core/turn.ts";
import { clearLife, loadLife, saveLife } from "./core/save.ts";
import { compassPosition } from "./core/state.ts";
import type { LifeState, Scales } from "./core/state.ts";
import type { Choice, LifeEvent } from "./core/events.ts";
import { EVENTS } from "./content/events.ts";
import { eraName } from "./content/eras.ts";
import type { IndexData, MortData, NamesData } from "./core/types.ts";
import { ru as s } from "./ui/strings.ts";
import { Scene } from "./ui/scene.ts";

interface IncomeData {
  gdp: Record<string, number[]>;
}

type RuNames = Record<string, string>;

function flagEmoji(iso2: string | null): string {
  if (!iso2 || iso2.length !== 2) return "";
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const app = document.querySelector<HTMLElement>("#app")!;
document.title = s.title;

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", undefined, label);
  b.addEventListener("click", onClick);
  return b;
}

function setSeed(seed: string): void {
  const url = new URL(location.href);
  url.searchParams.set("seed", seed);
  history.replaceState(null, "", url);
}

function arrows(effects?: Partial<Scales>): string {
  if (!effects) return "";
  return (Object.keys(effects) as (keyof Scales)[])
    .map((k) => `${s.scales[k]}${(effects[k] ?? 0) >= 0 ? "↑" : "↓"}`)
    .join(" ");
}

function dotsGrid(chance: number): HTMLElement {
  const wrap = el("span", "dots");
  const yes = Math.round(chance * 100);
  for (let i = 0; i < 100; i++) {
    wrap.append(el("i", i < yes ? "on" : undefined));
  }
  const detail = el("span", "risk-detail", ` ${s.riskHint(yes)}. ${s.riskSource}`);
  detail.style.display = "none";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const toggle = () => {
    detail.style.display = detail.style.display === "none" ? "inline" : "none";
  };
  wrap.addEventListener("pointerdown", () => {
    timer = setTimeout(toggle, 600);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    wrap.addEventListener(ev, () => clearTimeout(timer));
  }
  const container = el("span", "risk");
  container.append(el("span", undefined, ` ${s.riskHint(yes)} `), wrap, detail);
  return container;
}

async function main(): Promise<void> {
  app.textContent = s.loading;
  let index: IndexData, names: NamesData, income: IncomeData, ruNames: RuNames;
  try {
    [index, names, income, ruNames] = await Promise.all([
      loadJson<IndexData>("data/index.json"),
      loadJson<NamesData>("data/names.json"),
      loadJson<IncomeData>("data/income.json"),
      loadJson<RuNames>("data/countries_ru.json"),
    ]);
  } catch {
    app.textContent = s.loadError;
    return;
  }

  const mortCache = new Map<string, MortData>();
  const scene = new Scene();
  await scene.load();
  requestAnimationFrame(function loop(t) {
    scene.draw(t);
    requestAnimationFrame(loop);
  });
  async function mortOf(iso3: string): Promise<MortData> {
    let m = mortCache.get(iso3);
    if (!m) {
      m = await loadJson<MortData>(`data/mort/${iso3}.json`);
      mortCache.set(iso3, m);
    }
    return m;
  }

  let state: LifeState;
  let mort: MortData;

  function save(): void {
    saveLife(state);
  }

  function renderScales(): HTMLElement {
    const wrap = el("div", "scales");
    for (const k of Object.keys(s.scales) as (keyof Scales)[]) {
      const row = el("div", "scale-row");
      row.append(el("span", "scale-name", s.scales[k]));
      const bar = el("div", "bar");
      const fill = el("div", `fill fill-${k}`);
      fill.style.width = `${state.scales[k]}%`;
      bar.append(fill);
      row.append(bar);
      wrap.append(row);
    }
    return wrap;
  }

  function renderChoice(event: LifeEvent, choice: Choice, idx: number): HTMLElement {
    const b = button(`${s.sectors[choice.sector]} ${choice.label}`, () => {
      applyChoice(state, event, idx);
      save();
      render();
    });
    const wrap = el("div", "choice");
    wrap.append(b);
    const a = arrows(choice.effects);
    if (a) wrap.append(el("span", "arrows", a));
    if (choice.risk) wrap.append(dotsGrid(choice.risk.chance));
    return wrap;
  }

  function compassAxis(left: string, right: string, value: number): HTMLElement {
    const wrap = el("div", "axis");
    const labels = el("div", "axis-labels");
    labels.append(el("span", undefined, left), el("span", undefined, right));
    const track = el("div", "axis-track");
    track.append(el("div", "axis-center"));
    const marker = el("div", "axis-marker");
    marker.style.left = `${((value + 1) / 2) * 100}%`;
    track.append(marker);
    wrap.append(labels, track);
    if (Math.abs(value) < 0.15) wrap.append(el("div", "axis-note", s.axisBalanced));
    return wrap;
  }

  function renderEnd(): void {
    app.replaceChildren();
    app.append(el("h1", undefined, s.gameOver));
    const year = state.deathYear ?? state.birth.year + state.age;
    const country = `${flagEmoji(state.birth.country.iso2)} ${eraName(state.birth.country.iso3, year, ruNames[state.birth.country.iso3] ?? state.birth.country.name)}`;
    app.append(el("p", undefined, s.diedAt(state.birth.name, state.age, year)));
    app.append(el("p", "meta", country));
    app.append(el("h2", undefined, s.compassTitle));
    app.append(compassAxis(s.axisTradition, s.axisChange, compassPosition(state.compass.tradition, state.compass.choices)));
    app.append(compassAxis(s.axisBonds, s.axisSelf, compassPosition(state.compass.bonds, state.compass.choices)));
    app.append(el("p", "meta", s.choicesMade(state.compass.choices)));
    app.append(el("h2", undefined, s.finalScales));
    app.append(renderScales());
    app.append(el("h2", undefined, s.chronicleTitle));
    const list = el("ol", "chronicle");
    for (const entry of state.chronicle) {
      list.append(el("li", undefined, `${entry.age} лет (${entry.year}): ${entry.text}`));
    }
    app.append(list);
    app.append(button(s.anotherLife, newLife));
  }

  function runQuietYears(): void {
    let guard = 0;
    while (state.alive && guard++ < 150) {
      const events = pickYearEvents(state, EVENTS);
      if (events.length > 0) {
        state.pendingEventIds = events.map((e) => e.id);
        return;
      }
      advanceYear(state, mort);
    }
  }

  function render(): void {
    if (!state.alive) {
      renderEnd();
      return;
    }
    if (state.pendingEventIds.length === 0 && state.lastOutcome === null) runQuietYears();
    save();
    if (!state.alive) {
      renderEnd();
      return;
    }
    app.replaceChildren();
    scene.update(state);
    app.append(scene.element);
    app.append(el("h1", undefined, state.birth.name));
    const year = state.birth.year + state.age;
    const country = `${flagEmoji(state.birth.country.iso2)} ${eraName(state.birth.country.iso3, year, ruNames[state.birth.country.iso3] ?? state.birth.country.name)}`;
    app.append(el("p", "meta", `${country} · ${s.ageYear(state.age, year)}`));
    app.append(renderScales());

    if (state.lastOutcome !== null) {
      app.append(el("p", "outcome", state.lastOutcome));
      app.append(
        button(s.nextYear, () => {
          advanceYear(state, mort);
          save();
          render();
        }),
      );
    } else {
      for (const id of state.pendingEventIds) {
        const event = EVENTS.find((e) => e.id === id)!;
        const card = el("div", "event");
        card.append(el("p", undefined, event.text));
        event.choices.forEach((choice, idx) => card.append(renderChoice(event, choice, idx)));
        app.append(card);
      }
    }
    const seedP = el("p", "seed", `${s.seedLabel} ${location.href}`);
    app.append(seedP);
  }

  async function startLife(seed: string): Promise<void> {
    const saved = loadLife();
    if (saved && saved.seed === seed) {
      state = saved;
      mort = await mortOf(state.birth.country.iso3);
    } else {
      const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
      const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
      const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
      state = createLifeState(seed, birth, gdp);
      mort = await mortOf(birth.country.iso3);
    }
    setSeed(seed);
    render();
  }

  function newLife(): void {
    clearLife();
    void startLife(randomSeed());
  }

  const seedParam = new URL(location.href).searchParams.get("seed");
  const saved = loadLife();
  if (!seedParam && saved && saved.alive) {
    app.replaceChildren();
    app.append(el("h1", undefined, s.title));
    app.append(button(s.continueLife, () => void startLife(saved.seed)));
    app.append(button(s.newLife, newLife));
  } else {
    await startLife(seedParam ?? randomSeed());
  }
}

void main();
