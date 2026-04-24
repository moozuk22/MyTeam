import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  sendBrevoEmail,
  buildLeadConfirmationContent,
} from "@/lib/email";

const BREVO_CONTACTS_ENDPOINT = "https://api.brevo.com/v3/contacts";
export const runtime = "nodejs";

type LeadPayload = {
  club?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  kids?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseListIds(raw: string): number[] {
  return raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function normalizePhoneToE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return null;

  // 00XXXXXXXX -> +XXXXXXXX
  if (digitsOnly.startsWith("00")) {
    const normalized = `+${digitsOnly.slice(2)}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  // BG local numbers like 08XXXXXXXX -> +3598XXXXXXXX
  if (digitsOnly.startsWith("0")) {
    const normalized = `+359${digitsOnly.slice(1)}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  // BG mobile entered without leading 0, e.g. 89XXXXXXX
  if (digitsOnly.length === 9) {
    const normalized = `+359${digitsOnly}`;
    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
  }

  const normalized = `+${digitsOnly}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function addCustomAttribute(
  attrs: Record<string, string>,
  envKey: string,
  value: string
) {
  const brevoAttrName = process.env[envKey]?.trim();
  if (brevoAttrName && value) {
    attrs[brevoAttrName] = value;
  }
}

function buildSubmissionNotificationContent(
  club: string,
  name: string,
  email: string,
  phone: string,
  kids: string
) {
  const htmlContent = `
    <h2>Ново запитване от формата</h2>
    <p><strong>Клуб:</strong> ${escapeHtml(club)}</p>
    <p><strong>Име:</strong> ${escapeHtml(name)}</p>
    <p><strong>Имейл:</strong> ${escapeHtml(email)}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Брой деца:</strong> ${escapeHtml(kids)}</p>
  `;

  const textContent = [
    "Ново запитване от формата",
    `Клуб: ${club}`,
    `Име: ${name}`,
    `Имейл: ${email}`,
    `Телефон: ${phone}`,
    `Брой деца: ${kids}`,
  ].join("\n");

  return { htmlContent, textContent };
}

async function syncBrevoContact(
  apiKey: string,
  club: string,
  name: string,
  email: string,
  phone: string,
  kids: string
): Promise<boolean> {
  const listIds = parseListIds(process.env.BREVO_LEAD_LIST_IDS ?? "");
  const normalizedPhone = normalizePhoneToE164(phone);
  const attributes: Record<string, string> = {
    FIRSTNAME: name,
  };
  if (normalizedPhone) {
    attributes.SMS = normalizedPhone;
  }
  addCustomAttribute(attributes, "BREVO_ATTR_CLUB", club);
  addCustomAttribute(attributes, "BREVO_ATTR_KIDS", kids);
  addCustomAttribute(attributes, "BREVO_ATTR_PHONE", phone);

  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey,
  };
  const payload = {
    email,
    attributes,
    updateEnabled: true,
    listIds: listIds.length > 0 ? listIds : undefined,
  };

  let response = await fetch(BREVO_CONTACTS_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorJson: unknown = null;
    const errorText = await response.text();
    try {
      errorJson = JSON.parse(errorText) as unknown;
    } catch {
      // Keep raw text logging below if parsing fails.
    }

    const duplicateIdentifiers =
      typeof errorJson === "object" &&
      errorJson !== null &&
      "metadata" in errorJson &&
      typeof (errorJson as { metadata?: unknown }).metadata === "object" &&
      (errorJson as { metadata?: { duplicate_identifiers?: unknown } }).metadata !== null &&
      Array.isArray(
        (errorJson as { metadata?: { duplicate_identifiers?: unknown } }).metadata
          ?.duplicate_identifiers
      )
        ? (
            (errorJson as {
              metadata?: { duplicate_identifiers?: unknown[] };
            }).metadata?.duplicate_identifiers ?? []
          )
            .filter((entry): entry is string => typeof entry === "string")
        : [];

    const hasSmsDuplicate = duplicateIdentifiers.includes("SMS");
    if (hasSmsDuplicate && "SMS" in attributes) {
      const retryAttributes = { ...attributes };
      delete retryAttributes.SMS;

      response = await fetch(BREVO_CONTACTS_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...payload,
          attributes: retryAttributes,
        }),
      });
    } else {
      console.error("Brevo lead sync failed:", errorText);
    }
  }

  if (!response.ok) {
    const brevoError = await response.text();
    console.error("Brevo lead sync failed:", brevoError);
    return false;
  }

  return true;
}

async function sendSubmissionNotificationEmail(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  notifyTo: string,
  club: string,
  name: string,
  email: string,
  phone: string,
  kids: string
): Promise<boolean> {
  const { htmlContent, textContent } = buildSubmissionNotificationContent(
    club,
    name,
    email,
    phone,
    kids
  );

  return sendBrevoEmail(apiKey, {
    senderEmail,
    senderName,
    toEmail: notifyTo,
    subject: `Ново запитване: ${club}`,
    htmlContent,
    textContent,
    replyToEmail: email,
    replyToName: name,
  });
}

async function sendLeadConfirmationEmail(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  logoUrl: string,
  name: string,
  email: string,
  videoUrl: string
): Promise<boolean> {
  const { htmlContent, textContent } = buildLeadConfirmationContent(logoUrl, name, videoUrl);

  return sendBrevoEmail(apiKey, {
    senderEmail,
    senderName,
    toEmail: email,
    toName: name,
    subject: "Получихме Вашето запитване - MyTeam",
    htmlContent,
    textContent,
    replyToEmail: process.env.BREVO_NOTIFY_TO?.trim() ?? senderEmail,
    replyToName: senderName,
  });
}

export async function POST(request: NextRequest) {
  let body: LeadPayload;
  try {
    body = (await request.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const club = asTrimmedString(body.club);
  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email);
  const phone = asTrimmedString(body.phone);
  const kids = asTrimmedString(body.kids);

  if (!club || !name || !email || !phone || !kids) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brevo is not configured on the server" },
      { status: 500 }
    );
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() ?? "";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "MyTeam";
  const notifyTo = process.env.BREVO_NOTIFY_TO?.trim() ?? "";
  if (!senderEmail || !notifyTo) {
    return NextResponse.json(
      { error: "Brevo email settings are missing" },
      { status: 500 }
    );
  }

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    request.nextUrl.origin;
  const baseUrl = appBaseUrl.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/myteam-logo.png`;
  const videoUrl = `${baseUrl}/?video=1`;

  const emailSent = await sendSubmissionNotificationEmail(
    apiKey,
    senderEmail,
    senderName,
    notifyTo,
    club,
    name,
    email,
    phone,
    kids
  );
  if (!emailSent) {
    return NextResponse.json(
      { error: "Failed to send submission email" },
      { status: 502 }
    );
  }

  const confirmationSent = await sendLeadConfirmationEmail(
    apiKey,
    senderEmail,
    senderName,
    logoUrl,
    name,
    email,
    videoUrl
  );

  const shouldSyncContacts = process.env.BREVO_SYNC_CONTACTS?.trim() === "true";
  let contactSynced = false;
  if (shouldSyncContacts) {
    contactSynced = await syncBrevoContact(apiKey, club, name, email, phone, kids);
  }

  return NextResponse.json({
    success: true,
    emailSent: true,
    confirmationSent,
    contactSynced,
    lead: { club, name, email, phone, kids },
  });
}
