import { giftedDay } from "../core/memorial.ts";
import type { LifeState } from "../core/state.ts";
import type { RebrandScene } from "./rebrand-scene.ts";

export function replaceRebrandArt(root: HTMLElement, state: LifeState, scene: RebrandScene): void {
  for (const header of root.querySelectorAll<HTMLElement>(".thematic-header")) header.replaceWith(scene.thematicHeader());
  const oldRoom = root.querySelector<HTMLCanvasElement>("canvas.memorial-canvas");
  if (oldRoom) {
    const room = document.createElement("canvas");
    room.width = 256;
    room.height = 192;
    room.className = "memorial-canvas";
    room.setAttribute("role", "img");
    const ctx = room.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene.element, 0, 0);
    oldRoom.replaceWith(room);
  }
  const oldGift = root.querySelector<HTMLCanvasElement>(".gifted-day canvas");
  if (oldGift) {
    const gift = giftedDay(state);
    const portrait = scene.dayScene(state, gift.age, gift.career);
    portrait.setAttribute("role", "img");
    oldGift.replaceWith(portrait);
  }
  const oldCity = root.querySelector<HTMLCanvasElement>("canvas.politics-city");
  if (oldCity) {
    const city = scene.dayScene(state, state.age, state.finance.career);
    city.className = "politics-city";
    oldCity.replaceWith(city);
  }
}
