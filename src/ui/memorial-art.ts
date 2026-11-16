import { MEMORIAL_PALETTE as C } from "../content/memorial.ts";
import type { GiftedDay, RoomItemKind } from "../core/memorial.ts";
import type { HappinessPoint, LifeState } from "../core/state.ts";
import { climateForCountry } from "./scene.ts";
import { GROUND, SKY } from "./palette.ts";

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawIcon(ctx: CanvasRenderingContext2D, kind: RoomItemKind, x: number, y: number): void {
  if (kind === "computer") {
    rect(ctx, C.blue, x + 2, y + 1, 12, 9);
    rect(ctx, C.ink, x + 4, y + 3, 8, 5);
    rect(ctx, C.gold, x + 7, y + 10, 2, 3);
    rect(ctx, C.gold, x + 4, y + 13, 8, 2);
  } else if (kind === "bicycle") {
    rect(ctx, C.light, x + 1, y + 8, 5, 5);
    rect(ctx, C.ink, x + 2, y + 9, 3, 3);
    rect(ctx, C.light, x + 10, y + 8, 5, 5);
    rect(ctx, C.ink, x + 11, y + 9, 3, 3);
    rect(ctx, C.red, x + 4, y + 7, 7, 2);
    rect(ctx, C.red, x + 7, y + 5, 2, 5);
    rect(ctx, C.gold, x + 5, y + 4, 5, 2);
  } else if (kind === "car") {
    rect(ctx, C.red, x + 1, y + 6, 14, 6);
    rect(ctx, C.red, x + 4, y + 3, 8, 4);
    rect(ctx, C.blue, x + 6, y + 4, 5, 3);
    rect(ctx, C.ink, x + 3, y + 11, 3, 3);
    rect(ctx, C.ink, x + 11, y + 11, 3, 3);
  } else if (kind === "home" || kind === "rental") {
    rect(ctx, kind === "home" ? C.gold : C.green, x + 3, y + 6, 11, 9);
    rect(ctx, C.light, x + 1, y + 4, 14, 3);
    rect(ctx, C.ink, x + 7, y + 10, 3, 5);
    if (kind === "rental") rect(ctx, C.paper, x + 10, y + 8, 2, 2);
  } else if (kind === "dog" || kind === "cat" || kind === "small") {
    const color = kind === "dog" ? C.gold : kind === "cat" ? C.pink : C.light;
    rect(ctx, color, x + 4, y + 5, 9, 8);
    rect(ctx, color, x + 3, y + 3, 3, 4);
    rect(ctx, color, x + 11, y + 3, 3, 4);
    rect(ctx, C.ink, x + 6, y + 8, 2, 2);
    rect(ctx, C.ink, x + 10, y + 8, 2, 2);
    rect(ctx, color, x + 1, y + 10, 4, 2);
  } else if (kind === "hobbyGames") {
    rect(ctx, C.wallLight, x + 2, y + 5, 12, 8);
    rect(ctx, C.light, x + 4, y + 8, 4, 2);
    rect(ctx, C.light, x + 5, y + 7, 2, 4);
    rect(ctx, C.pink, x + 10, y + 8, 2, 2);
  } else if (kind === "hobbySports") {
    rect(ctx, C.light, x + 3, y + 3, 10, 10);
    rect(ctx, C.red, x + 7, y + 3, 2, 10);
    rect(ctx, C.red, x + 3, y + 7, 10, 2);
  } else if (kind === "hobbyReading") {
    rect(ctx, C.paper, x + 1, y + 3, 7, 11);
    rect(ctx, C.paper, x + 8, y + 3, 7, 11);
    rect(ctx, C.gold, x + 7, y + 2, 2, 13);
    rect(ctx, C.wood, x + 3, y + 6, 3, 1);
    rect(ctx, C.wood, x + 10, y + 6, 3, 1);
  } else if (kind === "hobbyMusic") {
    rect(ctx, C.pink, x + 5, y + 2, 3, 10);
    rect(ctx, C.pink, x + 7, y + 2, 6, 3);
    rect(ctx, C.light, x + 2, y + 10, 6, 5);
    rect(ctx, C.light, x + 10, y + 7, 5, 5);
  } else if (kind === "hobbyCrafts") {
    rect(ctx, C.gold, x + 2, y + 4, 12, 10);
    rect(ctx, C.wood, x + 4, y + 6, 8, 6);
    rect(ctx, C.light, x + 6, y + 2, 4, 4);
  } else if (kind === "hobbyNature") {
    rect(ctx, C.green, x + 6, y + 1, 5, 11);
    rect(ctx, C.green, x + 2, y + 5, 5, 5);
    rect(ctx, C.green, x + 10, y + 5, 5, 5);
    rect(ctx, C.wood, x + 7, y + 11, 3, 4);
  } else if (kind === "career") {
    rect(ctx, C.blue, x + 3, y + 2, 10, 12);
    rect(ctx, C.paper, x + 5, y + 4, 6, 6);
    rect(ctx, C.red, x + 7, y + 4, 2, 6);
    rect(ctx, C.red, x + 5, y + 6, 6, 2);
  } else if (kind === "partner") {
    rect(ctx, C.pink, x + 2, y + 5, 5, 5);
    rect(ctx, C.pink, x + 9, y + 5, 5, 5);
    rect(ctx, C.pink, x + 4, y + 9, 8, 4);
    rect(ctx, C.pink, x + 6, y + 13, 4, 2);
  } else if (kind === "child") {
    rect(ctx, C.paper, x + 2, y + 2, 12, 13);
    rect(ctx, C.blue, x + 4, y + 9, 8, 2);
    rect(ctx, C.gold, x + 7, y + 4, 2, 5);
    rect(ctx, C.pink, x + 5, y + 5, 6, 2);
  } else if (kind === "business") {
    rect(ctx, C.green, x + 2, y + 5, 12, 10);
    rect(ctx, C.light, x + 1, y + 2, 14, 4);
    rect(ctx, C.ink, x + 5, y + 9, 6, 6);
  }
}

export function drawMemorialRoom(canvas: HTMLCanvasElement, state: LifeState, hero: HTMLCanvasElement, items: RoomItemKind[], color: string): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.wall, 0, 0, 256, 128);
  rect(ctx, C.floor, 0, 128, 256, 64);
  for (let x = 0; x < 256; x += 32) rect(ctx, C.floorLight, x, 160, 16, 4);
  rect(ctx, C.wood, 0, 124, 256, 4);
  const climate = climateForCountry(state.birth.country.iso3);
  rect(ctx, C.wood, 10, 14, 58, 54);
  rect(ctx, SKY[climate], 14, 18, 50, 42);
  rect(ctx, GROUND[climate], 14, 46, 50, 14);
  rect(ctx, C.light, 36, 18, 4, 42);
  rect(ctx, C.light, 14, 36, 50, 4);
  rect(ctx, color, 18, 78, 42, 8);
  rect(ctx, C.wood, 12, 104, 64, 16);
  rect(ctx, C.paper, 16, 96, 56, 12);
  rect(ctx, color, 16, 108, 56, 12);
  for (let row = 0; row < 3; row++) {
    const y = 18 + row * 30;
    rect(ctx, C.wood, 82, y + 18, 162, 4);
    for (let column = 0; column < 6; column++) {
      const index = row * 6 + column;
      if (items[index]) drawIcon(ctx, items[index], 86 + column * 26, y);
    }
  }
  rect(ctx, color, 98, 148, 90, 28);
  rect(ctx, C.wallLight, 102, 152, 82, 20);
  ctx.drawImage(hero, 188, 112, 48, 64);
  rect(ctx, C.gold, 88, 112, 4, 16);
  rect(ctx, C.light, 80, 108, 20, 4);
  rect(ctx, C.gold, 84, 112, 12, 12);
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

export function drawGiftedDay(canvas: HTMLCanvasElement, state: LifeState, hero: HTMLCanvasElement, day: GiftedDay, color: string): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const climate = climateForCountry(state.birth.country.iso3);
  rect(ctx, SKY[climate], 0, 0, 256, 112);
  rect(ctx, GROUND[climate], 0, 112, 256, 80);
  rect(ctx, C.light, 204, 20, 24, 24);
  rect(ctx, color, 0, 104, 256, 8);
  for (let x = 0; x < 256; x += 32) {
    rect(ctx, C.wallLight, x, 88 - (x % 64), 24, 24 + (x % 64));
  }
  rect(ctx, C.paper, 96, 144, 64, 48);
  rect(ctx, C.gold, 92, 140, 72, 4);
  if (day.kind === "career") {
    rect(ctx, C.paper, 20, 64, 52, 48);
    rect(ctx, color, 16, 56, 60, 8);
    for (let x = 26; x <= 58; x += 16) rect(ctx, C.blue, x, 72, 8, 12);
    rect(ctx, C.wood, 40, 96, 12, 16);
  } else if (day.kind === "hobby" && day.hobby) {
    const icons: Record<typeof day.hobby, RoomItemKind> = { games: "hobbyGames", sports: "hobbySports", reading: "hobbyReading", music: "hobbyMusic", crafts: "hobbyCrafts", nature: "hobbyNature" };
    drawIcon(ctx, icons[day.hobby], 28, 72);
    drawIcon(ctx, icons[day.hobby], 52, 80);
  } else {
    rect(ctx, color, 28, 68, 12, 12);
    rect(ctx, C.light, 48, 80, 8, 8);
    rect(ctx, C.paper, 64, 64, 6, 6);
  }
  ctx.drawImage(hero, 152, 96, 48, 64);
}
