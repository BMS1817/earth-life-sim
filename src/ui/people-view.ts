import type { LifeState } from "../core/state.ts";
import { relationshipOf } from "../core/people.ts";
import type { Person } from "../core/people.ts";
import type { Scene } from "./scene.ts";
import { s, t } from "./strings.ts";
import { thematicHeader } from "./thematic-header.ts";

interface PeopleViewOptions {
  selectedId: string | null;
  onBack: () => void;
  onSelect: (id: string | null) => void;
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

function relationshipBar(p: Person): HTMLElement {
  const value = relationshipOf(p);
  const wrap = el("div", "relationship");
  const labels = el("div", "relationship-labels");
  labels.append(el("span", undefined, s.relationship), el("strong", undefined, s.relationshipState(value)));
  const b = el("button", "relationship-button");
  b.type = "button";
  b.title = s.relationshipHint;
  b.setAttribute("aria-label", `${s.relationshipState(value)}. ${s.relationshipHint}`);
  const bar = el("span", "bar");
  const fill = el("span", "fill fill-bonds");
  fill.style.width = `${value}%`;
  bar.append(fill);
  const exact = el("span", "relationship-exact");
  exact.style.display = "none";
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    exact.textContent = s.relationshipExact(value);
    exact.style.display = "block";
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  b.addEventListener("pointerdown", () => {
    timer = setTimeout(reveal, 600);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(type, () => clearTimeout(timer));
  b.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") reveal();
  });
  b.append(bar);
  wrap.append(labels, b, exact);
  return wrap;
}

function traits(p: Person): HTMLElement {
  const wrap = el("div", "traits");
  if (p.knownTraits.length === 0) {
    wrap.append(el("span", "muted", s.unknownTraits));
    return wrap;
  }
  for (const trait of p.knownTraits) wrap.append(el("span", "trait", s.traits[trait]));
  return wrap;
}

function personCard(state: LifeState, scene: Scene, p: Person, onSelect: (id: string) => void): HTMLElement {
  const year = state.birth.year + state.age;
  const card = el("article", `person-card${p.alive ? "" : " dead"}`);
  const summary = button("", () => onSelect(p.id));
  summary.className = "person-summary";
  const portrait = scene.portraitFor(p.id, year);
  if (portrait) {
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", s.portraitAlt(p.name));
    summary.append(portrait);
  }
  const body = el("span", "person-body");
  body.append(el("strong", "person-name", p.name));
  const role = s.personRole(p, state.spouseId === p.id);
  const age = p.alive ? s.personAge(year - p.birthYear) : (p.sex === "F" ? s.personDeadFemale(p.deathYear ?? year) : s.personDead(p.deathYear ?? year));
  body.append(el("span", "person-meta", `${role} · ${age}`));
  if (p.alive && p.status === "active") body.append(el("span", "person-state", s.relationshipState(relationshipOf(p))));
  else body.append(el("span", "person-state", s.personStatus(p.status)));
  body.append(traits(p));
  const last = p.memories.at(-1);
  if (last) body.append(el("span", "person-last-memory", t(last.text)));
  summary.append(body);
  card.append(summary);
  if (p.alive && p.status === "active") card.append(relationshipBar(p));
  return card;
}

function personDetail(state: LifeState, scene: Scene, p: Person, onSelect: (id: string | null) => void): HTMLElement {
  const root = el("section", "person-detail");
  root.append(button(s.peopleTitle, () => onSelect(null)));
  root.append(personCard(state, scene, p, () => undefined));
  if (!p.alive) root.append(relationshipBar(p));
  root.append(el("h2", undefined, s.memoriesTitle));
  if (p.memories.length === 0) root.append(el("p", "muted", s.noMemories));
  const list = el("ol", "memories");
  for (const memory of [...p.memories].reverse()) {
    const item = el("li", "memory");
    item.append(el("span", "memory-meta", s.memoryYear(memory.age, memory.year)), el("span", undefined, t(memory.text)));
    list.append(item);
  }
  root.append(list);
  return root;
}

export function peopleView(state: LifeState, scene: Scene, options: PeopleViewOptions): HTMLElement {
  const root = el("div", "people-view");
  root.append(button(s.back, options.onBack));
  if (options.selectedId) {
    const selected = state.people.find((p) => p.id === options.selectedId);
    if (selected) {
      root.append(personDetail(state, scene, selected, options.onSelect));
      return root;
    }
  }
  root.append(el("h1", undefined, s.peopleTitle), thematicHeader("people"));
  root.append(el("p", "people-source", s.peopleSource));
  const active = state.people.filter((p) => p.alive && p.status === "active");
  const inactive = state.people.filter((p) => p.alive && p.status !== "active");
  const dead = state.people.filter((p) => !p.alive);
  root.append(el("h2", undefined, s.livingPeople));
  if (active.length === 0) root.append(el("p", "muted", s.noPeople));
  const list = el("div", "people-list");
  for (const p of active) list.append(personCard(state, scene, p, options.onSelect));
  root.append(list);
  if (inactive.length > 0) {
    const ended = el("details", "ended-people");
    ended.append(el("summary", undefined, s.personStatus("ended")));
    for (const p of inactive) ended.append(personCard(state, scene, p, options.onSelect));
    root.append(ended);
  }
  const memorial = el("details", "memorial");
  memorial.append(el("summary", undefined, `${s.memorial} · ${dead.length}`));
  if (dead.length === 0) memorial.append(el("p", "muted", s.noMemorial));
  for (const p of dead) memorial.append(personCard(state, scene, p, options.onSelect));
  root.append(memorial);
  return root;
}
