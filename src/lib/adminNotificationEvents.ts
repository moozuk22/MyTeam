type AdminNotificationEvent = {
  type: "notification-created";
  clubId: string;
  timestamp: number;
};

type AdminNotificationSubscriber = (event: AdminNotificationEvent) => void;

const subscribersByClubId = new Map<string, Set<AdminNotificationSubscriber>>();

export function subscribeAdminNotificationEvents(
  clubId: string,
  subscriber: AdminNotificationSubscriber,
) {
  if (!subscribersByClubId.has(clubId)) {
    subscribersByClubId.set(clubId, new Set());
  }

  const set = subscribersByClubId.get(clubId)!;
  set.add(subscriber);

  return () => {
    const currentSet = subscribersByClubId.get(clubId);
    if (!currentSet) {
      return;
    }
    currentSet.delete(subscriber);
    if (currentSet.size === 0) {
      subscribersByClubId.delete(clubId);
    }
  };
}

export function publishAdminNotificationCreated(clubId: string) {
  const set = subscribersByClubId.get(clubId);
  if (!set || set.size === 0) {
    return;
  }

  const event: AdminNotificationEvent = {
    type: "notification-created",
    clubId,
    timestamp: Date.now(),
  };

  for (const subscriber of set) {
    try {
      subscriber(event);
    } catch (error) {
      console.error("Admin notification event subscriber error:", error);
    }
  }
}
