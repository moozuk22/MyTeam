import type {
  NotificationTemplateInput,
  PushNotificationPayload,
} from "@/lib/push/types";

const DEFAULT_ICON = "/logo.png";
const DEFAULT_URL = "/";

export function buildNotificationPayload(
  input: NotificationTemplateInput
): PushNotificationPayload {
  const memberPrefix = input.memberName ? `${input.memberName}: ` : "";
  const remainingVisits =
    typeof input.remainingVisits === "number" ? Math.max(input.remainingVisits, 0) : undefined;
  const url = input.url ?? DEFAULT_URL;

  switch (input.type) {
    case "visit_registered":
      return {
        title: "Посещението е отчетено",
        body:
          remainingVisits === undefined
            ? `${memberPrefix}Чекирането е успешно.`
            : `${memberPrefix}Чекирането е успешно. Остават ${remainingVisits} посещения.`,
        url,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: "visit-registered",
        data: { type: input.type },
      };
    case "membership_almost_finished":
      return {
        title: "Картата почти е изчерпана",
        body:
          remainingVisits === undefined
            ? `${memberPrefix}Остават малко посещения.`
            : `${memberPrefix}Остават само ${remainingVisits} посещения.`,
        url,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: "membership-almost-finished",
        data: { type: input.type, remainingVisits },
      };
    case "training_reminder": {
      const suffix = input.trainingDate ? ` (${input.trainingDate})` : "";
      return {
        title: "Напомняне за тренировка",
        body: `${memberPrefix}Имаш предстояща тренировка${suffix}.`,
        url,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: "training-reminder",
        data: { type: input.type, trainingDate: input.trainingDate ?? null },
      };
    }
    case "trainer_message":
      return {
        title: "Съобщение",
        body:
          input.trainerMessage?.trim() ||
          `${memberPrefix}Имате ново съобщение.`,
        url,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: "trainer-message",
        data: { type: input.type },
      };
    default:
      return {
        title: "Ново известие",
        body: "Имате ново известие.",
        url,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
      };
  }
}
