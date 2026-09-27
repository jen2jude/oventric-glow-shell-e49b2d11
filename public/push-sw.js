/* Oventric Web Push worker.
 * Messaging-only: it never caches HTML or app assets, so it cannot serve
 * stale pages. Its sole job is to render background notifications and to
 * focus/open the app when one is tapped.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Oventric", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Oventric";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/__l5e/assets-v1/efd2d190-0a3e-4566-a925-8631c270ad3a/oventric-mark.jpg",
    badge: "/__l5e/assets-v1/efd2d190-0a3e-4566-a925-8631c270ad3a/oventric-mark.jpg",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    vibrate: [80, 40, 80],
    timestamp: Date.now(),
    data: { link: payload.link || "/", id: payload.id || null },
  };

  const badgeCount = Number(payload.badge);
  const setBadge =
    self.navigator && "setAppBadge" in self.navigator && badgeCount > 0
      ? self.navigator.setAppBadge(badgeCount).catch(() => {})
      : Promise.resolve();

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), setBadge]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
