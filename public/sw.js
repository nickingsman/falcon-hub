self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === "string" ? data.title : "Falcon Hub";
  const body = typeof data.body === "string" ? data.body : "You have a new reminder.";
  const url = "/dsi";
  const tag = typeof data.tag === "string" ? data.tag : "falcon-hub-reminder";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/falcon-hub-192.png",
      badge: "/icons/falcon-hub-192.png",
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL("/dsi", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          if ("navigate" in client) {
            return client.navigate(destination).then(() => client.focus());
          }
          return client.focus();
        }
      }

      return self.clients.openWindow(destination);
    }),
  );
});
