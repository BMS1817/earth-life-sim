import type { LifeState } from "../core/state.ts";
import { hashSeed } from "../core/rng.ts";
import { GROUND, SKY } from "./palette.ts";

export type Stage = "child" | "teen" | "adult" | "senior";
export type HouseLevel = "poor" | "mid" | "rich";
export type Climate = "north" | "temperate" | "tropics";

export function stageForAge(age: number): Stage {
  return age < 13 ? "child" : age < 20 ? "teen" : age < 60 ? "adult" : "senior";
}

export function houseForMoney(money: number): HouseLevel {
  return money < 33 ? "poor" : money < 66 ? "mid" : "rich";
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

const SKIN_TONES: [number, number, number][] = [
  [0xf0, 0xc8, 0xa0],
  [0xd8, 0xa8, 0x78],
  [0xa8, 0x78, 0x50],
  [0x6a, 0x48, 0x30],
];
const SKIN_BASE = [0xd8, 0xa8, 0x78];

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

export class Scene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheets = new Map<string, Sheet>();
  private people = new Map<Stage, HTMLCanvasElement>();
  private state: LifeState | null = null;
  private px = 0;

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
      this.sheets.set(`person_${stage}`, await loadSheet(`person_${stage}`));
    }
    for (const level of ["poor", "mid", "rich"]) {
      this.sheets.set(`house_${level}`, await loadSheet(`house_${level}`, "static"));
    }
    for (const climate of ["north", "temperate", "tropics"]) {
      for (const layer of ["sky", "far", "near"]) {
        this.sheets.set(`bg_${climate}_${layer}`, await loadSheet(`bg_${climate}_${layer}`, "static"));
      }
    }
  }

  update(state: LifeState): void {
    this.state = state;
    const tone = SKIN_TONES[hashSeed(state.seed) % SKIN_TONES.length];
    const stage = stageForAge(state.age);
    if (!this.people.has(stage)) {
      const sheet = this.sheets.get(`person_${stage}`)!;
      const off = document.createElement("canvas");
      off.width = sheet.img.width;
      off.height = sheet.img.height;
      const c = off.getContext("2d")!;
      c.drawImage(sheet.img, 0, 0);
      const data = c.getImageData(0, 0, off.width, off.height);
      for (let i = 0; i < data.data.length; i += 4) {
        if (
          data.data[i] === SKIN_BASE[0] &&
          data.data[i + 1] === SKIN_BASE[1] &&
          data.data[i + 2] === SKIN_BASE[2]
        ) {
          data.data[i] = tone[0];
          data.data[i + 1] = tone[1];
          data.data[i + 2] = tone[2];
        }
      }
      c.putImageData(data, 0, 0);
      this.people.set(stage, off);
    }
  }

  draw(time: number): void {
    if (!this.state) return;
    const s = this.state;
    const ctx = this.ctx;
    const climate = climateForCountry(s.birth.country.iso3);
    const sky = this.sheets.get(`bg_${climate}_sky`)!;
    const far = this.sheets.get(`bg_${climate}_far`)!;
    const near = this.sheets.get(`bg_${climate}_near`)!;
    const house = this.sheets.get(`house_${houseForMoney(s.scales.money)}`)!;
    const person = this.people.get(stageForAge(s.age))!;
    const personSheet = this.sheets.get(`person_${stageForAge(s.age)}`)!;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = SKY[climate];
    ctx.fillRect(0, 0, W, 128);
    ctx.fillStyle = GROUND[climate];
    ctx.fillRect(0, 96, W, H - 96);
    ctx.drawImage(sky.img, 0, 0);
    ctx.drawImage(far.img, Math.round(-this.px * 4), 32);
    ctx.drawImage(near.img, Math.round(-this.px * 10), 128);
    ctx.drawImage(house.img, 0, 0, 96, 80, 20, 96, 96, 80);
    const frame = Math.floor((time / 1000) * 4) % personSheet.frames;
    ctx.drawImage(person, frame * 48, 0, 48, 64, 150, 116, 48, 64);
  }
}
