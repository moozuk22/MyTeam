import { runMonthlyMembershipPaymentReminder } from "@/lib/jobs/monthlyMembershipPaymentReminder";

let schedulerStarted = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.LOCAL_SCHEDULER !== "true") {
    return;
  }

  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  const run = async () => {
    try {
      const result = await runMonthlyMembershipPaymentReminder();
      if (!result.skipped) {
        console.log("Monthly reminder job executed:", result);
      }
    } catch (error) {
      console.error("Local monthly reminder scheduler failed:", error);
    }
  };

  // Run once on startup, then re-check every hour.
  void run();
  setInterval(() => {
    void run();
  }, 60 * 60 * 1000);
}
