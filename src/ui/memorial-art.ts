import { MEMORIAL_PALETTE as C } from "../content/memorial.ts";
import type { GiftedDay, RoomItemKind } from "../core/memorial.ts";
import type { HappinessPoint, LifeState } from "../core/state.ts";
function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

export function drawMemorialRoom(canvas: HTMLCanvasElement, _state: LifeState, _hero: HTMLCanvasElement, _items: RoomItemKind[]): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.paper, 0, 0, canvas.width, canvas.height);
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

export function drawGiftedDay(canvas: HTMLCanvasElement, _state: LifeState, _hero: HTMLCanvasElement, _day: GiftedDay): void {
  canvas.width = 256;
  canvas.height = 192;
  canvas.className = "memorial-canvas";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  rect(ctx, C.paper, 0, 0, canvas.width, canvas.height);
}
