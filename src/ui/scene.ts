import type { LifeState } from "../core/state.ts";
import type { Person } from "../core/people.ts";
import { resolvePerson } from "../core/turn.ts";
import type { Sex } from "../core/types.ts";
import { FAMILY_EVENTS } from "../content/family-events.ts";
import { climateForCountry } from "../content/climates.ts";
import { GROUND, PIXEL_INK, SKIN_TONES, SKY } from "./palette.ts";
import { AGE_STAGES, ageStageForAge, appearanceForSeed } from "./appearance.ts";
import type { AgeStage } from "./appearance.ts";
import { resourceUrl } from "./resource.ts";

export { climateForCountry } from "../content/climates.ts";
export type { Climate } from "../content/climates.ts";
export type Stage = AgeStage;

export type HouseLevel = "poor" | "mid" | "rich";
export type Reaction = "idle" | "happy" | "sad";
type Climate = "north" | "temperate" | "tropics";
type RGB = [number, number, number];

interface HeadInfo {
  eye: [number, number] | null;
  skin: RGB | null;
  skullBase?: [number, number];
  neckCenter?: [number, number];
  neckBottom?: [number, number];
  tabLeft?: number;
  visibleNeck?: number;
  xOffset?: number;
  hideNeck?: boolean;
  frontColor?: RGB | null;
}

interface BodyInfo {
  skin: RGB | null;
  socketTop?: [number, number];
  socketCenter?: [number, number];
  interior?: [number, number, number, number];
}

interface AgeAssets {
  key: string;
  bodyHeight: number;
  headHeight: number;
  heads: string;
  bodies: string;
  headInfo: HeadInfo[];
  bodyInfo: BodyInfo[];
  front?: string;
  portraitHeads?: string;
  neckWidth?: number;
  careers?: Record<string, string>;
}

interface ArtManifest {
  frame: [number, number];
  ages: AgeAssets[];
  careers: Record<string, string>;
  houses?: Record<string, { size: [number, number]; anchor: [number, number] }>;
  socket?: boolean;
}

const W = 256;
const H = 192;
const FRAME_W = 64;
const FRAME_H = 96;
const FRAME_COUNT = 8;
const REACTION_MS = 1200;
const CLIMATES: Climate[] = ["north", "temperate", "tropics"];
const IDLE_HEAD = [0, 0, 0, -1, -1, -1, 0, 0];
const IDLE_BODY = [0, 0, 0, 0, -1, 0, 0, 0];
const NECK_OVERLAP = 8;
const PEOPLE_CACHE_LIMIT = 128;
const MEMORY_CACHE_LIMIT = 64;

export function stageForAge(age: number): Stage {
  return ageStageForAge(age);
}

export function houseForMoney(money: number): HouseLevel {
  return money < 33 ? "poor" : money < 66 ? "mid" : "rich";
}

export function personVariant(seed: string): 0 | 1 | 2 {
  return appearanceForSeed(seed, "M").body;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      resolve(img);
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(url));
    };
    img.src = resourceUrl(url);
  });
}

function emptyCanvas(width = FRAME_W, height = FRAME_H): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cacheRead(cache: Map<string, HTMLCanvasElement>, key: string): HTMLCanvasElement | undefined {
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
  }
  return cached;
}

function cacheWrite(cache: Map<string, HTMLCanvasElement>, key: string, canvas: HTMLCanvasElement, limit: number): void {
  if (cache.size >= limit) cache.delete(cache.keys().next().value!);
  cache.set(key, canvas);
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = emptyCanvas(source.width, source.height);
  canvas.className = source.className;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function cropImage(image: HTMLImageElement, x: number, y: number, width: number, height: number): HTMLCanvasElement {
  const canvas = emptyCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function drawTiled(ctx: CanvasRenderingContext2D, image: HTMLImageElement, offsetX: number, y: number): void {
  for (const index of [-1, 0, 1]) {
    const x = offsetX + index * W;
    if (index % 2 === 0) {
      ctx.drawImage(image, x, y);
    } else {
      ctx.save();
      ctx.translate(x + W, y);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }
  }
}

function contentBounds(canvas: HTMLCanvasElement): { top: number; bottom: number } {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  let top = canvas.height;
  let bottom = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return { top, bottom };
}

function recolorSkin(canvas: HTMLCanvasElement, source: RGB | null, target: RGB): void {
  if (!source) return;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sourceLuma = source[0] * 0.299 + source[1] * 0.587 + source[2] * 0.114;
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3] === 0) continue;
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    if (r <= g || g < b || r < 70) continue;
    const distance = Math.hypot(r - source[0], g - source[1], b - source[2]);
    if (distance > 105) continue;
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const ratio = Math.max(0.45, Math.min(1.65, luma / sourceLuma));
    data.data[i] = Math.min(255, Math.round(target[0] * ratio));
    data.data[i + 1] = Math.min(255, Math.round(target[1] * ratio));
    data.data[i + 2] = Math.min(255, Math.round(target[2] * ratio));
  }
  ctx.putImageData(data, 0, 0);
}

export function warVisualMode(s: LifeState): "off" | "military" | "civilian" {
  if (s.war.pendingEventId === null) return "off";
  return s.softenHeavy ? "civilian" : "military";
}

export class Scene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameCanvas: HTMLCanvasElement;
  private frameCtx: CanvasRenderingContext2D;
  private images = new Map<string, HTMLImageElement>();
  private pending = new Map<string, Promise<HTMLImageElement>>();
  private peopleCache = new Map<string, HTMLCanvasElement>();
  private memoryCache = new Map<string, HTMLCanvasElement>();
  private manifest: ArtManifest | null = null;
  private manifestPending: Promise<ArtManifest> | null = null;
  private state: LifeState | null = null;
  private subject: Person | null = null;
  private px = 0;
  private reaction: Reaction = "idle";
  private reactionUntil = 0;
  private outcomeKey: string | null = null;
  private hasCompleteFrame = false;
  private lastDrawKey = "";
  private warMode: "off" | "military" | "civilian" = "off";
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor() {
    this.canvas = emptyCanvas(W, H);
    this.canvas.className = "scene";
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.frameCanvas = emptyCanvas(W, H);
    this.frameCtx = this.frameCanvas.getContext("2d")!;
    this.frameCtx.imageSmoothingEnabled = false;
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.reducedMotion) return;
      const rect = this.canvas.getBoundingClientRect();
      this.px = (event.clientX - rect.left) / rect.width - 0.5;
    });
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  private ensureManifest(): Promise<ArtManifest> {
    if (this.manifest) return Promise.resolve(this.manifest);
    if (!this.manifestPending) {
      this.manifestPending = fetch(resourceUrl("art/kimi/manifest.json")).then((response) => response.json()).then((manifest: ArtManifest) => {
        this.manifest = manifest;
        return manifest;
      });
    }
    return this.manifestPending;
  }

  private ensureImage(name: string): Promise<HTMLImageElement> {
    const loaded = this.images.get(name);
    if (loaded) return Promise.resolve(loaded);
    let pending = this.pending.get(name);
    if (!pending) {
      pending = loadImage(`art/kimi/${name}.png`).then((image) => {
        this.images.set(name, image);
        return image;
      }).finally(() => this.pending.delete(name));
      this.pending.set(name, pending);
    }
    return pending;
  }

  private subjectFor(state: LifeState): Person | null {
    if (state.lastFamilyPersonId) return state.people.find((person) => person.id === state.lastFamilyPersonId) ?? null;
    if (state.pendingFamilyEventId) {
      const event = FAMILY_EVENTS.find((item) => item.id === state.pendingFamilyEventId);
      if (event?.subject) return resolvePerson(state, event.subject, event.id, event.crisis) ?? null;
    }
    return null;
  }

  async prepare(state: LifeState, memorial = false, people = false): Promise<boolean> {
    await this.ensureManifest();
    const manifest = this.manifest!;
    const tasks = new Map<string, Promise<HTMLImageElement>>();
    const add = (name: string) => {
      if (!this.images.has(name)) tasks.set(name, this.ensureImage(name));
    };
    const mode = warVisualMode(state);
    const climate = climateForCountry(state.birth.country.iso3);
    for (const layer of ["sky", "far", "near"]) add(`bg_${climate}_${layer}`);
    const house = `house_${climate}_${houseForMoney(state.scales.money)}${mode === "off" ? "" : "_damaged"}`;
    add(house);
    const subject = this.subjectFor(state);
    const ageKeys = new Set([ageStageForAge(state.age)]);
    if (subject?.alive) ageKeys.add(ageStageForAge(state.birth.year + state.age - subject.birthYear));
    const ages = memorial || people ? manifest.ages : manifest.ages.filter((age) => ageKeys.has(age.key.slice(3) as AgeStage));
    for (const age of ages) {
      add(age.heads.replace(/\.png$/, ""));
      add(age.bodies.replace(/\.png$/, ""));
      if (age.front) add(age.front.replace(/\.png$/, ""));
      if ((memorial || people) && age.portraitHeads) add(age.portraitHeads.replace(/\.png$/, ""));
    }
    if (memorial || people) add(`portrait_${climate}`);
    if (memorial) {
      add(`room_${climate}`);
      for (const dream of ["reading", "sports", "music", "crafts", "nature", "games", "career", "dream"]) add(`dream_${dream}`);
      for (const age of manifest.ages.filter((assets) => Number(assets.key.slice(0, 2)) >= 4)) {
        for (const career of Object.keys(manifest.careers)) {
          add((age.careers?.[career] ?? `career_${career}_${age.key}.png`).replace(/\.png$/, ""));
        }
      }
    } else if (state.age >= 18 && state.finance.career) {
      const assets = this.ageAssets(state.age);
      add((assets.careers?.[state.finance.career] ?? `career_${state.finance.career}_${assets.key}.png`).replace(/\.png$/, ""));
    }
    const displaced = state.war.displacedUntil !== null && state.age >= 18;
    if (displaced) add("person_evacuee");
    if (mode === "military") {
      for (const name of ["war_soldier", "war_vehicle", "war_smoke"]) add(name);
    }
    await Promise.all(tasks.values());
    return tasks.size > 0;
  }

  update(state: LifeState): void {
    this.state = state;
    this.warMode = warVisualMode(state);
    const outcomeKey = state.lastOutcome === null ? null : `${state.birth.year + state.age}:${state.lastOutcomeKind}:${state.lastOutcome}`;
    if (outcomeKey !== this.outcomeKey) {
      this.outcomeKey = outcomeKey;
      const sum = Object.values(state.lastArrows ?? {}).reduce((a, b) => a + b, 0);
      this.reaction = outcomeKey === null ? "idle" : sum >= 0 ? "happy" : "sad";
      this.reactionUntil = outcomeKey === null ? 0 : performance.now() + REACTION_MS;
    }
    this.subject = this.subjectFor(state);
  }

  private ageAssets(age: number): AgeAssets {
    const key = ageStageForAge(age);
    return this.manifest!.ages.find((assets) => assets.key.endsWith(`_${key}`))!;
  }

  private personSheet(seed: string, sex: Sex, age: number, climate: Climate, reaction: Reaction, career: LifeState["finance"]["career"]): HTMLCanvasElement {
    const appearance = appearanceForSeed(seed, sex);
    const assets = this.ageAssets(age);
    const useCareer = career !== null && age >= 18;
    const key = [seed, sex, assets.key, climate, reaction, useCareer ? career : ""].join(":");
    const cached = cacheRead(this.peopleCache, key);
    if (cached) return cached;
    const heads = this.images.get(assets.heads.replace(/\.png$/, ""));
    const careerBodies = useCareer && career ? assets.careers?.[career]?.replace(/\.png$/, "") : null;
    const bodies = this.images.get(careerBodies ?? assets.bodies.replace(/\.png$/, ""));
    const frontName = assets.front ? assets.front.replace(/\.png$/, "") : null;
    const frontImage = frontName ? this.images.get(frontName) : null;
    if (!heads || !bodies || (frontName && !frontImage)) return emptyCanvas(FRAME_W, FRAME_H);
    const bodyColumn = (sex === "F" ? 0 : 3) + appearance.body;
    const bodyRow = CLIMATES.indexOf(climate);
    const headIndex = (sex === "F" ? 0 : 6) + appearance.face;
    const headColumn = headIndex % 6;
    const headRow = Math.floor(headIndex / 6);
    const body = cropImage(bodies, bodyColumn * 64, bodyRow * 96, 64, 96);
    const head = cropImage(heads, headColumn * 64, headRow * 64, 64, 64);
    const front = frontImage ? cropImage(frontImage, headColumn * 64, headRow * 64, 64, 64) : null;
    const targetSkin = SKIN_TONES[appearance.skin];
    recolorSkin(body, assets.bodyInfo[bodyRow * 6 + bodyColumn]?.skin ?? null, targetSkin);
    recolorSkin(head, assets.headInfo[headIndex]?.skin ?? null, targetSkin);
    if (front) recolorSkin(front, assets.headInfo[headIndex]?.skin ?? null, targetSkin);
    const garmentName = useCareer && !careerBodies ? `career_${career}_${assets.key}` : null;
    const garmentImage = garmentName ? this.images.get(garmentName) : null;
    const garment = garmentImage ? cropImage(garmentImage, (bodyRow + (sex === "F" ? 0 : 3)) * 64, 0, 64, 48) : null;
    const sheet = emptyCanvas(FRAME_W * FRAME_COUNT, FRAME_H);
    const ctx = sheet.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const bodyY = contentBounds(body).top;
    const headTop = contentBounds(head).top;
    const legacyHeadY = bodyY + NECK_OVERLAP - contentBounds(head).bottom;
    const headInfo = assets.headInfo[headIndex];
    const bodyInfo = assets.bodyInfo[bodyRow * 6 + bodyColumn];
    const socket = this.manifest!.socket && headInfo?.skullBase && headInfo.neckCenter && headInfo.tabLeft !== undefined && headInfo.visibleNeck !== undefined && bodyInfo?.socketTop && bodyInfo.socketCenter && bodyInfo.interior;
    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      const x = frame * FRAME_W;
      const bodyOffset = IDLE_BODY[frame] + (reaction === "happy" ? -1 : reaction === "sad" ? 1 : 0);
      const headOffset = IDLE_HEAD[frame] + (reaction === "happy" ? -2 : reaction === "sad" ? 2 : 0);
      let headX = 0;
      let headY = legacyHeadY + headOffset;
      if (socket) {
        const socketY = bodyInfo.socketTop![1];
        headX = bodyInfo.socketCenter![0] - headInfo.neckCenter![0] + (headInfo.xOffset ?? 0);
        const baseY = socketY + 1 - headInfo.visibleNeck! - headInfo.skullBase![1];
        const safeBaseY = Math.max(baseY, 1 - headTop);
        headY = Math.max(safeBaseY + headOffset, 1 - headTop);
        const neckX = headInfo.hideNeck ? bodyInfo.interior![0] : headX + headInfo.tabLeft!;
        const neckTop = headY + headInfo.skullBase![1];
        const neckBottom = socketY + 6;
        const connector = headInfo.hideNeck ? headInfo.frontColor : targetSkin;
        if (connector) {
          ctx.fillStyle = `rgb(${connector.join(",")})`;
          ctx.fillRect(x + neckX, neckTop, assets.neckWidth ?? 5, neckBottom - neckTop + 1);
        }
      }
      ctx.drawImage(head, x + headX, headY);
      ctx.drawImage(body, x, 0);
      if (front && socket) ctx.drawImage(front, x + headX, headY);
      if (garment) ctx.drawImage(garment, x, bodyY + bodyOffset);
      const eye = headInfo?.eye;
      if (frame === 4 && eye) {
        const eyeX = x + headX + eye[0];
        const eyeY = headY + eye[1];
        ctx.fillStyle = `rgb(${targetSkin.join(",")})`;
        ctx.fillRect(eyeX - 2, eyeY - 1, 4, 3);
        ctx.fillStyle = PIXEL_INK;
        ctx.fillRect(eyeX - 2, eyeY, 4, 1);
      }
    }
    cacheWrite(this.peopleCache, key, sheet, PEOPLE_CACHE_LIMIT);
    return sheet;
  }

  portraitFor(personId: string, year: number): HTMLCanvasElement | null {
    if (!this.state || !this.manifest) return null;
    const person = this.state.people.find((item) => item.id === personId);
    if (!person) return null;
    const climate = climateForCountry(this.state.birth.country.iso3);
    const background = this.images.get(`portrait_${climate}`);
    const assets = this.ageAssets(year - person.birthYear);
    const portraitHeads = assets.portraitHeads ?? assets.heads;
    const heads = this.images.get(portraitHeads.replace(/\.png$/, ""));
    if (!background || !heads) return null;
    const appearance = appearanceForSeed(`${this.state.seed}:${person.id}`, person.sex);
    const index = (person.sex === "F" ? 0 : 6) + appearance.face;
    const head = cropImage(heads, (index % 6) * 64, Math.floor(index / 6) * 64, 64, 64);
    recolorSkin(head, assets.headInfo[index]?.skin ?? null, SKIN_TONES[appearance.skin]);
    const canvas = emptyCanvas(64, 64);
    canvas.className = "person-portrait";
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(background, 0, 0);
    ctx.drawImage(head, 0, 0);
    return canvas;
  }

  memoryScene(state: LifeState, age: number, source: "hero" | "people" | "history" | "pattern" = "history", career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const key = `${state.seed}:${age}:${source}:${career ?? ""}`;
    const cached = cacheRead(this.memoryCache, key);
    if (cached) return copyCanvas(cached);
    const canvas = emptyCanvas(128, 72);
    canvas.className = "memory-scene";
    if (!this.manifest) return canvas;
    const climate = climateForCountry(state.birth.country.iso3);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const room = source === "people" ? this.images.get(`room_${climate}`) : null;
    const dream = source === "hero" && career ? this.images.get("dream_career") : null;
    if (room || dream) {
      const image = room ?? dream!;
      ctx.drawImage(image, 0, 24, 256, 144, 0, 0, 128, 72);
    } else {
      const sky = this.images.get(`bg_${climate}_sky`);
      const far = this.images.get(`bg_${climate}_far`);
      const near = this.images.get(`bg_${climate}_near`);
      ctx.fillStyle = SKY[climate];
      ctx.fillRect(0, 0, 128, 40);
      ctx.fillStyle = GROUND[climate];
      ctx.fillRect(0, 40, 128, 32);
      if (sky) ctx.drawImage(sky, 0, 0, 256, 96, 0, 0, 128, 48);
      if (far) ctx.drawImage(far, 0, 0, 256, 96, 0, 16, 128, 48);
      if (near) ctx.drawImage(near, 0, 0, 256, 64, 0, 40, 128, 32);
    }
    const person = this.personSheet(state.seed, state.birth.sex, age, climate, "happy", career);
    if (person.width === FRAME_W * FRAME_COUNT) ctx.drawImage(person, 0, 0, 64, 96, 48, 24, 32, 48);
    cacheWrite(this.memoryCache, key, canvas, MEMORY_CACHE_LIMIT);
    return copyCanvas(canvas);
  }

  heroPortrait(state: LifeState, age: number, anim: Reaction = "idle", career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const canvas = emptyCanvas();
    canvas.className = "memory-portrait";
    if (!this.manifest) return canvas;
    const climate = climateForCountry(state.birth.country.iso3);
    const sheet = this.personSheet(state.seed, state.birth.sex, age, climate, anim, career);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, 0, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    return canvas;
  }

  draw(time: number): void {
    if (!this.state || !this.manifest) return;
    const state = this.state;
    const ctx = this.frameCtx;
    const animationTime = this.reducedMotion ? 0 : time;
    const climate = climateForCountry(state.birth.country.iso3);
    const sky = this.images.get(`bg_${climate}_sky`);
    const far = this.images.get(`bg_${climate}_far`);
    const near = this.images.get(`bg_${climate}_near`);
    const houseName = `house_${climate}_${houseForMoney(state.scales.money)}${this.warMode === "off" ? "" : "_damaged"}`;
    const house = this.images.get(houseName);
    const displaced = state.war.displacedUntil !== null && state.age >= 18;
    const career = !displaced && this.warMode === "off" && state.age >= 18 ? state.finance.career : null;
    const reaction = time < this.reactionUntil ? this.reaction : "idle";
    const person = this.personSheet(state.seed, state.birth.sex, state.age, climate, reaction, career);
    if (!sky || !far || !near || !house || person.width !== FRAME_W * FRAME_COUNT) {
      if (!this.hasCompleteFrame) {
        this.ctx.fillStyle = SKY[climate];
        this.ctx.fillRect(0, 0, W, 128);
        this.ctx.fillStyle = GROUND[climate];
        this.ctx.fillRect(0, 96, W, H - 96);
      }
      return;
    }
    const frame = Math.floor((animationTime / 1000) * 8) % FRAME_COUNT;
    const warFrame = Math.floor((animationTime / 1000) * 4) % 4;
    const farX = Math.round(-this.px * 4);
    const nearX = Math.round(-this.px * 10);
    const drawKey = [state.seed, state.age, houseName, displaced, career, reaction, frame, warFrame, farX, nearX, this.warMode, this.subject?.id, this.subject?.alive, this.images.size].join(":");
    if (drawKey === this.lastDrawKey) return;
    this.lastDrawKey = drawKey;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = SKY[climate];
    ctx.fillRect(0, 0, W, 128);
    ctx.fillStyle = GROUND[climate];
    ctx.fillRect(0, 96, W, H - 96);
    ctx.drawImage(sky, 0, 0);
    drawTiled(ctx, far, farX, 32);
    drawTiled(ctx, near, nearX, 128);
    if (this.warMode === "military") {
      const smoke = this.images.get("war_smoke");
      const vehicle = this.images.get("war_vehicle");
      if (smoke && vehicle) {
        const smokeOffsets = [0, -2, -4, -2];
        ctx.drawImage(smoke, 34, 32 + smokeOffsets[warFrame]);
        ctx.drawImage(vehicle, 150, 64);
      }
    }
    const houseAnchor = this.manifest.houses?.[houseName]?.anchor ?? [20 + house.width / 2, 96 + house.height];
    ctx.drawImage(house, Math.round(houseAnchor[0] - house.width / 2), Math.round(houseAnchor[1] - house.height));
    const soldier = this.warMode === "military" ? this.images.get("war_soldier") : null;
    if (soldier) ctx.drawImage(soldier, 48, 92);
    if (this.subject?.alive) {
      const subjectAge = state.birth.year + state.age - this.subject.birthYear;
      const subjectSheet = this.personSheet(`${state.seed}:${this.subject.id}`, this.subject.sex, subjectAge, climate, "idle", null);
      if (subjectSheet.width === FRAME_W * FRAME_COUNT) {
        ctx.save();
        ctx.translate(176 + FRAME_W, 92);
        ctx.scale(-1, 1);
        ctx.drawImage(subjectSheet, frame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
        ctx.restore();
      }
    }
    const personImage = displaced ? this.images.get("person_evacuee") : null;
    if (personImage) ctx.drawImage(personImage, 96, 92);
    else ctx.drawImage(person, frame * FRAME_W, 0, FRAME_W, FRAME_H, 96, 92, FRAME_W, FRAME_H);
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.drawImage(this.frameCanvas, 0, 0);
    this.hasCompleteFrame = true;
  }
}

export { AGE_STAGES };
