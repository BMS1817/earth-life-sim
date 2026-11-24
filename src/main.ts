import { randomSeed, rngFromSeed } from "./core/rng.ts";
import { createBirth } from "./core/life.ts";
import { applyChoice, createLifeState, eventText, riskChance } from "./core/turn.ts";
import { completeYear, hasDecision, pendingEvent, scheduleFollowUpAfterChoice } from "./core/flow.ts";
import { addHobby, focusOptions, setActiveHobby, setFocus } from "./core/focus.ts";
import { HOBBY_IDS } from "./content/focus.ts";
import type { HobbyId } from "./core/state.ts";
import { conflictForYear, conflictHazard, riskLevel } from "./core/conflicts.ts";
import type { ConflictData } from "./core/conflicts.ts";
import { clearLife, loadLife, parseLifeDetailed, saveLife, serializeLife } from "./core/save.ts";
import type { LifeState, Scales } from "./core/state.ts";
import type { Choice, LifeEvent } from "./core/events.ts";
import { eraName } from "./content/eras.ts";
import { COUNTRIES_EN } from "./content/en/countries.ts";
import type { FamilyData, IndexData, MortData, NamesData } from "./core/types.ts";
import { s, t } from "./ui/strings.ts";
import { getLanguage, setLanguage } from "./i18n.ts";
import { RebrandScene } from "./ui/rebrand-scene.ts";
import { replaceRebrandArt } from "./ui/rebrand-art.ts";
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
import { lineageView } from "./ui/lineage-view.ts";
import { inheritLife } from "./core/inheritance.ts";
import { isStandaloneBuild, resourceUrl } from "./ui/resource.ts";
import { RebrandAudio } from "./ui/rebrand-audio.ts";

interface IncomeData {
  gdp: Record<string, number[]>;
}

type RuNames = Record<string, string>;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function flagEmoji(iso2: string | null): string {
  if (!iso2 || iso2.length !== 2) return "";
  return String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const app = document.querySelector<HTMLElement>("#app")!;
document.documentElement.lang = getLanguage();
document.title = s.title;

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(resourceUrl(url));
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

function switchLanguage(): void {
  setLanguage(getLanguage() === "ru" ? "en" : "ru");
  location.reload();
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
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "button");
  wrap.setAttribute("aria-label", s.riskSource);
  wrap.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    wrap.addEventListener(ev, () => clearTimeout(timer));
  }
  const container = el("span", "risk");
  container.append(el("span", undefined, ` ${s.riskHint(yes)} `), wrap, detail);
  return container;
}

type CountryBundleIndex = { kinds: Record<string, { countries: Record<string, number> }> };

async function main(): Promise<void> {
  app.textContent = s.loading;
  let index: IndexData, names: NamesData, income: IncomeData, ruNames: RuNames, worldFamily: FamilyData;
  let bundleIndex: CountryBundleIndex | null = null;
  try {
    [index, names, income, ruNames, worldFamily, bundleIndex] = await Promise.all([
      loadJson<IndexData>("data/index.json"),
      loadJson<NamesData>("data/names.json"),
      loadJson<IncomeData>("data/income.json"),
      loadJson<RuNames>("data/countries_ru.json"),
      loadJson<FamilyData>("data/family/_world.json"),
      import.meta.env.PROD ? loadJson<CountryBundleIndex>("data/bundles/index.json") : Promise.resolve(null),
    ]);
  } catch {
    app.textContent = s.loadError;
    return;
  }

  const mortCache = new Map<string, MortData>();
  const familyCache = new Map<string, FamilyData>();
  const conflictCache = new Map<string, ConflictData>();
  const politicsCache = new Map<string, PoliticsData>();
  const bundleCache = new Map<string, Record<string, unknown>>();
  const scene = new RebrandScene();
  scene.element.setAttribute("role", "img");
  scene.element.setAttribute("aria-label", s.sceneAlt);
  requestAnimationFrame(function loop(t) {
    scene.draw(t);
    requestAnimationFrame(loop);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state) save();
  });
  window.addEventListener("beforeunload", () => {
    if (state) save();
  });
  async function countryOf<T>(kind: string, iso3: string): Promise<T> {
    if (!bundleIndex) return loadJson<T>(`data/${kind}/${iso3}.json`);
    const chunk = bundleIndex.kinds[kind]?.countries[iso3];
    if (chunk === undefined) throw new Error(`Страна отсутствует в индексе данных: ${iso3}`);
    const key = `${kind}/${chunk}`;
    let bundle = bundleCache.get(key);
    if (!bundle) {
      bundle = await loadJson<Record<string, unknown>>(`data/bundles/${key}.json`);
      bundleCache.set(key, bundle);
    }
    const data = bundle[iso3];
    if (data === undefined) throw new Error(`Страна отсутствует в пакете данных: ${key}/${iso3}`);
    return data as T;
  }
  async function mortOf(iso3: string): Promise<MortData> {
    let m = mortCache.get(iso3);
    if (!m) {
      m = await countryOf<MortData>("mort", iso3);
      mortCache.set(iso3, m);
    }
    return m;
  }
  async function familyOf(iso3: string): Promise<FamilyData> {
    let f = familyCache.get(iso3);
    if (!f) {
      f = await countryOf<FamilyData>("family", iso3);
      familyCache.set(iso3, f);
    }
    return f;
  }
  async function conflictOf(iso3: string): Promise<ConflictData> {
    let c = conflictCache.get(iso3);
    if (!c) {
      c = await countryOf<ConflictData>("conflicts", iso3);
      conflictCache.set(iso3, c);
    }
    return c;
  }
  async function politicsOf(iso3: string): Promise<PoliticsData> {
    let p = politicsCache.get(iso3);
    if (!p) {
      p = await countryOf<PoliticsData>("politics", iso3);
      politicsCache.set(iso3, p);
    }
    return p;
  }
  function gdpForYear(year: number): number {
    const table = income.gdp[state.birth.country.iso3] ?? income.gdp._world;
    return table[Math.min(year, 2022) - 1950];
  }

  const audio = new RebrandAudio();
  let deathAudioYear: number | null = null;
  document.addEventListener("pointerdown", () => audio.ensureMusic());
  document.addEventListener("keydown", () => audio.ensureMusic());
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
  let lineageOpen = false;
  let selectedPersonId: string | null = null;
  let legacyNotice = false;
  let recoveryNotice = false;
  let saveWriteFailed = false;
  let saveErrorAudioPlayed = false;
  let installPrompt: InstallPromptEvent | null = null;
  let mobileTab: "event" | "hero" | "focus" | "menu" = "event";
  let offlineStatus: string = s.offlineWaiting;

  function save(): void {
    saveWriteFailed = !saveLife(state);
    if (saveWriteFailed && !saveErrorAudioPlayed) audio.play("error");
    saveErrorAudioPlayed = saveWriteFailed;
  }

  function updateOfflineStatus(text: string): void {
    offlineStatus = text;
    const node = document.querySelector<HTMLElement>(".offline-status");
    if (node) node.textContent = text;
  }

  function lockPortrait(): void {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const orientation = window.screen.orientation as (ScreenOrientation & { lock?: (value: "portrait") => Promise<void> }) | undefined;
    if (orientation?.lock) void orientation.lock("portrait").catch(() => undefined);
  }

  function setupOffline(): void {
    if (isStandaloneBuild()) {
      updateOfflineStatus(s.offlineStandalone);
      return;
    }
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event as InstallPromptEvent;
      if (state) render();
    });
    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      if (state) render();
    });
    if (!("serviceWorker" in navigator) || location.protocol === "file:") {
      updateOfflineStatus(s.offlineError);
      return;
    }
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data as { type?: string; loaded?: number; total?: number };
      if (data.type === "earth:cache-progress") updateOfflineStatus(s.offlinePreparing(data.loaded ?? 0, data.total ?? 0));
      if (data.type === "earth:cache-ready") updateOfflineStatus(s.offlineReady);
    });
    const register = () => {
      if (!navigator.onLine && navigator.serviceWorker.controller) {
        updateOfflineStatus(s.offlineReady);
        return;
      }
      void navigator.serviceWorker.register("sw.js").then(() => {
        if (navigator.serviceWorker.controller) updateOfflineStatus(s.offlineReady);
      }).catch(() => updateOfflineStatus(s.offlineError));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
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

  function renderTransferControls(currentLife: () => LifeState | null): HTMLElement {
    const wrap = el("section", "save-transfer");
    const row = el("div", "time-buttons");
    const input = el("input", "save-import-input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    row.append(button(s.exportSave, () => {
      const exported = currentLife();
      if (!exported) return;
      const blob = new Blob([serializeLife(exported)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = el("a");
      const safeName = exported.birth.name.replace(/[^\p{L}\p{N}_-]+/gu, "-");
      link.href = url;
      link.download = `earth-${safeName}-g${exported.lineage.generation}-age${exported.age}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }));
    row.append(button(s.importSave, () => input.click()));
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      if (file.size > 2_000_000) {
        window.alert(s.importError);
        return;
      }
      void file.text().then(async (raw) => {
        const result = parseLifeDetailed(raw);
        if (!result.state) {
          window.alert(result.error === "newer" ? s.importNewer : s.importError);
          return;
        }
        const imported = result.state;
        if (currentLife() && !window.confirm(s.importConfirm)) return;
        if (!saveLife(imported)) {
          saveWriteFailed = true;
          window.alert(s.importWriteError);
          return;
        }
        await startLife(imported.seed);
      }).catch(() => window.alert(s.importError));
    });
    wrap.append(row, input);
    return wrap;
  }

  function renderSettingsControls(): HTMLElement {
    const wrap = el("section", "time-controls settings-controls");
    const row = el("div", "time-buttons");
    row.append(button(`${s.softenLabel}: ${s.softenState(state.softenHeavy)}`, () => {
      state.softenHeavy = !state.softenHeavy;
      save();
      render();
    }));
    row.append(button(s.language, () => {
      audio.play("button");
      switchLanguage();
    }));
    if (installPrompt) row.append(button(s.installApp, () => {
      const prompt = installPrompt;
      installPrompt = null;
      if (prompt) void prompt.prompt();
      render();
    }));
    const audioRow = el("div", "time-buttons audio-controls");
    audioRow.append(button(s.soundToggle(audio.isEnabled), () => {
      audio.setEnabled(!audio.isEnabled);
      if (audio.isEnabled) audio.play("choice");
      render();
    }));
    const preview = button(s.soundPreview, () => audio.play("choice"));
    preview.disabled = !audio.isEnabled;
    audioRow.append(preview);
    const volumeLabel = el("label", "audio-volume");
    volumeLabel.append(el("span", undefined, s.soundVolume));
    const volume = el("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "100";
    volume.step = "5";
    volume.value = String(audio.volumePercent);
    volume.disabled = !audio.isEnabled;
    volume.setAttribute("aria-label", s.soundVolume);
    const volumeValue = el("output", undefined, `${audio.volumePercent}%`);
    volume.addEventListener("input", () => {
      audio.setVolume(Number(volume.value) / 100);
      volumeValue.value = `${audio.volumePercent}%`;
    });
    volumeLabel.append(volume, volumeValue);
    audioRow.append(volumeLabel);
    const musicRow = el("div", "time-buttons audio-controls music-controls");
    musicRow.append(button(s.musicToggle(audio.musicIsEnabled), () => {
      audio.setMusicEnabled(!audio.musicIsEnabled);
      render();
    }));
    const musicLabel = el("label", "audio-volume");
    musicLabel.append(el("span", undefined, s.musicVolume));
    const musicVolume = el("input");
    musicVolume.type = "range";
    musicVolume.min = "0";
    musicVolume.max = "100";
    musicVolume.step = "5";
    musicVolume.value = String(audio.musicVolumePercent);
    musicVolume.disabled = !audio.musicIsEnabled;
    musicVolume.setAttribute("aria-label", s.musicVolume);
    const musicValue = el("output", undefined, `${audio.musicVolumePercent}%`);
    musicVolume.addEventListener("input", () => {
      audio.setMusicVolume(Number(musicVolume.value) / 100);
      musicValue.value = `${audio.musicVolumePercent}%`;
    });
    musicLabel.append(musicVolume, musicValue);
    musicRow.append(musicLabel);
    wrap.append(row, audioRow, musicRow, renderTransferControls(() => state), el("p", "offline-status", offlineStatus));
    const guide = el("details", "menu-guide");
    guide.append(el("summary", undefined, s.guideTitle), el("p", "muted", s.guideText));
    wrap.append(guide);
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
    if (state.hobbies.length === 0) {
      wrap.append(el("p", "muted", s.hobbyEmpty));
      const guide = el("div", "hobby-guide");
      for (const id of HOBBY_IDS.slice(0, 3)) guide.append(el("span", "room-item", `${s.hobbies[id]} · ${s.hobbyEffects[id]}`));
      wrap.append(guide);
    }
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

  function renderDashboard(): HTMLElement {
    const root = el("div", "quiet-dashboard");
    const work = el("section", "dashboard-card");
    work.append(el("h2", undefined, s.dashboardWork));
    work.append(el("p", undefined, state.finance.career ? `${s.careers[state.finance.career]} · ${s.employment[state.finance.employment]}` : s.employment[state.finance.employment]));
    work.append(el("h3", undefined, s.dashboardPlan));
    work.append(el("p", "muted", state.plan ? `${s.planStart[state.plan.kind]} · ${s.planRemaining(state.plan.remainingYears)}` : s.planNone));

    const money = el("section", "dashboard-card");
    money.append(el("h2", undefined, s.dashboardBalance));
    money.append(el("p", undefined, `${s.financeCash}: ${s.money(state.finance.cash)}`));
    money.append(el("p", "muted", `${s.financeNetYear}: ${s.money(state.finance.lastYearNet)}`));

    const memory = el("section", "dashboard-card dashboard-memory");
    memory.append(el("h2", undefined, s.dashboardLastMoment));
    const last = state.chronicle.at(-1);
    memory.append(el("p", undefined, last ? `${s.ageYear(last.age, last.year)}: ${t(last.text)}` : s.dashboardNoMoment));

    const progress = el("section", "dashboard-card");
    progress.append(el("h2", undefined, s.dashboardProgress));
    progress.classList.add("quiet-year-card");
    progress.append(el("p", undefined, `${s.focuses[state.focus.current].label} · ${s.focuses[state.focus.current].detail}`));
    const advance = button(s.quietYearAction, completeCurrentYear);
    advance.className = "primary-action";
    progress.append(advance);
    root.append(work, money, memory, progress);
    return root;
  }

  function renderChoice(event: LifeEvent, choice: Choice, idx: number): HTMLElement {
    const b = button(`${s.sectors[choice.sector]} ${t(choice.label)}`, () => {
      applyChoice(state, event, idx, names, conflict);
      scheduleFollowUpAfterChoice(state, conflict);
      if (state.alive && !hasDecision(state)) {
        completeCurrentYear();
        return;
      }
      audio.play("choice");
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
    audio.play("menu");
    peopleOpen = true;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openFinance(): void {
    audio.play("menu");
    financeOpen = true;
    peopleOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openLifestyle(): void {
    audio.play("menu");
    lifestyleOpen = true;
    peopleOpen = false;
    financeOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openMemorial(): void {
    audio.play("menu");
    memorialOpen = true;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openPolitics(): void {
    audio.play("menu");
    politicsOpen = true;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function openLineage(): void {
    audio.play("menu");
    lineageOpen = true;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function inherit(heirId: string): void {
    const result = inheritLife(state, heirId, family, names, worldFamily, politics);
    if (!result) return;
    audio.play("inherit");
    state = result.state;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    setSeed(state.seed);
    save();
    window.scrollTo(0, 0);
    render();
  }

  function countryName(): string {
    const year = state.deathYear ?? state.birth.year + state.age;
    return `${flagEmoji(state.birth.country.iso2)} ${t(eraName(state.birth.country.iso3, year, (getLanguage() === "en" ? COUNTRIES_EN[state.birth.country.iso3] : ruNames[state.birth.country.iso3]) ?? state.birth.country.name))}`;
  }

  function renderMemorial(onBack: (() => void) | null): void {
    const giftedDayOpen = app.querySelector<HTMLDetailsElement>(".gifted-day")?.open ?? false;
    const view = memorialView(state, scene, {
      countryName: countryName(),
      onBack,
      onPeople: openPeople,
      onFinance: openFinance,
      onLineage: openLineage,
      onInherit: inherit,
      onNewLife: state.alive ? null : newLife,
      onToggle: (index) => {
        const scroll = window.scrollY;
        audio.play("favorite");
        if (toggleFavoriteMoment(state, index)) save();
        render();
        window.scrollTo(0, scroll);
      },
    });
    view.append(renderTransferControls(() => state));
    renderSecondary(view, "memorial");
    const details = view.querySelector<HTMLDetailsElement>(".gifted-day");
    if (details) details.open = giftedDayOpen;
  }

  function renderEnd(): void {
    if (deathAudioYear !== state.deathYear) {
      audio.play("death");
      deathAudioYear = state.deathYear;
    }
    memorialOpen = false;
    renderMemorial(null);
  }

  function completeCurrentYear(): void {
    audio.play("year");
    completeYear(state, mort, family, names, conflict, gdpForYear(state.birth.year + state.age), politics);
    save();
    render();
  }

  function renderEvent(event: LifeEvent): HTMLElement {
    const card = el("div", `event${event.family ? " family-event" : event.conflict ? " conflict-event" : ""}`);
    if (event.family) card.append(el("div", "event-kicker", s.familySceneLabel));
    if (event.conflict) card.append(el("div", "event-kicker", s.conflictSceneLabel));
    card.append(el("p", undefined, t(eventText(state, event))));
    if (event.conflict) {
      const year = state.birth.year + state.age;
      const row = conflictForYear(conflict, state.seed, year);
      if (row) {
        const base = mort.q[state.birth.sex][Math.min(year, 2100) - 1950][Math.min(state.age, 100)] / mort.scale;
        card.append(el("div", "war-risk", s.warRisk[riskLevel(conflictHazard(row).civilian, base)]));
        card.append(el("div", "war-source", s.warSource[row.source]));
      }
    }
    event.choices.forEach((choice, idx) => card.append(renderChoice(event, choice, idx)));
    return card;
  }

  let scenePrepareVersion = 0;

  function prepareScene(): void {
    const version = ++scenePrepareVersion;
    void scene.prepare(state, memorialOpen || !state.alive, peopleOpen).then((loaded) => {
      if (version === scenePrepareVersion && loaded) render();
    }).catch((error) => {
      if (version === scenePrepareVersion) console.error("Не удалось загрузить арт", error);
    });
  }

  type SecondarySection = "people" | "finance" | "lifestyle" | "politics" | "lineage" | "memorial";

  function closeSecondary(): void {
    audio.play("menu");
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
    window.scrollTo(0, 0);
    render();
  }

  function renderGameNav(active: SecondarySection | null = null): HTMLElement {
    const nav = el("div", "game-nav");
    const items: [SecondarySection, string, () => void][] = [
      ["people", s.peopleButton(state.people.filter((p) => p.alive && p.status === "active").length), openPeople],
      ["finance", `${s.financeButton} · ${s.money(state.finance.cash)}`, openFinance],
      ["lifestyle", s.lifestyleButton, openLifestyle],
      ["politics", s.politicsButton, openPolitics],
      ["lineage", s.lineageButton(state.lineage.generation), openLineage],
      ["memorial", s.momentsButton(state.favoriteMomentIndexes.length, MAX_FAVORITE_MOMENTS), openMemorial],
    ];
    for (const [id, label, action] of items) {
      const item = button(label, action);
      if (active === id) item.classList.add("active");
      item.setAttribute("aria-current", active === id ? "page" : "false");
      nav.append(item);
    }
    return nav;
  }

  function renderMobileTabs(mainView: boolean): HTMLElement {
    const tabs = el("nav", "mobile-tabs bottom-tabs");
    const ids = ["event", "hero", "focus", "menu"] as const;
    tabs.setAttribute("aria-label", "Earth");
    tabs.setAttribute("role", "tablist");
    const activate = (id: typeof ids[number]) => {
      mobileTab = id;
      if (mainView) render();
      else closeSecondary();
      requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());
    };
    tabs.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
      if (target) activate(target.dataset.tab as typeof ids[number]);
    });
    tabs.addEventListener("keydown", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
      if (!target || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = ids.indexOf(target.dataset.tab as typeof ids[number]);
      const next = event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 :
        (current + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
      activate(ids[next]);
    });
    for (const id of ids) {
      const tab = button(s.tabs[id], () => {});
      tab.dataset.tab = id;
      tab.id = `tab-${id}`;
      tab.tabIndex = mobileTab === id ? 0 : -1;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(mobileTab === id));
      tab.setAttribute("aria-controls", `panel-${id}`);
      tabs.append(tab);
    }
    return tabs;
  }

  function renderSecondary(content: HTMLElement, section: SecondarySection): void {
    replaceRebrandArt(content, state, scene);
    const header = el("header", "secondary-topbar");
    header.append(button(s.back, closeSecondary), renderGameNav(section));
    app.replaceChildren(header, content, renderMobileTabs(false));
    app.className = `secondary-shell secondary-${section}`;
    document.body.classList.add("playing", "secondary-playing");
  }

  function render(): void {
    prepareScene();
    app.className = "";
    document.body.classList.remove("playing");
    if (lifestyleOpen) {
      renderSecondary(lifestyleView(state, {
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
      }), "lifestyle");
      return;
    }
    if (financeOpen) {
      renderSecondary(financeView(state, {
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
      }), "finance");
      return;
    }
    if (peopleOpen) {
      renderSecondary(peopleView(state, scene, {
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
      }), "people");
      return;
    }
    if (lineageOpen) {
      renderSecondary(lineageView(state, {
        countryName: countryName(),
        onBack: () => {
          lineageOpen = false;
          window.scrollTo(0, 0);
          render();
        },
      }), "lineage");
      return;
    }
    if (politicsOpen) {
      renderSecondary(politicsView(state, politics, {
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
      }), "politics");
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
    app.className = "game-shell";
    app.dataset.active = mobileTab;
    document.body.classList.add("playing");
    scene.update(state);
    const year = state.birth.year + state.age;
    const country = `${flagEmoji(state.birth.country.iso2)} ${t(eraName(state.birth.country.iso3, year, (getLanguage() === "en" ? COUNTRIES_EN[state.birth.country.iso3] : ruNames[state.birth.country.iso3]) ?? state.birth.country.name))}`;

    app.append(renderMobileTabs(true));
    if (recoveryNotice || saveWriteFailed) {
      const alerts = el("section", "save-alerts");
      if (recoveryNotice) {
        const notice = el("p", "notice", s.saveRecovered);
        notice.setAttribute("role", "status");
        alerts.append(notice);
      }
      if (saveWriteFailed) {
        const notice = el("p", "notice", s.saveWriteError);
        notice.setAttribute("role", "alert");
        alerts.append(notice, renderTransferControls(() => state));
      }
      app.append(alerts);
    }

    const topbar = el("section", "game-topbar");
    topbar.dataset.tab = "menu";
    topbar.id = "panel-menu";
    topbar.setAttribute("role", "tabpanel");
    topbar.setAttribute("aria-labelledby", "tab-menu");
    topbar.append(renderSettingsControls(), renderGameNav());
    app.append(topbar);

    const hero = el("section", "game-hero");
    hero.dataset.tab = "hero";
    hero.id = "panel-hero";
    hero.setAttribute("role", "tabpanel");
    hero.setAttribute("aria-labelledby", "tab-hero");
    hero.append(scene.element);
    hero.append(el("h1", undefined, state.birth.name));
    hero.append(el("p", "meta", `${country} · ${s.ageYear(state.age, year)}`));
    if (state.war.displacedUntil !== null) hero.append(el("p", "displaced", s.displacedStatus(state.war.displacedUntil)));
    hero.append(renderScales());
    const latestNews = state.peopleNews.at(-1);
    if (latestNews) hero.append(el("p", "hero-news", t(latestNews.text)));
    app.append(hero);

    const eventPanel = el("section", "game-event");
    eventPanel.dataset.tab = "event";
    eventPanel.id = "panel-event";
    eventPanel.setAttribute("role", "tabpanel");
    eventPanel.setAttribute("aria-labelledby", "tab-event");
    if (legacyNotice) {
      eventPanel.append(el("p", "notice", s.legacyReset));
      legacyNotice = false;
    }
    if (state.lastOutcome !== null) {
      const outcome = el("section", "outcome outcome-inline");
      outcome.append(el("h2", undefined, s.outcomeTitle), el("p", undefined, t(state.lastOutcome)));
      const changes = arrows(state.lastArrows ?? undefined, state.lastOutcomeKind !== "life");
      if (changes) outcome.append(el("span", "arrows", changes));
      eventPanel.append(outcome);
    }
    const currentEvent = pendingEvent(state);
    if (currentEvent) eventPanel.append(renderEvent(currentEvent));
    else eventPanel.append(renderDashboard());
    const seed = el("p", "seed", `${s.seedLabel} ${location.href}`);
    seed.title = location.href;
    eventPanel.append(seed);
    app.append(eventPanel);

    const side = el("aside", "game-side");
    side.dataset.tab = "focus";
    side.id = "panel-focus";
    side.setAttribute("role", "tabpanel");
    side.setAttribute("aria-labelledby", "tab-focus");
    side.append(renderFocus(), renderHobbies());
    app.append(side);
  }

  async function startLife(seed: string, softenHeavy = false): Promise<void> {
    lockPortrait();
    const loaded = loadLife((birth, age) => {
      const table = income.gdp[birth.country.iso3] ?? income.gdp._world;
      return table[Math.min(birth.year + age, 2022) - 1950];
    });
    recoveryNotice ||= loaded.recoveredBackup;
    saveWriteFailed ||= loaded.writeFailed;
    const saved = loaded.state;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    selectedPersonId = null;
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
      state.softenHeavy = softenHeavy;
    }
    scheduleFollowUpAfterChoice(state, conflict);
    setSeed(seed);
    window.scrollTo(0, 0);
    render();
  }

  function renderWelcome(seed: string): void {
    scenePrepareVersion++;
    peopleOpen = false;
    financeOpen = false;
    lifestyleOpen = false;
    memorialOpen = false;
    politicsOpen = false;
    lineageOpen = false;
    app.replaceChildren();
    app.append(el("h1", undefined, s.welcomeTitle));
    app.append(el("p", undefined, s.welcomeText));
    const label = el("label", "soften-start");
    const checkbox = el("input");
    checkbox.type = "checkbox";
    checkbox.id = "soften-start";
    label.append(checkbox, document.createTextNode(` ${s.softenLabel}`));
    app.append(label);
    app.append(el("h2", undefined, s.helpTitle));
    app.append(el("p", "people-source", s.helpText));
    const link = el("a", undefined, s.helpLink);
    link.href = "https://findahelpline.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    app.append(link);
    app.append(el("div", undefined, ""));
    app.append(button(s.language, switchLanguage));
    app.append(button(s.startLife, () => {
      clearLife();
      void startLife(seed, checkbox.checked);
    }));
    app.append(renderTransferControls(() => loadLife().state));
  }

  function newLife(): void {
    renderWelcome(randomSeed());
  }

  lockPortrait();
  const seedParam = new URL(location.href).searchParams.get("seed");
  const initialLoad = loadLife((birth, age) => {
    const table = income.gdp[birth.country.iso3] ?? income.gdp._world;
    return table[Math.min(birth.year + age, 2022) - 1950];
  });
  legacyNotice = initialLoad.legacyDiscarded;
  recoveryNotice = initialLoad.recoveredBackup;
  saveWriteFailed = initialLoad.writeFailed;
  const saved = initialLoad.state;
  if (!seedParam && saved) {
    app.replaceChildren();
    app.append(el("h1", undefined, s.title));
    app.append(button(saved.alive ? s.continueLife : s.memorialContinue, () => void startLife(saved.seed)));
    app.append(button(s.newLife, newLife));
    app.append(renderTransferControls(() => loadLife().state));
  } else if (seedParam && saved && saved.seed === seedParam) {
    await startLife(seedParam);
  } else {
    renderWelcome(seedParam ?? randomSeed());
  }
  setupOffline();
}

void main();
