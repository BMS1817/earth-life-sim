export function thematicHeader(_theme: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  canvas.className = "thematic-header";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return canvas;
}
