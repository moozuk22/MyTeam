"use client";

import { trainingSubscriptionLockedMessage, useTrainingPlanAccess } from "@/lib/exercise/useTrainingPlanAccess";

/** Tells the user before a write that the club has no training plans subscription. The server also blocks each write. */
export default function SubscriptionNotice({ clubId }: { clubId: string }) {
  const subscription = useTrainingPlanAccess(clubId);
  if (!subscription.error && (!subscription.access || subscription.access.canSave)) return null;
  return <div className="tp-subscription-notice" role="status">
    {subscription.error || trainingSubscriptionLockedMessage}
    {subscription.error && <button type="button" onClick={() => void subscription.refresh().catch(() => {})}>Опитай отново</button>}
  </div>;
}
