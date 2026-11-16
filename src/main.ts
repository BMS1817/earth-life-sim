import { randomSeed, rngFromSeed, hashSeed } from "./core/rng.ts";
import { createBirth } from "./core/life.ts";
import { applyChoice, createLifeState, eventText, pickConflictEvent, pickFamilyEvent, pickYearEvents, riskChance } from "./core/turn.ts";
import { advanceTimeTick } from "./core/time.ts";
import { addHobby, focusOptions, setActiveHobby, setFocus } from "./core/focus.ts";
import { AUTO_DELAY_MS, HOBBY_IDS, SPEEDS, TICKS_PER_YEAR, YEAR_MS } from "./content/focus.ts";
import type { HobbyId } from "./core/state.ts";
import { conflictForYear, conflictHazard, riskLevel } from "./core/conflicts.ts";
import type { ConflictData } from "./core/conflicts.ts";
import { CONFLICT_EVENTS } from "./content/conflict-events.ts";
import { clearLife, loadLife, saveLife } from "./core/save.ts";
import type { LifeState, Scales } from "./core/state.ts";
import type { Choice, LifeEvent } from "./core/events.ts";
import { EVENTS } from "./content/events.ts";
import { FAMILY_EVENTS } from "./content/family-events.ts";
import { eraName } from "./content/eras.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "./core/types.ts";
import { ru as s } from "./ui/strings.ts";
import { Scene } from "./ui/scene.ts";
import { peopleView } from "./ui/people-view.ts";
import { financeView } from "./ui/finance-view.ts";
import { lifestyleView } from "./ui/lifestyle-view.ts";
import { startPlan } from "./core/plans.ts";
import { adoptPet, buyProperty, buyRental, startBusiness } from "./core/lifestyle.ts";
import type { BusinessKind, LifestyleState } from "./core/state.ts";
import { invest, divest } from "./core/finance.ts";
import type { InvestmentKind } from "./core/finance.ts";
import { memorialView } from "./ui/memorial-view.ts";
import { toggleFavoriteMoment } from "./core/memorial.ts";
import { MAX_FAVORITE_MOMENTS } from "./content/memorial.ts";
import { politicsView } from "./ui/politics-view.ts";
import { attemptUsurpation, holdReferendum, startCampaign, syncPoliticsBaseline } from "./core/politics.ts";
import type { PoliticalLevel, PoliticalPlatform, PoliticsData } from "./core/politics.ts";

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
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function setSeed(seed: string): void {
  const url = new URL(location.href);
  url.searchParams.set("seed", seed);
  history.replaceState(null, "", url);
}

function arrows(effects: Partial<Scales> | undefined, personal: boolean): string {
  if (!effects) return "";
  return (Object.keys(effects) as (keyof Scales)[])
    .map((k) => `${k === "bonds" && personal ? s.personalBonds : s.scales[k]}${(effects[k] ?? 0) >= 0 ? "↑" : "↓"}`)
    .join(" ");
}

function dotsGrid(chance: number): HTMLElement {
  const wrap = el("span", "dots");
  const yes = Math.round(chance * 100);
  for (let i = 0; i < 100; i++) wrap.append(el("i", i < yes ? "on" : undefined));
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
  let index: IndexData, names: NamesData, income: IncomeData, ruNames: RuNames, worldFamily: FamilyData;
  try {
    [index, names, income, ruNames, worldFamily] = await Promise.all([
      loadJson<IndexData>("data/index.json"),
      loadJson<NamesData>("data/names.json"),
      loadJson<IncomeData>("data/income.json"),
      loadJson<RuNames>("data/countries_ru.json"),
      loadJson<FamilyData>("data/family/_world.json"),
    ]);
  } catch {
    app.textContent = s.loadError;
    return;
  }

  const mortCache = new Map<string, MortData>();
  const familyCache = new Map<string, FamilyData>();
  const conflictCache = new Map<string, ConflictData>();
  const politicsCache = new Map<string, PoliticsData>();
  const scene = new Scene();
  await scene.load();
  requestAnimationFrame(function loop(t) {
    const delta = lastFrame === 0 ? 0 : Math.min(250, t - lastFrame);
    lastFrame = t;
    if (state?.alive && !manualPaused && !peopleOpen && !financeOpen && !lifestyleOpen && !memorialOpen && !politicsOpen && !document.hidden) {
      if (!hasDecision()) {
        elapsed += delta * state.time.speed;
        const tickMs = YEAR_MS / TICKS_PER_YEAR;
        while (elapsed >= tickMs) {
          elapsed -= tickMs;
          if (advanceTimeTick(state, mort, family, names, conflict, gdpForYear(state.birth.year + state.age), politics)) schedulePendingEvents();
          save();
          render();
          break;
        }
      }
      updateAuto(t);
    }
    scene.draw(t);
    requestAnimationFrame(loop);
  });
  document.addEventListener("visibilitychange", () => {
    lastFrame = 0;
    if (document.hidden && state) save();
  });
  window.addEventListener("beforeunload", () => {
    if (state) save();
  });
  async function mortOf(iso3: string): Promise<MortData> {
    let m = mortCache.get(iso3);
    if (!m) {
      m = await loadJson<MortData>(`data/mort/${iso3}.json`);
      mortCache.set(iso3, m);
    }
    return m;
  }
  async function familyOf(iso3: string): Promise<FamilyData> {
    let f = familyCache.get(iso3);
    if (!f) {
      f = await loadJson<FamilyData>(`data/family/${iso3}.json`);
      familyCache.set(iso3, f);
    }
    return f;
  }
  async function conflictOf(iso3: string): Promise<ConflictData> {
    let c = conflictCache.get(iso3);
    if (!c) {
      c = await loadJson<ConflictData>(`data/conflicts/${iso3}.json`);
      conflictCache.set(iso3, c);
    }
    return c;
  }
  async function politicsOf(iso3: string): Promise<PoliticsData> {
    let p = politicsCache.get(iso3);
    if (!p) {
      p = await loadJson<PoliticsData>(`data/politics/${iso3}.json`);
      politicsCache.set(iso3, p);
    }
    return p;
  }
  function gdpForYear(year: number): number {
    const table = income.gdp[state.birth.country.iso3] ?? income.gdp._world;
    return table[Math.min(year, 2022) - 1950];
  }

  let state: LifeState;
  let mort: MortData;
  let family: FamilyData;
  let conflict: ConflictData;
  let politics: PoliticsData;
  let peopleOpen = false;
  let financeOpen = false;
  let lifestyleOpen = false;
  let memorialOpen = false;
  let politicsOpen = false;
  let selectedPersonId: string | null = null;
  let legacyNotice = false;
  let manualPaused = false;
  let elapsed = 0;
  let lastFrame = 0;
  let autoDeadline = 0;

  function save(): void {
    saveLife(state);
  }

  function renderScales(): HTMLElement {
    const wrap = el("div", "scales");
    for (const k of Object.keys(s.scales) as (keyof typeof s.scales)[]) {
      const row = el("div", "scale-row");
      row.append(el("span", "scale-name", s.scales[k]));
      const bar = el("div", "bar");
      const fill = el("div", `fill fill-${k}`);
      fill.style.width = `${k === "happiness" ? state.happiness : state.scales[k]}%`;
      bar.append(fill);
      row.append(bar);
      wrap.append(row);
    }
    return wrap;
  }

  function renderTimeControls(): HTMLElement {
    const wrap = el("section", "time-controls");
    const row = el("div", "time-buttons");
    row.append(button(manualPaused ? s.timeResume : s.timePause, () => {
      manualPaused = !manualPaused;
      autoDeadline = 0;
      render();
    }));
    for (const speed of SPEEDS) {
      const speedButton = button(`${speed}×`, () => {
        state.time.speed = speed;
        save();
        render();
      });
      if (state.time.speed === speed) speedButton.classList.add("active");
      row.append(speedButton);
    }
    row.append(button(s.timeSkip, skipToDecision));
    row.append(button(state.time.auto ? s.timeAutoOn : s.timeAutoOff, () => {
      state.time.auto = !state.time.auto;
      autoDeadline = 0;
      save();
      render();
    }));
    const progress = el("div", "year-progress");
    const fill = el("span", "year-progress-fill");
    fill.style.width = `${(state.time.tick / TICKS_PER_YEAR) * 100}%`;
    progress.append(fill);
    wrap.append(row, progress, el("div", "time-note", s.timeYearSeconds(state.time.speed)));
    return wrap;
  }

  function renderFocus(): HTMLElement {
    const wrap = el("section", "focus-panel");
    wrap.append(el("h2", undefined, s.focusTitle));
    const options = el("div", "focus-options");
    for (const id of focusOptions(state)) {
      const option = button(`${s.focuses[id].label} ${s.focuses[id].detail}`, () => {
        setFocus(state, id);
        save();
        render();
      });
      option.className = `focus-option${state.focus.current === id ? " active" : ""}`;
      options.append(option);
    }
    wrap.append(options);
    return wrap;
  }

  function renderHobbies(): HTMLElement {
    const wrap = el("section", "hobbies-panel");
    wrap.append(el("h2", undefined, s.hobbiesTitle));
    if (state.hobbies.length === 0) wrap.append(el("p", "muted", s.hobbyEmpty));
    const list = el("div", "hobby-list");
    for (const hobby of state.hobbies) {
      const active = state.activeHobbyId === hobby.id;
      const label = `${s.hobbies[hobby.id]} · ${s.hobbyLevel(hobby.level)} · ${s.hobbyXp(hobby.xp)}${active ? ` · ${s.hobbyActive}` : ""}`;
      const item = button(active ? label : `${label} · ${s.hobbyMakeActive}`, () => {
        setActiveHobby(state, hobby.id);
        save();
        render();
      });
      item.className = `hobby-item${active ? " active" : ""}`;
      list.append(item);
    }
    wrap.append(list);
    if (state.age >= 5 && state.hobbies.length < 3) {
      const select = el("select", "hobby-select");
      for (const id of HOBBY_IDS.filter((id) => !state.hobbies.some((hobby) => hobby.id === id))) {
        const option = el("option", undefined, s.hobbies[id]);
        option.value = id;
        select.append(option);
      }
      const add = button(s.hobbyAdd, () => {
        addHobby(state, select.value as HobbyId);
        save();
        render();
      });
      const row = el("div", "hobby-add");
      row.append(select, add);
      wrap.append(row);
    }
    return wrap;
  }

  function renderChoice(event: LifeEvent, choice: Choice, idx: number): HTMLElement {
    const b = button(`${s.sectors[choice.sector]} ${choice.label}`, () => {
      autoDeadline = 0;
      applyChoice(state, event, idx, names, conflict);
      save();
      render();
    });
    b.className = `btn-${choice.sector}`;
    const wrap = el("div", "choice");
    wrap.append(b);
    const a = arrows(choice.effects, Boolean(event.subject || event.family));
    if (a) wrap.append(el("span", "arrows", a));
    if (choice.risk) wrap.append(dotsGrid(riskChance(state, event, choice)));
    return wrap;
  }

  function openPeople(): void {
    peopleOpen = true;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openFinance(): void {
    financeOpen = true;
    peopleOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openLifestyle(): void {
    lifestyleOpen = true;
    peopleOpen = false;
    financeOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openMemorial(): void {
    memorialOpen = true;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openPolitics(): void {
    politicsOpen = true;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function countryName(): string {
    const year = state.deathYear ?? state.birth.year + state.age;
    return `${flagEmoji(state.birth.country.iso2)} ${eraName(state.birth.country.iso3, year, ruNames[state.birth.country.iso3] ?? state.birth.country.name)}`;
  }

  function renderMemorial(onBack: (() => void) | null): void {
    app.replaceChildren(memorialView(state, scene, {
      countryName: countryName(),
      onBack,
      onPeople: openPeople,
      onFinance: openFinance,
      onNewLife: state.alive ? null : newLife,
      onToggle: (index) => {
        const scroll = window.scrollY;
        if (toggleFavoriteMoment(state, index)) save();
        render();
        window.scrollTo(0, scroll);
      },
    }));
  }

  function renderEnd(): void {
    memorialOpen = false;
    renderMemorial(null);
  }

  function schedulePendingEvents(): void {
    if (!state.alive || hasDecision()) return;
    const events = pickYearEvents(state, EVENTS);
    if (events.length > 0) {
      state.pendingEventIds = events.map((e) => e.id);
      return;
    }
    const conflictEvent = pickConflictEvent(state, conflict);
    if (conflictEvent) {
      state.war.pendingEventId = conflictEvent.id;
      return;
    }
    const familyEvent = pickFamilyEvent(state, FAMILY_EVENTS);
    if (familyEvent) state.pendingFamilyEventId = familyEvent.id;
  }

  function hasDecision(): boolean {
    return state.lastOutcome !== null || state.pendingEventIds.length > 0 || state.pendingFamilyEventId !== null || state.war.pendingEventId !== null;
  }

  function skipToDecision(): void {
    manualPaused = false;
    let guard = 0;
    while (state.alive && !hasDecision() && guard++ < 150 * TICKS_PER_YEAR) {
      if (advanceTimeTick(state, mort, family, names, conflict, gdpForYear(state.birth.year + state.age), politics)) schedulePendingEvents();
    }
    autoDeadline = 0;
    save();
    render();
  }

  function importantEvent(event: LifeEvent): boolean {
    return Boolean(
      event.milestone ||
      event.crisis ||
      event.conflict ||
      event.id === "after-school" ||
      event.choices.some((choice) => choice.career || choice.action === "haveChild" || choice.action === "mortgage"),
    );
  }

  type AutoAction = { kind: "choice"; event: LifeEvent; index: number } | { kind: "continue" };

  function currentAutoAction(): AutoAction | null {
    if (!state.time.auto || manualPaused || peopleOpen || financeOpen || lifestyleOpen || memorialOpen || politicsOpen) return null;
    if (state.lastOutcome !== null) return state.lastOutcomeKind === "conflict" ? null : { kind: "continue" };
    if (state.war.pendingEventId) return null;
    if (state.pendingFamilyEventId) {
      const event = FAMILY_EVENTS.find((item) => item.id === state.pendingFamilyEventId);
      return event && !importantEvent(event) ? { kind: "choice", event, index: hashSeed(`${state.seed}:${state.age}:${event.id}:auto`) % event.choices.length } : null;
    }
    if (state.pendingEventIds.length > 0) {
      const event = EVENTS.find((item) => item.id === state.pendingEventIds[0]);
      return event && !importantEvent(event) ? { kind: "choice", event, index: hashSeed(`${state.seed}:${state.age}:${event.id}:auto`) % event.choices.length } : null;
    }
    return null;
  }

  function updateAuto(now: number): void {
    const action = currentAutoAction();
    const countdown = document.querySelector<HTMLElement>(".auto-countdown");
    if (!action) {
      autoDeadline = 0;
      if (countdown) countdown.textContent = "";
      return;
    }
    if (autoDeadline === 0) autoDeadline = now + AUTO_DELAY_MS;
    const seconds = Math.max(0, Math.ceil((autoDeadline - now) / 1000));
    if (countdown) countdown.textContent = s.autoCountdown(seconds);
    if (now < autoDeadline) return;
    autoDeadline = 0;
    if (action.kind === "choice") applyChoice(state, action.event, action.index, names, conflict);
    else {
      continueAfterOutcome();
      return;
    }
    save();
    render();
  }

  function continueAfterOutcome(): void {
    if (state.lastOutcomeKind === "life") {
      const conflictEvent = pickConflictEvent(state, conflict);
      if (conflictEvent) {
        state.war.pendingEventId = conflictEvent.id;
        state.lastOutcome = null;
        state.lastOutcomeKind = null;
        state.lastArrows = null;
        save();
        render();
        return;
      }
      const familyEvent = pickFamilyEvent(state, FAMILY_EVENTS);
      if (familyEvent) {
        state.pendingFamilyEventId = familyEvent.id;
        state.lastOutcome = null;
        state.lastOutcomeKind = null;
        state.lastArrows = null;
        save();
        render();
        return;
      }
    }
    state.lastOutcome = null;
    state.lastOutcomeKind = null;
    state.lastArrows = null;
    save();
    render();
  }

  function renderEvent(event: LifeEvent): void {
    const card = el("div", `event${event.family ? " family-event" : event.conflict ? " conflict-event" : ""}`);
    if (event.family) card.append(el("div", "event-kicker", s.familySceneLabel));
    if (event.conflict) card.append(el("div", "event-kicker", s.conflictSceneLabel));
    card.append(el("p", undefined, eventText(state, event)));
    if (event.conflict) {
      const year = state.birth.year + state.age;
      const row = conflictForYear(conflict, state.seed, year);
      if (row) {
        const base = mort.q[state.birth.sex][Math.min(year, 2100) - 1950][Math.min(state.age, 100)] / mort.scale;
        card.append(el("div", "war-risk", s.warRisk[riskLevel(conflictHazard(row).civilian, base)]));
        card.append(el("div", "war-source", s.warSource[row.source]));
      }
    }
    if (state.time.auto && !importantEvent(event)) card.append(el("p", "auto-countdown", s.autoCountdown(Math.ceil(AUTO_DELAY_MS / 1000))));
    event.choices.forEach((choice, idx) => card.append(renderChoice(event, choice, idx)));
    app.append(card);
  }

  function render(): void {
    if (lifestyleOpen) {
      app.replaceChildren(lifestyleView(state, {
        onBack: () => {
          lifestyleOpen = false;
          window.scrollTo(0, 0);
          render();
        },
        onPlan: (kind, dreamCareer) => {
          startPlan(state, kind, dreamCareer);
          save();
          render();
        },
        onPet: (kind) => {
          adoptPet(state, kind);
          save();
          render();
        },
        onProperty: (id) => {
          buyProperty(state, id);
          save();
          render();
        },
        onRental: () => {
          buyRental(state);
          save();
          render();
        },
        onBusiness: (kind: BusinessKind) => {
          startBusiness(state, kind);
          save();
          render();
        },
        onToggle: (key, value) => {
          state.lifestyle[key] = value;
          save();
          render();
        },
        onNutrition: (value: LifestyleState["nutrition"]) => {
          state.lifestyle.nutrition = value;
          save();
          render();
        },
      }));
      return;
    }
    if (financeOpen) {
      app.replaceChildren(financeView(state, {
        onBack: () => {
          financeOpen = false;
          window.scrollTo(0, 0);
          render();
        },
        onInvest: (kind: InvestmentKind, buy: boolean) => {
          const year = state.birth.year + state.age;
          if (buy) invest(state.finance, kind, 100, year);
          else divest(state.finance, kind, 100, year);
          save();
          render();
        },
      }));
      return;
    }
    if (peopleOpen) {
      app.replaceChildren(peopleView(state, scene, {
        selectedId: selectedPersonId,
        onBack: () => {
          peopleOpen = false;
          selectedPersonId = null;
          window.scrollTo(0, 0);
          render();
        },
        onSelect: (id) => {
          selectedPersonId = id;
          window.scrollTo(0, 0);
          render();
        },
      }));
      return;
    }
    if (politicsOpen) {
      app.replaceChildren(politicsView(state, politics, {
        baseGdp: gdpForYear(state.birth.year + state.age),
        onBack: () => {
          politicsOpen = false;
          window.scrollTo(0, 0);
          render();
        },
        onPlan: () => {
          startPlan(state, "localPolitics");
          save();
          render();
        },
        onCampaign: (level: PoliticalLevel, platform: PoliticalPlatform) => {
          startCampaign(state, politics, level, platform);
          save();
          render();
        },
        onReferendum: (field, value) => {
          holdReferendum(state, politics, field, value);
          save();
          render();
        },
        onUsurpation: () => {
          attemptUsurpation(state, politics);
          save();
          render();
        },
      }));
      return;
    }
    if (memorialOpen) {
      renderMemorial(() => {
        memorialOpen = false;
        window.scrollTo(0, 0);
        render();
      });
      return;
    }
    if (!state.alive) {
      renderEnd();
      return;
    }
    save();
    if (!state.alive) {
      renderEnd();
      return;
    }
    app.replaceChildren();
    scene.update(state);
    app.append(renderTimeControls());
    app.append(scene.element);
    app.append(el("h1", undefined, state.birth.name));
    const year = state.birth.year + state.age;
    const country = `${flagEmoji(state.birth.country.iso2)} ${eraName(state.birth.country.iso3, year, ruNames[state.birth.country.iso3] ?? state.birth.country.name)}`;
    app.append(el("p", "meta", `${country} · ${s.ageYear(state.age, year)}`));
    if (state.war.displacedUntil !== null) app.append(el("p", "displaced", s.displacedStatus(state.war.displacedUntil)));
    app.append(button(s.peopleButton(state.people.filter((p) => p.alive && p.status === "active").length), openPeople));
    app.append(button(`${s.financeButton} · ${s.money(state.finance.cash)}`, openFinance));
    app.append(button(s.lifestyleButton, openLifestyle));
    app.append(button(s.politicsButton, openPolitics));
    app.append(button(s.momentsButton(state.favoriteMomentIndexes.length, MAX_FAVORITE_MOMENTS), openMemorial));
    app.append(renderScales());
    app.append(renderFocus());
    app.append(renderHobbies());
    if (legacyNotice) {
      app.append(el("p", "notice", s.legacyReset));
      legacyNotice = false;
    }
    if (state.peopleNews.length > 0) {
      const news = el("section", "people-news");
      news.append(el("h2", undefined, s.newsTitle));
      for (const item of state.peopleNews) news.append(el("p", undefined, item.text));
      app.append(news);
    }
    if (state.lastOutcome !== null) {
      app.append(el("p", "outcome", state.lastOutcome));
      const label = state.lastOutcomeKind === "life" && pickConflictEvent(state, conflict)
        ? s.nextConflictScene
        : state.lastOutcomeKind === "life" && pickFamilyEvent(state, FAMILY_EVENTS)
          ? s.nextFamilyScene
          : s.nextYear;
      app.append(button(label, continueAfterOutcome));
    } else if (state.war.pendingEventId) {
      const event = CONFLICT_EVENTS.find((e) => e.id === state.war.pendingEventId);
      if (event) renderEvent(event);
    } else if (state.pendingFamilyEventId) {
      const event = FAMILY_EVENTS.find((e) => e.id === state.pendingFamilyEventId);
      if (event) renderEvent(event);
    } else {
      for (const id of state.pendingEventIds) {
        const event = EVENTS.find((e) => e.id === id);
        if (event) renderEvent(event);
      }
    }
    app.append(el("p", "seed", `${s.seedLabel} ${location.href}`));
  }

  async function startLife(seed: string): Promise<void> {
    const saved = loadLife((birth, age) => {
      const table = income.gdp[birth.country.iso3] ?? income.gdp._world;
      return table[Math.min(birth.year + age, 2022) - 1950];
    }).state;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    manualPaused = false;
    elapsed = 0;
    lastFrame = 0;
    autoDeadline = 0;
    if (saved && saved.seed === seed) {
      state = saved;
      [mort, family, conflict, politics] = await Promise.all([mortOf(state.birth.country.iso3), familyOf(state.birth.country.iso3), conflictOf(state.birth.country.iso3), politicsOf(state.birth.country.iso3)]);
      syncPoliticsBaseline(state, politics, state.birth.year + state.age);
    } else {
      const birth = createBirth(rngFromSeed(`${seed}:birth`), index, names);
      const gdpTable = income.gdp[birth.country.iso3] ?? income.gdp._world;
      const gdp = gdpTable[Math.min(birth.year, 2022) - 1950];
      [mort, family, conflict, politics] = await Promise.all([mortOf(birth.country.iso3), familyOf(birth.country.iso3), conflictOf(birth.country.iso3), politicsOf(birth.country.iso3)]);
      state = createLifeState(seed, birth, gdp, family, names, worldFamily, politics);
    }
    setSeed(seed);
    window.scrollTo(0, 0);
    render();
  }

  function newLife(): void {
    clearLife();
    void startLife(randomSeed());
  }

  const seedParam = new URL(location.href).searchParams.get("seed");
  const initialLoad = loadLife((birth, age) => {
    const table = income.gdp[birth.country.iso3] ?? income.gdp._world;
    return table[Math.min(birth.year + age, 2022) - 1950];
  });
  legacyNotice = initialLoad.legacyDiscarded;
  const saved = initialLoad.state;
  if (!seedParam && saved) {
    app.replaceChildren();
    app.append(el("h1", undefined, s.title));
    app.append(button(saved.alive ? s.continueLife : s.memorialContinue, () => void startLife(saved.seed)));
    app.append(button(s.newLife, newLife));
  } else {
    await startLife(seedParam ?? randomSeed());
  }
}

void main();
