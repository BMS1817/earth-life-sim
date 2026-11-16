import { MAX_FAVORITE_MOMENTS } from "../content/memorial.ts";
import { buildAlbum, finalSceneMoments, giftedDay, lifePattern, mainTurns, roomItems } from "../core/memorial.ts";
import { compassPosition } from "../core/state.ts";
import type { LifeState, Scales } from "../core/state.ts";
import { ru as s } from "./strings.ts";
import type { Scene } from "./scene.ts";
import { drawGiftedDay, drawHappinessChart, drawMemorialRoom } from "./memorial-art.ts";

interface MemorialViewOptions {
  countryName: string;
  onToggle: (index: number) => void;
  onBack: (() => void) | null;
  onPeople: () => void;
  onFinance: () => void;
  onNewLife: (() => void) | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", undefined, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function section(title: string, extraClass = ""): HTMLElement {
  const root = el("section", `memorial-section${extraClass ? ` ${extraClass}` : ""}`);
  root.append(el("h2", undefined, title));
  return root;
}

function row(label: string, value: string): HTMLElement {
  const line = el("div", "finance-row");
  line.append(el("span", undefined, label), el("strong", undefined, value));
  return line;
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

function scales(state: LifeState): HTMLElement {
  const wrap = el("div", "scales");
  for (const key of Object.keys(s.scales) as (keyof typeof s.scales)[]) {
    const line = el("div", "scale-row");
    line.append(el("span", "scale-name", s.scales[key]));
    const bar = el("div", "bar");
    const fill = el("div", `fill fill-${key}`);
    fill.style.width = `${key === "happiness" ? state.happiness : state.scales[key as keyof Scales]}%`;
    bar.append(fill);
    line.append(bar);
    wrap.append(line);
  }
  return wrap;
}

function momentMeta(age: number, year: number): string {
  return s.memoryYear(age, year);
}

export function memorialView(state: LifeState, scene: Scene, options: MemorialViewOptions): HTMLElement {
  const root = el("div", `memorial-view${state.alive ? "" : " ended"}`);
  if (options.onBack) root.append(button(s.back, options.onBack));
  const year = state.deathYear ?? state.birth.year + state.age;
  root.append(el("h1", undefined, state.alive ? s.journalTitle : s.gameOver));
  if (state.alive) root.append(el("p", "meta", `${state.birth.name} · ${options.countryName}`));
  else root.append(el("p", undefined, s.diedAt(state.birth.name, state.age, year)), el("p", "meta", options.countryName));
  root.append(el("p", "people-source", s.memorialLocal));
  if (!state.alive) {
    const actions = el("div", "memorial-actions");
    actions.append(button(s.peopleButton(state.people.length), options.onPeople), button(s.financeButton, options.onFinance));
    root.append(actions);
  }

  const pattern = lifePattern(state);
  const patternSection = section(s.memorialPattern, "life-pattern");
  patternSection.style.setProperty("--life-color", pattern.color);
  const patternHeader = el("div", "pattern-header");
  patternHeader.append(el("span", "pattern-swatch"), el("strong", "pattern-name", s.patternNames[pattern.name]));
  patternSection.append(patternHeader, el("p", "muted", s.memorialPatternDetail(s.focuses[pattern.dominantFocus].label, pattern.color.toUpperCase())));
  patternSection.append(compassAxis(s.axisTradition, s.axisChange, compassPosition(state.compass.tradition, state.compass.choices)));
  patternSection.append(compassAxis(s.axisBonds, s.axisSelf, compassPosition(state.compass.bonds, state.compass.choices)));
  patternSection.append(el("p", "meta", s.choicesMade(state.compass.choices)));
  root.append(patternSection);

  const biography = section(s.memorialBiography);
  biography.append(row(s.memorialBorn, `${state.birth.year} · ${options.countryName}`));
  biography.append(row(s.financeCareer, state.finance.career ? s.careers[state.finance.career] : s.financeNoCareer));
  const partners = state.people.filter((person) => person.role === "partner").length;
  const children = state.people.filter((person) => person.role === "child").length;
  const friends = state.people.filter((person) => person.role === "friend").length;
  biography.append(row(s.memorialConnections, s.memorialFamily(partners, children, friends)));
  const hobbySummary = state.hobbies.length > 0
    ? state.hobbies.map((hobby) => `${s.hobbies[hobby.id]} · ${hobby.level}`).join(", ")
    : s.memorialNoHobbies;
  biography.append(row(s.hobbiesTitle, hobbySummary));
  const turns = mainTurns(state);
  if (turns.length > 0) {
    const list = el("ol", "biography-turns");
    for (const moment of turns) {
      const item = el("li");
      item.append(el("span", "memory-meta", momentMeta(moment.age, moment.year)), el("span", undefined, moment.text));
      list.append(item);
    }
    biography.append(list);
  } else biography.append(el("p", "muted", s.memorialNoTurns));
  root.append(biography);

  const happiness = section(s.memorialHappiness);
  const values = state.happinessHistory.map((point) => point.value);
  const min = Math.round(Math.min(...values));
  const max = Math.round(Math.max(...values));
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const summary = s.memorialHappinessSummary(min, average, max);
  const chart = document.createElement("canvas");
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-label", summary);
  drawHappinessChart(chart, state.happinessHistory, pattern.color);
  happiness.append(chart, el("p", "muted", summary));
  happiness.append(el("p", "memory-meta", s.memorialHappinessYears(state.happinessHistory[0].year, state.happinessHistory.at(-1)!.year)));
  root.append(happiness);

  const items = roomItems(state);
  const room = section(s.memorialRoom);
  const roomCanvas = document.createElement("canvas");
  roomCanvas.setAttribute("role", "img");
  roomCanvas.setAttribute("aria-label", items.length > 0 ? items.map((item) => s.roomItemNames[item]).join(", ") : s.memorialRoomEmpty);
  drawMemorialRoom(roomCanvas, state, scene.heroPortrait(state, state.age, "happy"), items, pattern.color);
  room.append(roomCanvas);
  if (items.length > 0) {
    const list = el("div", "room-item-list");
    for (const item of items) list.append(el("span", "room-item", s.roomItemNames[item]));
    room.append(list);
  } else room.append(el("p", "muted", s.memorialRoomEmpty));
  root.append(room);

  const album = section(s.memorialAlbum);
  const photos = buildAlbum(state);
  if (photos.length > 0) {
    const grid = el("div", "photo-album");
    for (const moment of photos) {
      const figure = el("figure", "memory-photo");
      const portrait = scene.heroPortrait(state, moment.age, "happy");
      portrait.setAttribute("role", "img");
      portrait.setAttribute("aria-label", s.memorialPhotoAlt(state.birth.name, moment.age));
      figure.append(portrait, el("figcaption", undefined, momentMeta(moment.age, moment.year)), el("p", undefined, moment.text));
      grid.append(figure);
    }
    album.append(grid);
  } else album.append(el("p", "muted", s.memorialAlbumEmpty));
  root.append(album);

  if (!state.alive) {
    const finalScene = section(s.memorialFinalScene, "final-scene");
    finalScene.style.setProperty("--life-color", pattern.color);
    const finalMoments = finalSceneMoments(state);
    finalScene.append(el("p", "muted", state.favoriteMomentIndexes.length > 0 ? s.memorialFinalFromFavorites : s.memorialFinalAuto));
    if (finalMoments.length > 0) {
      const portrait = scene.heroPortrait(state, state.age, "happy");
      portrait.classList.add("final-portrait");
      finalScene.append(portrait);
      const list = el("ol", "final-moments");
      for (const moment of finalMoments) {
        const item = el("li");
        item.append(el("span", "memory-meta", momentMeta(moment.age, moment.year)), el("span", undefined, moment.text));
        list.append(item);
      }
      finalScene.append(list);
    } else finalScene.append(el("p", "muted", s.memorialNoFinal));

    const gift = giftedDay(state);
    const details = el("details", "gifted-day");
    details.append(el("summary", undefined, s.memorialGift));
    details.append(el("p", "people-source", s.memorialGiftNote));
    const giftTitle = gift.kind === "career" && gift.career
      ? s.giftedCareerTitle(s.careers[gift.career])
      : gift.kind === "hobby" && gift.hobby
        ? s.giftedHobbyTitle(s.hobbies[gift.hobby])
        : s.giftedFocusTitle[gift.focus];
    const giftText = gift.kind === "career" && gift.career
      ? s.giftedCareerText(s.careers[gift.career])
      : gift.kind === "hobby" && gift.hobby
        ? s.giftedHobbyText(s.hobbies[gift.hobby])
        : s.giftedFocusText[gift.focus];
    details.append(el("h3", undefined, giftTitle), el("p", undefined, giftText));
    const giftCanvas = document.createElement("canvas");
    giftCanvas.setAttribute("role", "img");
    giftCanvas.setAttribute("aria-label", giftTitle);
    drawGiftedDay(giftCanvas, state, scene.heroPortrait(state, gift.age, "happy", gift.career), gift, pattern.color);
    details.append(giftCanvas);
    finalScene.append(details);
    root.append(finalScene);
  }

  const favorites = section(s.memorialFavorites, "favorite-moments");
  favorites.append(el("p", "favorite-count", s.memorialFavoriteCount(state.favoriteMomentIndexes.length, MAX_FAVORITE_MOMENTS)));
  favorites.append(el("p", "muted", s.memorialFavoriteHint));
  if (state.chronicle.length > 0) {
    const list = el("ol", "chronicle memorial-chronicle");
    state.chronicle.forEach((entry, index) => {
      const selected = state.favoriteMomentIndexes.includes(index);
      const item = el("li", selected ? "favorite" : undefined);
      const text = el("div", "chronicle-entry");
      text.append(el("span", "memory-meta", momentMeta(entry.age, entry.year)), el("span", undefined, entry.text));
      const toggle = button(selected ? s.memorialFavoriteRemove : s.memorialFavoriteAdd, () => options.onToggle(index));
      toggle.className = `favorite-button${selected ? " active" : ""}`;
      toggle.setAttribute("aria-pressed", String(selected));
      if (!selected && state.favoriteMomentIndexes.length >= MAX_FAVORITE_MOMENTS) toggle.disabled = true;
      item.append(text, toggle);
      list.append(item);
    });
    favorites.append(list);
    if (state.favoriteMomentIndexes.length >= MAX_FAVORITE_MOMENTS) favorites.append(el("p", "notice", s.memorialFavoriteLimit));
  } else favorites.append(el("p", "muted", s.memorialChronicleEmpty));
  root.append(favorites);

  if (!state.alive) {
    const finalScales = section(s.finalScales);
    finalScales.append(scales(state));
    root.append(finalScales);
    if (options.onNewLife) root.append(button(s.anotherLife, options.onNewLife));
  }
  return root;
}
