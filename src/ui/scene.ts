import type { LifeState } from "../core/state.ts";
import { hashSeed } from "../core/rng.ts";
import { resolvePerson } from "../core/turn.ts";
import type { Person } from "../core/people.ts";
import { FAMILY_EVENTS } from "../content/family-events.ts";
import { CLOTHING_BASE, CLOTHING_VARIANTS, GROUND, SKIN_BASE, SKIN_TONES, SKY } from "./palette.ts";

export type Stage = "child" | "teen" | "adult" | "senior";
export type HouseLevel = "poor" | "mid" | "rich";
export type Climate = "north" | "temperate" | "tropics";

export function stageForAge(age: number): Stage {
  return age < 13 ? "child" : age < 20 ? "teen" : age < 60 ? "adult" : "senior";
}

export function houseForMoney(money: number): HouseLevel {
  return money < 33 ? "poor" : money < 66 ? "mid" : "rich";
}

export function personVariant(seed: string): 0 | 1 | 2 {
  return (hashSeed(seed) % 3) as 0 | 1 | 2;
}

function personSheetKey(stage: Stage, variant: number, anim: "idle" | "happy" | "sad"): string {
  return `person_${stage}${variant === 0 ? "" : `_v${variant}`}_${anim}`;
}

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

const W = 256;
const H = 192;

interface Sheet {
  img: HTMLImageElement;
  frames: number;
  fps: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

async function loadSheet(base: string, anim = "idle"): Promise<Sheet> {
  const [img, meta] = await Promise.all([
    loadImage(`art/${base}_${anim}.png`),
    fetch(`art/${base}.json`).then((r) => r.json()),
  ]);
  const a = meta.animations[anim];
  return { img, frames: a.frames, fps: a.fps };
}

export function warVisualMode(s: LifeState): "off" | "military" | "civilian" {
  const active = s.war.pendingEventId !== null || s.lastOutcomeKind === "conflict";
  if (!active) return "off";
  return s.softenHeavy ? "civilian" : "military";
}

export class Scene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheets = new Map<string, Sheet>();
  private variants = new Map<string, HTMLCanvasElement>();
  private state: LifeState | null = null;
  private subject: Person | null = null;
  private px = 0;
  private anim: "idle" | "happy" | "sad" = "idle";
  private warMode: "off" | "military" | "civilian" = "off";

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = "scene";
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.addEventListener("pointermove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.px = (e.clientX - rect.left) / rect.width - 0.5;
    });
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  async load(): Promise<void> {
    for (const stage of ["child", "teen", "adult", "senior"] as Stage[]) {
      for (const variant of [0, 1, 2]) {
        const suffix = variant === 0 ? "" : `_v${variant}`;
        for (const anim of ["idle", "happy", "sad"] as const) {
          this.sheets.set(`person_${stage}${suffix}_${anim}`, await loadSheet(`person_${stage}${suffix}`, anim));
        }
      }
    }
    for (const level of ["poor", "mid", "rich"]) {
      this.sheets.set(`house_${level}`, await loadSheet(`house_${level}`, "static"));
    }
    for (const climate of ["north", "temperate", "tropics"]) {
      for (const layer of ["sky", "far", "near"]) {
        this.sheets.set(`bg_${climate}_${layer}`, await loadSheet(`bg_${climate}_${layer}`, "static"));
      }
    }
    for (const name of ["war_soldier", "war_tank", "war_smoke", "person_evacuee"]) {
      this.sheets.set(name, await loadSheet(name));
    }
    this.sheets.set("house_damaged", await loadSheet("house_damaged", "static"));
    for (const career of ["medicine", "education", "engineering", "industry", "agriculture", "services", "pilot"]) {
      this.sheets.set(`career_${career}`, await loadSheet(`career_${career}`));
    }
  }

  private variant(key: string, sheetKey: string, seed: string, clothing: number): HTMLCanvasElement {
    const cached = this.variants.get(key);
    if (cached) return cached;
    const sheet = this.sheets.get(sheetKey)!;
    const tone = SKIN_TONES[hashSeed(seed) % SKIN_TONES.length];
    const clothes = CLOTHING_VARIANTS[clothing % CLOTHING_VARIANTS.length];
    const off = document.createElement("canvas");
    off.width = sheet.img.width;
    off.height = sheet.img.height;
    const c = off.getContext("2d")!;
    c.drawImage(sheet.img, 0, 0);
    const data = c.getImageData(0, 0, off.width, off.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const rgb = [data.data[i], data.data[i + 1], data.data[i + 2]];
      if (rgb.every((v, j) => v === SKIN_BASE[j])) {
        for (let j = 0; j < 3; j++) data.data[i + j] = tone[j];
      } else if (rgb.every((v, j) => v === CLOTHING_BASE[0][j])) {
        for (let j = 0; j < 3; j++) data.data[i + j] = clothes[0][j];
      } else if (rgb.every((v, j) => v === CLOTHING_BASE[1][j])) {
        for (let j = 0; j < 3; j++) data.data[i + j] = clothes[1][j];
      }
    }
    c.putImageData(data, 0, 0);
    this.variants.set(key, off);
    return off;
  }

  update(state: LifeState): void {
    this.state = state;
    this.warMode = warVisualMode(state);
    const sum = Object.values(state.lastArrows ?? {}).reduce((a, b) => a + b, 0);
    this.anim = state.lastOutcome === null ? "idle" : sum >= 0 ? "happy" : "sad";
    this.subject = null;
    if (state.lastFamilyPersonId) {
      this.subject = state.people.find((p) => p.id === state.lastFamilyPersonId) ?? null;
    } else if (state.pendingFamilyEventId) {
      const event = FAMILY_EVENTS.find((e) => e.id === state.pendingFamilyEventId);
      if (event?.subject) this.subject = resolvePerson(state, event.subject, event.id, event.crisis) ?? null;
    }
  }

  portraitFor(personId: string, year: number): HTMLCanvasElement | null {
    if (!this.state) return null;
    const person = this.state.people.find((p) => p.id === personId);
    if (!person) return null;
    const stage = stageForAge(year - person.birthYear);
    const variant = personVariant(person.id);
    const image = this.variant(`portrait:${person.id}:${stage}`, personSheetKey(stage, variant, "idle"), `${this.state.seed}:${person.id}`, 1 + hashSeed(person.id) % (CLOTHING_VARIANTS.length - 1));
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 64;
    canvas.className = "person-portrait";
    canvas.getContext("2d")!.drawImage(image, 0, 0, 48, 64, 0, 0, 48, 64);
    return canvas;
  }

  heroPortrait(state: LifeState, age: number, anim: "idle" | "happy" | "sad" = "idle", career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const stage = stageForAge(age);
    const variant = personVariant(state.seed);
    const useCareer = career !== null && age >= 18;
    const sheetKey = useCareer ? `career_${career}` : personSheetKey(stage, variant, anim);
    const key = useCareer ? `career-${career}` : `${stage}_${variant}_${anim}`;
    const image = this.variant(`memory:${state.seed}:${key}`, sheetKey, state.seed, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 64;
    canvas.className = "memory-portrait";
    canvas.getContext("2d")!.imageSmoothingEnabled = false;
    canvas.getContext("2d")!.drawImage(image, 0, 0, 48, 64, 0, 0, 48, 64);
    return canvas;
  }

  draw(time: number): void {
    if (!this.state) return;
    const s = this.state;
    const ctx = this.ctx;
    const climate = climateForCountry(s.birth.country.iso3);
    const sky = this.sheets.get(`bg_${climate}_sky`)!;
    const far = this.sheets.get(`bg_${climate}_far`)!;
    const near = this.sheets.get(`bg_${climate}_near`)!;
    const house = this.sheets.get(this.warMode === "off" ? `house_${houseForMoney(s.scales.money)}` : "house_damaged")!;
    const displaced = s.war.displacedUntil !== null && s.age >= 18;
    const career = !displaced && this.warMode === "off" && s.age >= 18 ? s.finance.career : null;
    const stage = stageForAge(s.age);
    const variant = personVariant(s.seed);
    const key = displaced ? "evacuee" : career ?? `${stage}_${variant}_${this.anim}`;
    const sheetKey = displaced ? "person_evacuee_idle" : career ? `career_${career}` : personSheetKey(stage, variant, this.anim);
    const person = this.variant(`hero:${s.seed}:${key}`, sheetKey, s.seed, 0);
    const personSheet = this.sheets.get(sheetKey)!;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = SKY[climate];
    ctx.fillRect(0, 0, W, 128);
    ctx.fillStyle = GROUND[climate];
    ctx.fillRect(0, 96, W, H - 96);
    ctx.drawImage(sky.img, 0, 0);
    const farX = Math.round(-this.px * 4);
    const nearX = Math.round(-this.px * 10);
    for (const x of [farX - W, farX, farX + W]) ctx.drawImage(far.img, x, 32);
    for (const x of [nearX - W, nearX, nearX + W]) ctx.drawImage(near.img, x, 128);
    if (this.warMode === "military") {
      const smoke = this.sheets.get("war_smoke")!;
      const tank = this.sheets.get("war_tank")!;
      const soldier = this.sheets.get("war_soldier")!;
      const warFrame = Math.floor((time / 1000) * 4) % 4;
      ctx.drawImage(smoke.img, warFrame * 96, 0, 96, 80, 34, 32, 96, 80);
      ctx.drawImage(tank.img, warFrame * 96, 0, 96, 64, 150, 116, 96, 64);
      ctx.drawImage(soldier.img, warFrame * 48, 0, 48, 64, 88, 108, 48, 64);
      ctx.drawImage(soldier.img, ((warFrame + 1) % 4) * 48, 0, 48, 64, 104, 108, 48, 64);
    }
    ctx.drawImage(house.img, 0, 0, 96, 80, 20, 96, 96, 80);
    if (this.subject?.alive) {
      const subjectStage = stageForAge(s.birth.year + s.age - this.subject.birthYear);
      const subjectSheetKey = personSheetKey(subjectStage, personVariant(this.subject.id), "idle");
      const sheet = this.sheets.get(subjectSheetKey)!;
      const image = this.variant(`npc:${this.subject.id}:${subjectStage}`, subjectSheetKey, `${s.seed}:${this.subject.id}`, 1 + hashSeed(this.subject.id) % (CLOTHING_VARIANTS.length - 1));
      const frame = (Math.floor((time / 1000) * 4) + hashSeed(this.subject.id)) % sheet.frames;
      ctx.save();
      ctx.translate(148, 116);
      ctx.scale(-1, 1);
      ctx.drawImage(image, frame * 48, 0, 48, 64, 0, 0, 48, 64);
      ctx.restore();
    }
    const frame = Math.floor((time / 1000) * 4) % personSheet.frames;
    ctx.drawImage(person, frame * 48, 0, 48, 64, 156, 116, 48, 64);
  }
}
