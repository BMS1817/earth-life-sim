import "./styles.css";
import { applyChoice, eventText, riskChance } from "../core/turn.ts";
import { hasDecision, pendingEvent, scheduleFollowUpAfterChoice } from "../core/flow.ts";
import { addHobby, focusOptions, setActiveHobby, setFocus } from "../core/focus.ts";
import { HOBBY_IDS } from "../content/focus.ts";
import { eraName } from "../content/eras.ts";
import { COUNTRIES_EN } from "../content/en/countries.ts";
import { giftedDay, toggleFavoriteMoment } from "../core/memorial.ts";
import { inheritLife } from "../core/inheritance.ts";
import type { LifeState, Scales } from "../core/state.ts";
import type { Choice, LifeEvent } from "../core/events.ts";
import { getLanguage, setLanguage } from "../i18n.ts";
import { s, t } from "../ui/strings.ts";
import { RebrandScene } from "../ui/rebrand-scene.ts";
import { peopleView } from "../ui/people-view.ts";
import { financeView } from "../ui/finance-view.ts";
import { lifestyleView } from "../ui/lifestyle-view.ts";
import { politicsView } from "../ui/politics-view.ts";
import { lineageView } from "../ui/lineage-view.ts";
import { memorialView } from "../ui/memorial-view.ts";
import { startPlan } from "../core/plans.ts";
import { adoptPet, buyProperty, buyRental, startBusiness } from "../core/lifestyle.ts";
import { invest, divest } from "../core/finance.ts";
import { attemptUsurpation, holdReferendum, startCampaign } from "../core/politics.ts";
import { RebrandAudio } from "../ui/rebrand-audio.ts";
import { resourceUrl } from "../ui/resource.ts";
import { el, button } from "./dom.ts";
import { advanceYear, loadPrototypeLife, playToAdultDecision, playToEnd } from "./state.ts";
import type { PrototypeLife } from "./state.ts";

type View = "main" | "people" | "finance" | "lifestyle" | "politics" | "lineage" | "memorial";
type MobileTab = "event" | "hero" | "focus" | "menu";

declare global {
  interface Window {
    __REBRAND_QA__?: { scene: RebrandScene; life: PrototypeLife };
  }
}

const app = document.querySelector<HTMLElement>("#prototype-app")!;
const params = new URLSearchParams(location.search);
let view: View = ["main", "people", "finance", "lifestyle", "politics", "lineage", "memorial"].includes(params.get("view") ?? "") ? params.get("view") as View : "main";
let mobileTab: MobileTab = "event";
let selectedPersonId: string | null = null;
let mobilePeopleDetail = false;
let menuOpen = false;
let life: PrototypeLife;
let memorialState: LifeState;
let scene: RebrandScene;
const audio = new RebrandAudio("prototypes/rebrand/assets/audio", "rebrand:");
let renderVersion = 0;

function currentState(): LifeState {
  return view === "memorial" ? memorialState : life.state;
}

function countryName(state: LifeState): string {
  const iso3 = state.birth.country.iso3;
  const year = state.birth.year + state.age;
  const translated = getLanguage() === "en" ? COUNTRIES_EN[iso3] : life.ruNames[iso3];
  return eraName(iso3, year, translated ?? state.birth.country.name);
}

function arrows(effects: Partial<Scales> | undefined, personal: boolean): string {
  if (!effects) return "";
  return (Object.keys(effects) as (keyof Scales)[])
    .map((key) => `${key === "bonds" && personal ? s.personalBonds : s.scales[key]}${(effects[key] ?? 0) >= 0 ? "↑" : "↓"}`)
    .join(" · ");
}

function changeView(next: View): void {
  audio.play("menu");
  view = next;
  menuOpen = false;
  mobilePeopleDetail = false;
  if (next === "people" && !selectedPersonId) selectedPersonId = life.state.people.find((person) => person.alive && person.status === "active")?.id ?? null;
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState(null, "", url);
  void render();
}

function renderTopbar(): HTMLElement {
  const header = el("header", "prototype-topbar");
  const brand = el("button", "prototype-brand");
  brand.type = "button";
  brand.append(el("strong", undefined, "Earth"), el("span", undefined, s.title));
  brand.addEventListener("click", () => changeView("main"));
  const nav = el("nav", "prototype-nav");
  const items: [View, string][] = [["main", s.tabs.event], ["people", s.peopleButton(life.state.people.length)], ["finance", s.financeButton], ["lifestyle", s.lifestyleTitle], ["politics", s.politicsTitle], ["lineage", s.lineageButton(life.state.lineage.generation)], ["memorial", s.journalTitle]];
  for (const [id, label] of items) {
    const node = button(label, () => changeView(id), view === id ? "active" : undefined);
    if (view === id) node.setAttribute("aria-current", "page");
    nav.append(node);
  }
  const actions = el("div", "prototype-top-actions");
  actions.append(button(s.language, () => {
    setLanguage(getLanguage() === "ru" ? "en" : "ru");
    audio.play("button");
    void render();
  }, "language-button"));
  actions.append(button(s.tabs.menu, () => {
    view = "main";
    menuOpen = true;
    audio.play("menu");
    void render();
  }, "menu-button"));
  header.append(brand, nav, actions);
  return header;
}

function renderScales(state: LifeState): HTMLElement {
  const root = el("section", "hero-section scales-section");
  root.append(el("h2", undefined, s.finalScales));
  const values: [keyof typeof s.scales, number][] = [
    ["health", state.scales.health],
    ["money", state.scales.money],
    ["education", state.scales.education],
    ["bonds", state.scales.bonds],
    ["happiness", state.happiness],
  ];
  const list = el("div", "prototype-scales");
  for (const [key, value] of values) {
    const row = el("div", "prototype-scale");
    const labels = el("div", "scale-labels");
    labels.append(el("span", undefined, s.scales[key]), el("strong", undefined, String(Math.round(value))));
    const track = el("div", "prototype-track");
    const fill = el("span", `prototype-fill fill-${key}`);
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    track.append(fill);
    row.append(labels, track);
    list.append(row);
  }
  root.append(list);
  return root;
}

function renderFocus(state: LifeState): HTMLElement {
  const root = el("section", "hero-section focus-section");
  root.append(el("h2", undefined, s.focusTitle));
  const options = el("div", "prototype-focus-options");
  for (const id of focusOptions(state)) {
    const node = button("", () => {
      setFocus(state, id);
      void render();
    }, state.focus.current === id ? "focus-option active" : "focus-option");
    node.append(el("strong", undefined, s.focuses[id].label), el("span", undefined, s.focuses[id].detail));
    node.setAttribute("aria-pressed", String(state.focus.current === id));
    options.append(node);
  }
  root.append(options);
  return root;
}

function renderHobbies(state: LifeState): HTMLElement {
  const root = el("section", "hero-section hobbies-section");
  root.append(el("h2", undefined, s.hobbiesTitle));
  const list = el("div", "prototype-hobbies");
  for (const id of HOBBY_IDS) {
    const owned = state.hobbies.find((hobby) => hobby.id === id);
    const active = state.activeHobbyId === id;
    const label = `${s.hobbies[id]} · ${owned ? s.hobbyLevel(owned.level) : s.hobbyEffects[id]}`;
    const node = button(label, () => {
      if (owned) setActiveHobby(state, id);
      else addHobby(state, id);
      void render();
    }, active ? "hobby-button active" : "hobby-button");
    node.setAttribute("aria-pressed", String(active));
    list.append(node);
  }
  root.append(list);
  return root;
}

function renderChoice(event: LifeEvent, choice: Choice, index: number): HTMLElement {
  const wrap = el("div", `prototype-choice choice-${choice.sector}`);
  const node = button("", () => {
    applyChoice(life.state, event, index, life.names, life.conflict);
    scheduleFollowUpAfterChoice(life.state, life.conflict);
    audio.play("choice");
    if (!life.state.alive) {
      memorialState = life.state;
      view = "memorial";
      audio.play("death");
    }
    void render();
  }, "prototype-choice-button");
  node.append(el("span", "choice-sector", s.sectors[choice.sector]), el("strong", undefined, t(choice.label)));
  wrap.append(node);
  const effects = arrows(choice.effects, Boolean(event.subject || event.family));
  if (effects) wrap.append(el("span", "choice-effects", effects));
  if (choice.risk) wrap.append(el("span", "choice-risk", s.riskHint(Math.round(riskChance(life.state, event, choice) * 100))));
  return wrap;
}

function renderEvent(state: LifeState): HTMLElement {
  const panel = el("article", "event-section");
  panel.append(el("div", "event-kicker", s.ageYear(state.age, state.birth.year + state.age)));
  const event = pendingEvent(state);
  if (event) {
    panel.append(el("h1", undefined, eventText(state, event)));
    const choices = el("div", "prototype-choices");
    event.choices.forEach((choice, index) => choices.append(renderChoice(event, choice, index)));
    panel.append(choices);
  } else {
    panel.append(el("h1", undefined, s.quietYear));
    if (state.lastOutcome !== null) {
      const outcome = el("section", "prototype-outcome");
      outcome.append(el("h2", undefined, s.outcomeTitle), el("p", undefined, t(state.lastOutcome)));
      const changes = arrows(state.lastArrows ?? undefined, state.lastOutcomeKind !== "life");
      if (changes) outcome.append(el("p", "choice-effects", changes));
      panel.append(outcome);
    }
    panel.append(button(s.quietYearAction, () => {
      advanceYear(life);
      audio.play("year");
      if (!life.state.alive) {
        memorialState = life.state;
        view = "memorial";
        audio.play("death");
      }
      void render();
    }, "primary-action"));
  }
  const seed = el("p", "prototype-seed", `${s.seedLabel} ${state.seed}`);
  panel.append(seed);
  return panel;
}

function renderMenu(): HTMLElement {
  const root = el("section", "prototype-menu");
  root.append(el("h2", undefined, s.tabs.menu));
  const controls = el("div", "menu-controls");
  controls.append(button(`${s.softenLabel}: ${s.softenState(life.state.softenHeavy)}`, () => {
    life.state.softenHeavy = !life.state.softenHeavy;
    void render();
  }));
  controls.append(button(s.language, () => {
    setLanguage(getLanguage() === "ru" ? "en" : "ru");
    audio.play("button");
    void render();
  }));
  controls.append(button(s.soundToggle(audio.isEnabled), () => {
    audio.setEnabled(!audio.isEnabled);
    if (audio.isEnabled) audio.play("choice");
    void render();
  }));
  const preview = button(s.soundPreview, () => audio.play("choice"));
  preview.disabled = !audio.isEnabled;
  controls.append(preview);
  controls.append(button(s.musicToggle(audio.musicIsEnabled), () => {
    audio.setMusicEnabled(!audio.musicIsEnabled);
    void render();
  }));
  const soundLabel = el("label", "menu-slider");
  const soundValue = el("output", undefined, `${audio.volumePercent}%`);
  const sound = el("input");
  sound.type = "range";
  sound.min = "0";
  sound.max = "100";
  sound.value = String(audio.volumePercent);
  sound.addEventListener("input", () => {
    audio.setVolume(Number(sound.value) / 100);
    soundValue.textContent = `${sound.value}%`;
  });
  soundLabel.append(el("span", undefined, s.soundVolume), sound, soundValue);
  const musicLabel = el("label", "menu-slider");
  const musicValue = el("output", undefined, `${audio.musicVolumePercent}%`);
  const music = el("input");
  music.type = "range";
  music.min = "0";
  music.max = "100";
  music.value = String(audio.musicVolumePercent);
  music.addEventListener("input", () => {
    audio.setMusicVolume(Number(music.value) / 100);
    musicValue.textContent = `${music.value}%`;
  });
  musicLabel.append(el("span", undefined, s.musicVolume), music, musicValue);
  const guide = el("details", "prototype-guide");
  guide.append(el("summary", undefined, s.guideTitle), el("p", undefined, s.guideText));
  root.append(controls, soundLabel, musicLabel, guide);
  return root;
}

function renderBottomTabs(): HTMLElement {
  const nav = el("nav", "prototype-bottom-tabs");
  nav.setAttribute("aria-label", s.tabs.event);
  for (const id of ["event", "hero", "focus", "menu"] as const) {
    const node = button(s.tabs[id], () => {
      mobileTab = id;
      menuOpen = false;
      void render();
    }, mobileTab === id ? "active" : undefined);
    node.setAttribute("role", "tab");
    node.setAttribute("aria-selected", String(mobileTab === id));
    nav.append(node);
  }
  return nav;
}

function renderMain(): HTMLElement {
  const state = life.state;
  const root = el("main", `prototype-main mobile-tab-${mobileTab}`);
  const hero = el("div", "prototype-hero-column");
  const identity = el("section", "hero-section identity-section");
  const sceneFrame = el("div", "prototype-scene-frame");
  scene.element.setAttribute("role", "img");
  scene.element.setAttribute("aria-label", s.sceneAlt);
  sceneFrame.append(scene.element);
  identity.append(sceneFrame, el("h1", undefined, state.birth.name));
  const location = el("p", "identity-location");
  if (state.birth.country.iso2) {
    const flag = el("img", "identity-flag");
    flag.src = resourceUrl(`flags/4x3/${state.birth.country.iso2.toLowerCase()}.svg`);
    flag.alt = "";
    location.append(flag);
  }
  location.append(el("span", undefined, countryName(state)), el("small", undefined, s.ageYear(state.age, state.birth.year + state.age)));
  identity.append(location);
  hero.append(identity, renderScales(state), renderFocus(state), renderHobbies(state));
  const event = renderEvent(state);
  const menu = renderMenu();
  menu.classList.add("mobile-menu-panel");
  root.append(hero, event, menu);
  return root;
}

function renderPeople(): HTMLElement {
  const state = life.state;
  const root = el("main", `people-prototype${mobilePeopleDetail ? " show-person-detail" : ""}`);
  if (!selectedPersonId && state.people.length > 0) selectedPersonId = state.people.find((person) => person.alive && person.status === "active")?.id ?? state.people[0].id;
  const list = peopleView(state, scene, {
    selectedId: null,
    onBack: () => changeView("main"),
    onSelect: (id) => {
      selectedPersonId = id;
      mobilePeopleDetail = id !== null;
      void render();
    },
  });
  list.classList.add("people-master");
  const detail = el("div", "people-detail-pane");
  if (selectedPersonId && state.people.some((person) => person.id === selectedPersonId)) {
    detail.append(peopleView(state, scene, {
      selectedId: selectedPersonId,
      onBack: () => changeView("main"),
      onSelect: (id) => {
        selectedPersonId = id;
        mobilePeopleDetail = id !== null;
        void render();
      },
    }));
  } else {
    detail.append(el("p", "muted", s.noPeople));
  }
  for (const header of root.querySelectorAll<HTMLElement>(".thematic-header")) header.replaceWith(scene.thematicHeader());
  root.append(list, detail);
  return root;
}

function renderFeature(kind: Exclude<View, "main" | "people" | "memorial">): HTMLElement {
  const state = life.state;
  const root = el("main", "feature-prototype");
  if (kind === "finance") {
    root.append(financeView(state, {
      onBack: () => changeView("main"),
      onInvest: (investment, buy) => {
        const year = state.birth.year + state.age;
        if (buy) invest(state.finance, investment, 100, year);
        else divest(state.finance, investment, 100, year);
        audio.play("button");
        void render();
      },
    }));
  } else if (kind === "lifestyle") {
    root.append(lifestyleView(state, {
      onBack: () => changeView("main"),
      onPlan: (plan, dreamCareer) => {
        startPlan(state, plan, dreamCareer);
        audio.play("button");
        void render();
      },
      onPet: (pet) => {
        adoptPet(state, pet);
        audio.play("button");
        void render();
      },
      onProperty: (property) => {
        buyProperty(state, property);
        audio.play("button");
        void render();
      },
      onRental: () => {
        buyRental(state);
        audio.play("button");
        void render();
      },
      onBusiness: (business) => {
        startBusiness(state, business);
        audio.play("button");
        void render();
      },
      onToggle: (key, value) => {
        state.lifestyle[key] = value;
        audio.play("button");
        void render();
      },
      onNutrition: (value) => {
        state.lifestyle.nutrition = value;
        audio.play("button");
        void render();
      },
    }));
  } else if (kind === "politics") {
    root.append(politicsView(state, life.politics, {
      baseGdp: state.finance.gdpPerCapita,
      onBack: () => changeView("main"),
      onPlan: () => {
        startPlan(state, "localPolitics");
        audio.play("button");
        void render();
      },
      onCampaign: (level, platform) => {
        startCampaign(state, life.politics, level, platform);
        audio.play("button");
        void render();
      },
      onReferendum: (field, value) => {
        holdReferendum(state, life.politics, field, value);
        audio.play("button");
        void render();
      },
      onUsurpation: () => {
        attemptUsurpation(state, life.politics);
        audio.play("button");
        void render();
      },
    }));
    const oldCity = root.querySelector<HTMLCanvasElement>("canvas.politics-city");
    if (oldCity) {
      const city = scene.dayScene(state, state.age, state.finance.career);
      city.className = "politics-city";
      oldCity.replaceWith(city);
    }
  } else {
    root.append(lineageView(state, { countryName: countryName(state), onBack: () => changeView("main") }));
  }
  for (const header of root.querySelectorAll<HTMLElement>(".thematic-header")) header.replaceWith(scene.thematicHeader());
  return root;
}

function groupMemorial(root: HTMLElement): void {
  const hero = el("header", "memorial-hero");
  for (const node of [...root.children].filter((child) => child.matches("h1, p, .thematic-header, .memorial-actions"))) hero.append(node);
  root.prepend(hero);
  const grid = el("div", "memorial-dossier-grid");
  const sections = [...root.querySelectorAll<HTMLElement>(":scope > .memorial-section")];
  const grouped = new Map<string, string>([
    [s.memorialPattern, "memorial-pattern-cell"],
    [s.memorialBiography, "memorial-biography-cell"],
    [s.memorialHappiness, "memorial-happiness-cell"],
    [s.memorialRoom, "memorial-room-cell"],
  ]);
  const selected = sections.filter((section) => grouped.has(section.querySelector("h2")?.textContent ?? ""));
  const first = selected[0];
  if (first) root.insertBefore(grid, first);
  for (const section of selected) {
    const title = section.querySelector("h2")?.textContent ?? "";
    section.classList.add(grouped.get(title)!);
    grid.append(section);
  }
  if (!first) root.append(grid);
}

function replaceMemorialArt(root: HTMLElement): void {
  for (const header of root.querySelectorAll<HTMLElement>(".thematic-header")) header.replaceWith(scene.thematicHeader());
  const oldRoom = root.querySelector<HTMLCanvasElement>("canvas.memorial-canvas");
  if (oldRoom) {
    const room = document.createElement("canvas");
    room.width = 256;
    room.height = 192;
    room.className = "memorial-canvas";
    room.setAttribute("role", "img");
    room.setAttribute("aria-label", s.memorialRoom);
    const ctx = room.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene.element, 0, 0);
    oldRoom.replaceWith(room);
  }
  const oldGift = root.querySelector<HTMLCanvasElement>(".gifted-day canvas");
  if (oldGift) {
    const gift = giftedDay(memorialState);
    const portrait = scene.dayScene(memorialState, gift.age, gift.career);
    portrait.setAttribute("role", "img");
    oldGift.replaceWith(portrait);
  }
}

function renderMemorial(): HTMLElement {
  const root = el("main", "memorial-prototype");
  const content = memorialView(memorialState, scene, {
    countryName: countryName(memorialState),
    onBack: () => changeView("main"),
    onPeople: () => changeView("people"),
    onFinance: () => undefined,
    onLineage: () => undefined,
    onInherit: (heirId) => {
      const result = inheritLife(memorialState, heirId, life.family, life.names, life.worldFamily, life.politics);
      if (!result) return;
      audio.play("inherit");
      life.state = result.state;
      selectedPersonId = null;
      view = "main";
      void render();
    },
    onToggle: (index) => {
      toggleFavoriteMoment(memorialState, index);
      audio.play("favorite");
      void render();
    },
    onNewLife: null,
  });
  for (const action of content.querySelectorAll<HTMLButtonElement>(".memorial-actions button")) {
    if (action.textContent === s.financeButton || action.textContent === s.lineageButton(memorialState.lineage.generation)) action.disabled = true;
  }
  groupMemorial(content);
  replaceMemorialArt(content);
  root.append(content);
  return root;
}

function renderMenuDialog(): HTMLElement {
  const backdrop = el("div", "menu-backdrop");
  const dialog = el("div", "menu-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", s.tabs.menu);
  dialog.append(button(s.back, () => {
    menuOpen = false;
    audio.play("menu");
    void render();
  }, "menu-close"), renderMenu());
  backdrop.append(dialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    menuOpen = false;
    audio.play("menu");
    void render();
  });
  return backdrop;
}

async function render(): Promise<void> {
  const version = ++renderVersion;
  const state = currentState();
  await scene.prepare(state, view === "memorial", view === "people");
  if (version !== renderVersion) return;
  scene.update(state);
  document.documentElement.lang = getLanguage();
  document.title = s.title;
  const content = view === "main" ? renderMain() : view === "people" ? renderPeople() : view === "memorial" ? renderMemorial() : renderFeature(view);
  app.replaceChildren(renderTopbar(), content);
  if (view === "main") app.append(renderBottomTabs());
  if (menuOpen && view === "main") app.append(renderMenuDialog());
  document.body.dataset.view = view;
  document.body.dataset.mobileTab = mobileTab;
  app.classList.add("ready");
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !menuOpen) return;
  menuOpen = false;
  audio.play("menu");
  void render();
});

async function main(): Promise<void> {
  app.textContent = s.loading;
  try {
    life = await loadPrototypeLife(params.get("seed") ?? "ui-prototype");
    playToAdultDecision(life);
    memorialState = playToEnd(life);
    if (params.get("empty") === "people") {
      life.state.people = [];
      selectedPersonId = null;
    }
    scene = new RebrandScene("prototypes/rebrand/assets");
    if (params.get("qa") === "1") window.__REBRAND_QA__ = { scene, life };
    await scene.prepare(memorialState, true, true);
    requestAnimationFrame(function loop(time) {
      scene.draw(time);
      requestAnimationFrame(loop);
    });
    await render();
  } catch (error) {
    app.textContent = s.loadError;
    audio.play("error");
    throw error;
  }
}

void main();
