export type MemberNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  url?: string | null;
  sentAt: string;
  readAt: string | null;
};

type InboxData = { notifications: MemberNotification[]; unreadCount: number };

// Share request ordering between the bell, push opens, and background refreshes.
export function createMemberNotificationInbox(cardCode: string, callbacks: {
  onData: (data: InboxData) => void;
  onLoading: (loading: boolean) => void;
  onError: (error: string) => void;
}) {
  let version = 0;
  let markingRead = false;
  let controller: AbortController | null = null;
  const url = `/api/members/${encodeURIComponent(cardCode)}/notifications`;

  return {
    async refresh(markRead = false) {
      // A read refresh after the pending write will include new arrivals too.
      if (markingRead) return;
      const currentVersion = ++version;
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      markingRead = markRead;
      if (markRead) {
        callbacks.onLoading(true);
        callbacks.onError("");
      }
      try {
        let readError = "";
        if (markRead) {
          try {
            const response = await fetch(`${url}/read`, {
              method: "POST",
              signal,
              keepalive: true,
            });
            if (!response.ok) throw new Error("Read status was not saved");
          } catch (error) {
            if (signal.aborted) throw error;
            readError = "Неуспешно отбелязване на известията като прочетени. Опитайте отново.";
          }
        }
        // Read the actual saved state; never invent readAt values or zero counts.
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.ok) throw new Error("Notification history could not be loaded");
        const data: InboxData = await response.json();
        if (currentVersion !== version) return;
        callbacks.onData(data);
        if (markRead) callbacks.onError(readError);
      } catch {
        if (currentVersion === version && !signal.aborted && markRead) {
          callbacks.onError("Неуспешно зареждане на известията. Опитайте отново.");
        }
      } finally {
        if (currentVersion === version) {
          markingRead = false;
          if (markRead) callbacks.onLoading(false);
        }
      }
    },
    cancel() {
      version++;
      controller?.abort();
      markingRead = false;
    },
  };
}
