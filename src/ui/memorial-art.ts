import { MEMORIAL_PALETTE as C } from "../content/memorial.ts";
import type { GiftedDay, RoomItemKind } from "../core/memorial.ts";
import type { HappinessPoint, LifeState } from "../core/state.ts";
import { climateForCountry } from "./scene.ts";
import { resourceUrl } from "./resource.ts";

const IMAGE_CACHE = new Map<string, Promise<HTMLImageElement>>();

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function loadImage(name: string): Promise<HTMLImageElement> {
  let cached = IMAGE_CACHE.get(name);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        image.onload = null;
        image.onerror = null;
        resolve(image);
      };
      image.onerror = () => {
        image.onload = null;
        image.onerror = null;
        reject(new Error(name));
      };
      image.src = resourceUrl(`art/kimi/${name}.png`);
    });
    IMAGE_CACHE.set(name, cached);
  }
  return cached;
}

function drawWithAssets(canvas: HTMLCanvasElement, names: string[], render: (images: HTMLImageElement[]) => void): void {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.paper, 0, 0, canvas.width, canvas.height);
  void Promise.all(names.map(loadImage)).then(render).catch(() => rect(ctx, C.pink, 0, 0, canvas.width, canvas.height));
}

export function drawMemorialRoom(canvas: HTMLCanvasElement, state: LifeState, hero: HTMLCanvasElement, items: RoomItemKind[]): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const climate = climateForCountry(state.birth.country.iso3);
  const objectNames = [...new Set(items)];
  drawWithAssets(canvas, [`room_${climate}`, ...objectNames.map((item) => `object_${item}`)], (images) => {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(images[0], 0, 0);
    const shelfX = [122, 140, 158, 194, 212];
    objectNames.slice(0, 10).forEach((item, index) => {
      const x = shelfX[index % shelfX.length];
      const y = index < shelfX.length ? 40 : 76;
      ctx.drawImage(images[index + 1], x, y, 16, 16);
    });
    ctx.drawImage(hero, 96, 88, 64, 96);
  });
}

export function drawHappinessChart(canvas: HTMLCanvasElement, history: HappinessPoint[], color: string): void {
  canvas.width = 256;
  canvas.height = 112;
  canvas.className = "happiness-chart";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.night, 0, 0, 256, 112);
  for (const value of [0, 25, 50, 75, 100]) {
    const y = 100 - value;
    rect(ctx, C.wallLight, 8, y, 240, 1);
  }
  if (history.length === 0) return;
  const firstYear = history[0].year;
  const lastYear = history.at(-1)!.year;
  const span = Math.max(1, lastYear - firstYear);
  for (let x = 0; x < 240; x++) {
    const year = firstYear + (x / 239) * span;
    let right = history.findIndex((point) => point.year >= year);
    if (right < 0) right = history.length - 1;
    const left = Math.max(0, right - 1);
    const a = history[left];
    const b = history[right];
    const mix = a === b ? 0 : (year - a.year) / Math.max(1, b.year - a.year);
    const value = a.value + (b.value - a.value) * mix;
    const y = Math.max(0, Math.min(100, Math.round(100 - value)));
    rect(ctx, color, 8 + x, y, 2, 2);
  }
  rect(ctx, C.gold, 8, 100, 240, 2);
}

function giftedObject(day: GiftedDay): RoomItemKind | null {
  if (day.kind === "career") return "career";
  if (day.kind !== "hobby" || !day.hobby) return null;
  const objects: Record<typeof day.hobby, RoomItemKind> = {
    games: "hobbyGames",
    sports: "hobbySports",
    reading: "hobbyReading",
    music: "hobbyMusic",
    crafts: "hobbyCrafts",
    nature: "hobbyNature",
  };
  return objects[day.hobby];
}

export function drawGiftedDay(canvas: HTMLCanvasElement, state: LifeState, hero: HTMLCanvasElement, day: GiftedDay): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const background = day.kind === "career" ? "career" : day.kind === "hobby" && day.hobby ? day.hobby : "dream";
  const object = giftedObject(day);
  const names = [`dream_${background}`, ...(object ? [`object_${object}`] : [])];
  drawWithAssets(canvas, names, (images) => {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(images[0], 0, 0);
    if (object) ctx.drawImage(images[1], 32, 96, 64, 64);
    ctx.drawImage(hero, 96, 88, 64, 96);
  });
}
