export type NotificationTemplateType =
  | "visit_registered"
  | "membership_almost_finished"
  | "training_reminder"
  | "trainer_message";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationTemplateInput {
  type: NotificationTemplateType;
  memberName?: string;
  remainingVisits?: number;
  trainingDate?: string;
  trainerMessage?: string;
  url?: string;
}
