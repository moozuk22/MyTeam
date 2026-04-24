import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { buildLeadConfirmationContent, sendBrevoEmail } from "@/lib/email";

export const runtime = "nodejs";

type SendEmailBody = {
  name?: unknown;
  email?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: SendEmailBody;
  try {
    body = (await request.json()) as SendEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email);

  if (!name || !email) {
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
  if (!senderEmail) {
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

  const { htmlContent, textContent } = buildLeadConfirmationContent(logoUrl, name, videoUrl);

  const sent = await sendBrevoEmail(apiKey, {
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

  if (!sent) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
