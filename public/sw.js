self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "CheckIn", body: event.data.text() };
    }
  } else {
    // Some providers/browsers may deliver a push event without a payload.
    payload = {
      title: "CheckIn",
      body: "You have a new notification.",
    };
  }

  const data = typeof payload === "object" && payload ? payload : {};
  const title = typeof data.title === "string" ? data.title : "CheckIn";
  const body = typeof data.body === "string" ? data.body : "";
  const cardCode =
    typeof data.cardCode === "string" && data.cardCode.trim()
      ? data.cardCode.trim()
      : null;
  const clubId =
    typeof data.clubId === "string" && data.clubId.trim()
      ? data.clubId.trim()
      : data.data &&
        typeof data.data.clubId === "string" &&
        data.data.clubId.trim()
      ? data.data.clubId.trim()
      : null;
  const url =
    typeof data.url === "string" && data.url.trim()
      ? data.url.trim()
      : clubId
      ? `/admin/members?clubId=${encodeURIComponent(clubId)}`
      : cardCode
      ? `/member/${encodeURIComponent(cardCode)}`
      : "/";
  const icon = typeof data.icon === "string" ? data.icon : "/logo.png";
  const badge = typeof data.badge === "string" ? data.badge : "/logo.png";
  const tag = typeof data.tag === "string" ? data.tag : "checkin-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: {
        url,
        ...(typeof data.data === "object" && data.data ? data.data : {}),
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cardCode =
    event.notification?.data &&
    typeof event.notification.data.cardCode === "string" &&
    event.notification.data.cardCode.trim()
      ? event.notification.data.cardCode.trim()
      : null;
  const requestedPath =
    event.notification?.data &&
    typeof event.notification.data.url === "string" &&
    event.notification.data.url.trim()
      ? event.notification.data.url.trim()
      : event.notification?.data &&
        typeof event.notification.data.clubId === "string" &&
        event.notification.data.clubId.trim()
      ? `/admin/members?clubId=${encodeURIComponent(event.notification.data.clubId.trim())}`
      : cardCode
      ? `/member/${encodeURIComponent(cardCode)}`
      : "/";
  const targetPath = requestedPath;
  const destinationUrl = new URL(targetPath, self.location.origin);
  const isAdminTarget =
    destinationUrl.pathname === "/admin" ||
    destinationUrl.pathname.startsWith("/admin/");

  destinationUrl.searchParams.set("fromPush", "1");
  if (isAdminTarget) {
    destinationUrl.searchParams.set("openCoachNotifications", "1");
  } else {
    destinationUrl.searchParams.set("openBell", "1");
  }
  destinationUrl.searchParams.set("pushOpenTs", String(Date.now()));
  const destination = destinationUrl.toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          if (
            client.url === destination ||
            client.url.startsWith(`${destination}#`) ||
            clientUrl.pathname === destinationUrl.pathname
          ) {
            if (typeof client.navigate === "function") {
              return client
                .navigate(destination)
                .then((navigatedClient) => (navigatedClient || client).focus());
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(destination);
      })
  );
});
