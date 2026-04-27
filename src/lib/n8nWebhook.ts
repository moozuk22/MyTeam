export async function fireN8nWebhook(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.warn("[n8n] N8N_WEBHOOK_URL is not set — skipping webhook");
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[n8n] Failed to fire webhook:", err);
  }
}
