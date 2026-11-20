# ADR: автономные загрузки, перенос сейвов и строгий портрет Android

**Контекст:** itch HTML5-ZIP содержит 945 файлов и предназначен для хостинга, а не прямого запуска
через `file://`. Пользователь выбрал single-file offline HTML, небольшой портативный Windows ZIP
с WebView2, экспорт/импорт сейва и строгий портрет Android. Текущий touch-тест проверяет только
390×844 в desktop Chrome. На Medium Phone landscape имеет около 914 CSS px, поэтому мобильное
правило `max-width: 900px` не срабатывает и включается desktop-сетка с колонкой минимум 512 px.
Решения пользователя — `docs/decisions.md` от 2026-11-20.

**Решение:**
- Ввести общий UI-резолвер `resourceUrl(path)`. В обычной сборке он возвращает исходный URL;
  в offline HTML — data URL из встроенной карты ресурсов. JSON, изображения, флаги, шрифт и CSS-
  текстуры используют один источник. Service worker и PWA-установка в single-file режиме отключаются.
- `scripts/build-offline.mjs` после обычного production build встраивает JS и все необходимые
  ресурсы `dist` в один HTML. Обычный dist/PWA и HTML5-ZIP остаются неизменными по структуре.
- Windows-оболочка WinForms/.NET 8 self-contained использует WebView2 и виртуальный HTTPS-host,
  сопоставленный локальному production-пакету. Сеть и локальный сервер не нужны. Постоянный
  WebView2 user-data каталог находится в LocalApplicationData вне папки приложения. При отсутствии
  Runtime показывается RU/EN-инструкция с официальной ссылкой. Runtime в ZIP не входит.
- `core/save.ts` получает единый decode/migrate/validate путь для localStorage и импорта JSON.
  Версия сейва остаётся v10; экспорт не добавляет персистентных полей. Импорт сначала валидируется
  и лишь затем заменяет текущий сейв после подтверждения.
- Manifest получает `orientation: "portrait"`. На coarse-touch телефоне в landscape CSS показывает
  двуязычный полноэкранный overlay; горизонтальный игровой UI недоступен. Screen Orientation API
  используется при поддержке без принудительного fullscreen.
- Витрина itch.io и её графика хранятся отдельно в `release/`; публикация выполняется только после
  отдельного одобрения локального предпросмотра.

**Альтернативы:**
- A) Electron/fixed WebView2 — полностью автономный движок, но более 250 МБ дополнительно;
  пользователь выбрал небольшой ZIP с системным WebView2.
- B) ZIP с `index.html` без резолвера — маленький, но fetch JSON и динамические изображения ломаются
  под `file://`; неприемлемо.
- C) Адаптивный landscape — удобнее для части пользователей, но отклонён выбором строгого портрета.
- D) Текстовая замена URL в bundle — не требует резолвера, но ненадёжна для динамических путей.

**Последствия:** single-file HTML становится значительно больше ZIP из-за base64. Реальная проверка
Android Chrome подтвердила платформенный `ERR_ACCESS_DENIED` для `file:///sdcard/...` даже после
`ACTION_OPEN_DOCUMENT`; поэтому Android-путь — браузер/PWA, а single-file HTML документируется
только для desktop-браузеров. Перемещение HTML
может изменить file-origin хранилища, поэтому экспорт/импорт обязателен. Windows требует WebView2,
но не требует установленный .NET. Новая build-зависимость — Microsoft.Web.WebView2; .NET SDK нужен
только для сборки. Нужны сторожа импорта, offline `file://`, Windows restart и реальных Android.

**Затронутые файлы:** `src/core/save.ts`, `src/main.ts`, `src/ui/resource.ts`, image/UI-модули,
`src/ui/strings*.ts`, `index.html`, `public/manifest.webmanifest`, `scripts/build-offline.mjs`,
`windows/`, `scripts/verify-*`, `release/`, тесты и package scripts.

## Приёмка

1. Существующие 163 теста и новые save/offline-тесты, production build.
2. Offline HTML открывается через `file://` без сети: новая жизнь, 4 решения, все страны по запросу,
   мемориал, 3 поколения, RU/EN, экспорт/импорт и сохранение после перезапуска.
3. Windows: запуск без сервера и сети, сохранение после перезапуска, импорт/экспорт, внешние ссылки
   в браузере, понятный сценарий отсутствующего WebView2.
4. Два размера Android: Pages и itch iframe, portrait, landscape overlay, RU/EN, вкладки, решения,
   клавиатура/safe area, мемориал и перезапуск. Desktop/mobile screenshot-гейты остаются зелёными.
5. Локальный предпросмотр itch.io, 5 скриншотов и GIF визуально одобрены до внешней публикации.
