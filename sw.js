/* ラボドリ オンライン／高校受験対策 Service Worker
   更新のたびに VERSION を上げる（juken-v2, v3...）。
   localStorage の学習データは VERSION 更新でも消えない。 */
const VERSION = "juken-v2";

const CORE = [
  "./",
  "index.html",
  "offline.html",
  "manifest.json",
  "questions.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
  "favicon-32.png",
  "favicon-16.png",
  "favicon.ico",
];

/* アバターSVG 全32点（本体10＋頭6＋手6＋仲間5＋背景5） */
const AVATAR = [
  "body_face","body_cat","body_rabbit","body_bear","body_panda",
  "body_fox","body_lion","body_tiger","body_owl","body_koala",
].map(id => `assets/avatar/body/${id}.svg`).concat(
  ["head_goggle","head_micro","head_cap","head_grad","head_bulb","head_crown"]
    .map(id => `assets/avatar/head/${id}.svg`),
  ["hand_flask","hand_tube","hand_magnet","hand_dna","hand_scope","hand_book"]
    .map(id => `assets/avatar/hand/${id}.svg`),
  ["pet_ecoli","pet_mouse","pet_frog","pet_cat","pet_water"]
    .map(id => `assets/avatar/pet/${id}.svg`),
  ["bg_lab","bg_cell","bg_mountain","bg_night","bg_space"]
    .map(id => `assets/avatar/bg/${id}.svg`)
);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      /* 1件でも404だと addAll は全体が失敗するため、個別に追加する */
      await Promise.allSettled(CORE.map((url) => cache.add(url)));
      /* アバターは1枚欠けても全体を止めない */
      await Promise.allSettled(AVATAR.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isNetworkFirst =
    req.mode === "navigate" ||
    url.pathname.endsWith("index.html") ||
    url.pathname.endsWith("questions.json");

  if (isNetworkFirst) {
    /* HTMLと問題データは常に最新を優先、オフライン時のみキャッシュ */
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req);
          if (hit) return hit;
          if (req.mode === "navigate") {
            return (await caches.match("index.html")) || (await caches.match("offline.html"));
          }
          return Response.error();
        })
    );
  } else {
    /* その他アセットは cache-first */
    e.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
