export function thematicHeader(theme: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  canvas.className = "thematic-header";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const image = new Image();
  image.onload = () => {
    image.onload = null;
    image.onerror = null;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
  };
  image.src = `art/kimi/header_${theme}.png`;
  return canvas;
}
