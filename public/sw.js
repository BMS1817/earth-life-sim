const CACHE = "earth-v1.0.0-30294e47ae7b";

async function notify(message) {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) client.postMessage(message);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const response = await fetch("sw-assets.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось получить список файлов Earth");
    const assets = await response.json();
    const cache = await caches.open(CACHE);
    let loaded = 0;
    await notify({ type: "earth:cache-progress", loaded, total: assets.length });
    for (let offset = 0; offset < assets.length; offset += 20) {
      const chunk = assets.slice(offset, offset + 20);
      await Promise.all(chunk.map(async (url) => {
        const result = await fetch(url, { cache: "reload" });
        if (!result.ok) throw new Error(`Оффлайн-файл недоступен: ${url}`);
        await cache.put(url, result);
        loaded++;
      }));
      await notify({ type: "earth:cache-progress", loaded, total: assets.length });
    }
    await notify({ type: "earth:cache-ready" });
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("earth-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
