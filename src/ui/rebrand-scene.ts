import type { LifeState } from "../core/state.ts";
import { ageStageForAge } from "../ui/appearance.ts";
import { Scene, climateForCountry, houseForMoney, warVisualMode } from "../ui/scene.ts";
import { resourceUrl } from "../ui/resource.ts";

type Climate = "north" | "temperate" | "tropics";
type ImageMap = Map<string, HTMLImageElement>;
type DisplayItem = { file: string; kind?: "shelf" | "floor" };

const AGE_NAMES = ["infant", "early", "child", "teen", "young", "adult", "mature", "senior", "elder"];
const HOBBIES = ["games", "sports", "reading", "music", "crafts", "nature"];

function loadImage(path: string, base: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(path));
    image.src = resourceUrl(`${base}/${path}`);
  });
}

function canvas(width: number, height: number, className?: string): HTMLCanvasElement {
  const node = document.createElement("canvas");
  node.width = width;
  node.height = height;
  if (className) node.className = className;
  return node;
}

export class RebrandScene extends Scene {
  private readonly rebrandElement = canvas(256, 192, "scene");
  private readonly rebrandCtx = this.rebrandElement.getContext("2d")!;
  private rebrandImages: ImageMap = new Map();
  private rebrandLoading: Promise<void> | null = null;
  private rebrandState: LifeState | null = null;
  private memorial = false;
  private bottoms = new Map<string, number>();

  private readonly assetBase: string;

  constructor(assetBase = "art/rebrand") {
    super();
    this.assetBase = assetBase;
    this.rebrandCtx.imageSmoothingEnabled = false;
  }

  override get element(): HTMLCanvasElement {
    return this.rebrandElement;
  }

  async prepare(state: LifeState, memorial = false, _people = false): Promise<boolean> {
    this.rebrandState = state;
    this.memorial = memorial;
    const firstLoad = this.rebrandLoading === null;
    if (firstLoad) this.rebrandLoading = this.load();
    await this.rebrandLoading;
    return firstLoad;
  }

  private async load(): Promise<void> {
    const paths = new Set<string>(["bg-north.png", "bg-temperate.png", "bg-tropics.png", "war-truck-64.png", "war-soldier-24.png", "war-smoke-48.png", "war-debris-48.png", "computer-32.png", "bicycle-icon-32.png", "car-memorial-32.png"]);
    AGE_NAMES.forEach((name, index) => paths.add(`age-${String(index).padStart(2, "0")}-${name}.png`));
    for (const climate of ["north", "temperate", "tropics"]) {
      paths.add(`interior-${climate}-128.png`);
      for (const wealth of ["poor", "mid", "rich"]) {
        paths.add(`house-${climate}-${wealth}.png`);
        paths.add(`house-${climate}-${wealth}-damaged.png`);
      }
    }
    for (const name of ["home", "rental", "business", "career", "partner", "child", "dog", "cat", "small"]) paths.add(`object-${name}-32.png`);
    HOBBIES.forEach((name) => paths.add(`hobby-${name}-32.png`));
    const entries = await Promise.all([...paths].map(async (path) => [path, await loadImage(path, this.assetBase)] as const));
    this.rebrandImages = new Map(entries);
  }

  update(state: LifeState): void {
    this.rebrandState = state;
  }

  private image(path: string): HTMLImageElement {
    const image = this.rebrandImages.get(path);
    if (!image) throw new Error(`Missing rebrand asset: ${path}`);
    return image;
  }

  private agePath(age: number): string {
    const index = AGE_NAMES.indexOf(ageStageForAge(age));
    return `age-${String(index).padStart(2, "0")}-${AGE_NAMES[index]}.png`;
  }

  private bottom(path: string): number {
    const cached = this.bottoms.get(path);
    if (cached !== undefined) return cached;
    const image = this.image(path);
    const buffer = canvas(image.width, image.height);
    const bufferCtx = buffer.getContext("2d")!;
    bufferCtx.drawImage(image, 0, 0);
    const data = bufferCtx.getImageData(0, 0, image.width, image.height).data;
    let bottom = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        if (data[(y * image.width + x) * 4 + 3] > 0) bottom = y + 1;
      }
    }
    this.bottoms.set(path, bottom);
    return bottom;
  }

  private drawScene(time: number): void {
    const state = this.rebrandState!;
    const climate = climateForCountry(state.birth.country.iso3) as Climate;
    const war = warVisualMode(state);
    const damaged = war === "off" ? "" : "-damaged";
    const house = `house-${climate}-${houseForMoney(state.scales.money)}${damaged}.png`;
    const ctx = this.rebrandCtx;
    ctx.clearRect(0, 0, 256, 192);
    ctx.drawImage(this.image(`bg-${climate}.png`), 0, 0);
    if (war === "military") {
      const drift = Math.floor(time / 350) % 4;
      ctx.drawImage(this.image("war-smoke-48.png"), 34, 46 + [0, -2, -4, -2][drift]);
      ctx.drawImage(this.image("war-debris-48.png"), 38, 148);
    }
    ctx.drawImage(this.image(house), 144, 80);
    if (state.property.items.includes("car")) ctx.drawImage(this.image("car-memorial-32.png"), 174, 136);
    if (state.property.items.includes("bicycle")) ctx.drawImage(this.image("bicycle-icon-32.png"), 182, 136);
    for (const [index, pet] of state.pets.filter((pet) => pet.deathYear === null).slice(0, 2).entries()) {
      ctx.drawImage(this.image(`object-${pet.kind}-32.png`), 48 + index * 32, 136);
    }
    if (war === "military") {
      ctx.drawImage(this.image("war-truck-64.png"), 184, 128);
      ctx.drawImage(this.image("war-soldier-24.png"), 172, 136);
    }
    if (state.lastFamilyPersonId) {
      const subject = state.people.find((person) => person.id === state.lastFamilyPersonId && person.alive);
      if (subject) {
        ctx.save();
        ctx.translate(224, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.image(this.agePath(state.birth.year + state.age - subject.birthYear)), 0, 128);
        ctx.restore();
      }
    }
    ctx.drawImage(this.image(this.agePath(state.age)), 96, 128);
  }

  private displayItems(state: LifeState): DisplayItem[] {
    const items: DisplayItem[] = [];
    const files = {
      computer: "computer-32.png",
      bicycle: "bicycle-icon-32.png",
      car: "car-memorial-32.png",
      home: "object-home-32.png",
    };
    for (const item of state.property.items) items.push({ file: files[item] });
    if (state.property.rentals > 0) items.push({ file: "object-rental-32.png" });
    if (state.property.business) items.push({ file: "object-business-32.png" });
    if (state.finance.career) items.push({ file: "object-career-32.png" });
    if (state.spouseId) items.push({ file: "object-partner-32.png" });
    if (state.people.some((person) => person.role === "child")) items.push({ file: "object-child-32.png" });
    for (const pet of state.pets) items.push({ file: `object-${pet.kind}-32.png` });
    for (const hobby of state.hobbies) {
      const kind = hobby.id === "sports" || hobby.id === "music" ? "floor" : "shelf";
      items.push({ file: `hobby-${hobby.id}-32.png`, kind });
    }
    return items;
  }

  private drawRoom(): void {
    const state = this.rebrandState!;
    const climate = climateForCountry(state.birth.country.iso3) as Climate;
    const ctx = this.rebrandCtx;
    ctx.clearRect(0, 0, 256, 192);
    ctx.drawImage(this.image(`interior-${climate}-128.png`), 0, 0, 256, 192);
    const shelves = [[42, 30], [80, 30], [80, 58], [42, 58]];
    let shelfIndex = 0;
    let floorIndex = 0;
    for (const item of this.displayItems(state)) {
      if (item.file === "hobby-games-32.png") {
        ctx.drawImage(this.image(item.file), 42, 58 - this.bottom(item.file));
      } else if (item.kind === "floor") {
        const x = item.file === "hobby-sports-32.png" ? 24 : 74;
        ctx.drawImage(this.image(item.file), x, 88 - this.bottom(item.file));
      } else if (shelfIndex < shelves.length) {
        const [x, y] = shelves[shelfIndex++];
        ctx.drawImage(this.image(item.file), x, y - this.bottom(item.file));
      } else if (floorIndex < 2) {
        const x = floorIndex++ === 0 ? 24 : 74;
        ctx.drawImage(this.image(item.file), x, 88 - this.bottom(item.file));
      }
    }
  }

  draw(time: number): void {
    if (!this.rebrandState || this.rebrandImages.size === 0) return;
    if (this.memorial) this.drawRoom();
    else this.drawScene(time);
  }

  thematicHeader(): HTMLCanvasElement {
    const node = canvas(256, 64, "thematic-header");
    const ctx = node.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    if (this.rebrandImages.size === 0) return node;
    const climate = this.rebrandState ? climateForCountry(this.rebrandState.birth.country.iso3) as Climate : "temperate";
    ctx.drawImage(this.image(`bg-${climate}.png`), 0, 0, 256, 64);
    if (this.rebrandState) ctx.drawImage(this.image(this.agePath(this.rebrandState.age)), 216, 32);
    return node;
  }

  portraitFor(personId: string, year: number): HTMLCanvasElement | null {
    if (!this.rebrandState || this.rebrandImages.size === 0) return null;
    const person = this.rebrandState.people.find((item) => item.id === personId);
    if (!person) return null;
    const climate = climateForCountry(this.rebrandState.birth.country.iso3) as Climate;
    const node = canvas(64, 64, "person-portrait");
    const ctx = node.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image(`interior-${climate}-128.png`), 0, 0, 64, 64);
    ctx.drawImage(this.image(this.agePath(year - person.birthYear)), 8, 0);
    return node;
  }

  memoryScene(state: LifeState, age: number, source: "hero" | "people" | "history" | "pattern" = "history", _career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const node = canvas(128, 72, "memory-scene");
    const ctx = node.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    if (this.rebrandImages.size === 0) return node;
    const climate = climateForCountry(state.birth.country.iso3) as Climate;
    if (source === "people") ctx.drawImage(this.image(`interior-${climate}-128.png`), 0, -12);
    else ctx.drawImage(this.image(`bg-${climate}.png`), 0, 0, 128, 96);
    ctx.drawImage(this.image(this.agePath(age)), 52, 32);
    return node;
  }

  dayScene(state: LifeState, age: number, _career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const node = canvas(256, 192, "gifted-day-canvas");
    const ctx = node.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    if (this.rebrandImages.size === 0) return node;
    const climate = climateForCountry(state.birth.country.iso3) as Climate;
    ctx.drawImage(this.image(`bg-${climate}.png`), 0, 0);
    ctx.drawImage(this.image(this.agePath(age)), 116, 128);
    return node;
  }

  heroPortrait(state: LifeState, age: number, _anim: "idle" | "happy" | "sad" = "idle", _career: LifeState["finance"]["career"] = null): HTMLCanvasElement {
    const node = canvas(64, 96, "memory-portrait");
    const ctx = node.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    if (this.rebrandImages.size === 0) return node;
    ctx.drawImage(this.image(this.agePath(age)), 8, 32);
    return node;
  }
}
