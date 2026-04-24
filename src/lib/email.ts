const BREVO_SMTP_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type BrevoEmailPayload = {
  senderEmail: string;
  senderName: string;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  replyToEmail?: string;
  replyToName?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendBrevoEmail(
  apiKey: string,
  payload: BrevoEmailPayload
): Promise<boolean> {
  const response = await fetch(BREVO_SMTP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: payload.senderEmail, name: payload.senderName },
      to: [{ email: payload.toEmail, name: payload.toName }],
      replyTo: payload.replyToEmail
        ? { email: payload.replyToEmail, name: payload.replyToName }
        : undefined,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Brevo email send failed:", errorText);
    return false;
  }

  return true;
}

export function buildLeadConfirmationContent(logoUrl: string, name: string, videoUrl: string) {
  const supportPhoneDisplay = "0896 495 254";
  const supportPhoneHref = "+359896495254";

  const htmlContent = `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyTeam - Потвърждение</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    .button-link {padding: 15px 30px !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #000000;">
          <tr>
            <td align="center" style="padding: 40px 20px 30px 20px;">
              <img src="${escapeHtml(logoUrl)}" alt="MyTeam" width="160" style="display: inline-block; max-width: 160px; height: auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px;">
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                Здравейте, <span style="color: #7CFC00;">${escapeHtml(name)}</span>,
              </h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
                Вашата заявка е приета и се обработва.<br>
                Поради огромния интерес, местата за преференциалните условия са силно ограничени.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="70" valign="top" style="padding-right: 15px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 60px; height: 60px; border: 2px solid #333333; border-radius: 12px; text-align: center; vertical-align: middle;">
                          <img src="https://img.icons8.com/ios-filled/50/7CFC00/clapperboard.png" alt="Video" width="30" height="30" style="display: inline-block;">
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top">
                    <h2 style="margin: 0 0 5px 0; font-size: 18px; color: #ffffff; font-weight: bold;">Стъпка 1:</h2>
                    <p style="margin: 0 0 10px 0; font-size: 16px;">
                      <span style="color: #7CFC00; font-weight: bold;">Вижте как работи системата</span>
                      <span style="color: #888888;"> (2 мин. видео)</span>
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #aaaaaa;">
                      За да добиете представа за лекотата, с която ще управлявате графика и таксите си, изгледайте това кратко видео:
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #1a1a1a; border: 2px solid #333333; border-radius: 8px;">
                          <a href="${escapeHtml(videoUrl)}" target="_blank" style="display: inline-block; padding: 15px 40px; font-size: 14px; font-weight: bold; color: #ffffff; text-decoration: none; text-align: center;">
                            <span style="vertical-align: middle;">&#9658;</span>&nbsp;&nbsp;ГЛЕДАЙ ВИДЕО ДЕМО
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #333333; height: 1px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="70" valign="top" style="padding-right: 15px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 60px; height: 60px; border: 2px solid #333333; border-radius: 50%; text-align: center; vertical-align: middle;">
                          <img src="https://img.icons8.com/ios-filled/50/7CFC00/phone.png" alt="Phone" width="28" height="28" style="display: inline-block;">
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top">
                    <h2 style="margin: 0 0 5px 0; font-size: 18px; color: #ffffff; font-weight: bold;">Стъпка 2:</h2>
                    <p style="margin: 0 0 10px 0; font-size: 16px; color: #7CFC00; font-weight: bold; line-height: 1.4;">
                      Ще се свържем с вас възможно най-скоро,
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #aaaaaa;">
                      но ако не искате да чакате или имате въпроси – обадете се и ги задайте още сега!
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="background-color: #7CFC00; border-radius: 8px; text-align: center;">
                          <a href="tel:${supportPhoneHref}" style="display: block; padding: 18px 40px; font-size: 14px; font-weight: bold; color: #000001; text-decoration: none; text-align: center;">
                            <span style="vertical-align: middle;">&#128222;</span>&nbsp;&nbsp;ОБАДИ СЕ НА MyTeam
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; text-align: center; font-size: 14px; color: #aaaaaa;">
                <a href="tel:${supportPhoneHref}" style="color: #7CFC00; text-decoration: underline;">${supportPhoneDisplay}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px 40px 30px;">
              <p style="margin: 0; font-size: 16px; color: #ffffff; line-height: 1.6;">
                Поздрави,<br>
                Екипът на <span style="color: #7CFC00; font-weight: bold;">MyTeam7</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #111111; padding: 30px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="33%" valign="top" style="text-align: center; padding: 10px; border-right: 1px solid #333333;">
                    <img src="https://img.icons8.com/ios/50/7CFC00/time.png" alt="Time" width="40" height="40" style="display: block; margin: 0 auto 10px auto;">
                    <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">СПЕСТЯВАТЕ ВРЕМЕ</p>
                    <p style="margin: 0; font-size: 11px; color: #888888; line-height: 1.4;">Автоматизация на графици, такси и още</p>
                  </td>
                  <td width="33%" valign="top" style="text-align: center; padding: 10px; border-right: 1px solid #333333;">
                    <img src="https://img.icons8.com/ios-filled/50/7CFC00/bar-chart.png" alt="Growth" width="40" height="40" style="display: block; margin: 0 auto 10px auto;">
                    <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">РАЗВИВАЙТЕ КЛУБА СИ</p>
                    <p style="margin: 0; font-size: 11px; color: #888888; line-height: 1.4;">Фокусирайте се върху спорта, ние върху администрацията</p>
                  </td>
                  <td width="33%" valign="top" style="text-align: center; padding: 10px;">
                    <img src="https://img.icons8.com/ios-filled/50/7CFC00/rocket.png" alt="Rocket" width="40" height="40" style="display: block; margin: 0 auto 10px auto;">
                    <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">УВЕЛИЧАВАНЕ НА ЧЛЕНОВЕТЕ</p>
                    <p style="margin: 0; font-size: 11px; color: #888888; line-height: 1.4;">Искате групите Ви да са винаги пълни? MyTeam ще се погрижи и за това</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = [
    `Здравей, ${name},`,
    "",
    "Вашата заявка е приета и се обработва.",
    "Поради огромния интерес, местата за преференциалните условия са силно ограничени.",
    "",
    "Стъпка 1: Вижте как работи системата (2 мин. видео)",
    "",
    "Стъпка 2: Ще се свържем с вас възможно най-скоро.",
    "",
    "Поздрави,",
    "Екипът на MyTeam7",
  ].join("\n");

  return { htmlContent, textContent };
}
