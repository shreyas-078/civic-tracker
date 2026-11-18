const CACHE_NAME = "civictrack-v1";
const STATIC_ASSETS = ["/", "/map", "/manifest.json"];

// Install: cache static assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => caches.delete(k)),
                ),
            ),
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API routes: network first, fallback gracefully
    if (url.pathname.startsWith("/api/")) {
        // Cache issue tile requests for offline viewing
        if (url.pathname === "/api/issues" && request.method === "GET") {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        const clone = response.clone();
                        caches
                            .open(CACHE_NAME)
                            .then((cache) => cache.put(request, clone));
                        return response;
                    })
                    .catch(() => caches.match(request)),
            );
        }
        return; // other API routes: default network handling
    }

    // Static assets: cache first
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".css")
    ) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request)),
        );
        return;
    }
});

// Push notification handler
self.addEventListener("push", (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch {
        data = { title: "CiviTrack", body: event.data.text() };
    }

    event.waitUntil(
        self.registration.showNotification(data.title ?? "CiviTrack", {
            body: data.body,
            icon: "/icons/icon.png",
            badge: "/icons/icon.png",
            data: { url: data.url ?? "/map" },
            actions: [
                { action: "view", title: "View" },
                { action: "dismiss", title: "Dismiss" },
            ],
        }),
    );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") return;

    const url = event.notification.data?.url ?? "/map";
    event.waitUntil(
        clients.matchAll({ type: "window" }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === url && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        }),
    );
});
