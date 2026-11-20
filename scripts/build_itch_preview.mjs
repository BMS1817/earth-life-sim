import { readFile, writeFile } from "node:fs/promises";

const [description, css] = await Promise.all([
  readFile("release/itch-description.html", "utf8"),
  readFile("release/itch-theme.css", "utf8"),
]);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Earth — One Life · itch.io preview</title>
<style>${css}</style>
</head>
<body>
<div class="preview-label">LOCAL PREVIEW</div>
<main class="itch-shell">
  <img class="earth-banner" src="itch-banner.png" alt="Earth — One Life">
  <div class="itch-actions">
    <a class="itch-button" href="#downloads">▶ Run game</a>
    <a class="itch-button secondary" href="#downloads">Download Now</a>
    <span class="itch-price">Name your own price · $0+ / suggested $2</span>
  </div>
  <article class="game_description">${description}</article>
</main>
</body>
</html>`;
await writeFile("release/itch-preview.html", html);
console.log("Itch preview: release/itch-preview.html");
