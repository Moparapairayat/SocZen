type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

type RequestEmailData = {
  name: string;
  email: string;
  selectedServices: string[];
  company: string | null;
  useCase: string | null;
  message: string | null;
  referenceCode: string;
};

type RequestStatusEmailData = {
  name: string;
  email: string;
  selectedServices: string[];
  referenceCode: string;
  status: "approved" | "rejected" | "contacted";
  note: string | null;
};

type ResendConfig = {
  apiKey: string;
  from: string;
  adminEmail: string | null;
  replyTo: string | null;
};

type EmailLayoutInput = {
  previewText: string;
  eyebrow: string;
  title: string;
  introHtml: string;
  badgeLabel: string;
  badgeValue: string;
  bodyHtml: string;
  footerHtml: string;
};

const BRAND_SIGNATURE_LABEL = "Powered by";
const BRAND_SIGNATURE_NAME = "SocZen Access Desk";
const BRAND_DOMAIN_FALLBACK = "soczen.moparapairayat.dev";

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const adminEmail = process.env.RESEND_ADMIN_EMAIL?.trim() || null;
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || null;

  if (!apiKey || !from) return null;

  return {
    apiKey,
    from,
    adminEmail,
    replyTo,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOptionalValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not provided";
}

function formatServicesText(selectedServices: string[]) {
  if (selectedServices.length === 0) return "- No subscriptions selected";
  return selectedServices.map((service) => `- ${service}`).join("\n");
}

function formatMultilineHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function extractEmailAddress(value: string | null) {
  if (!value) return null;

  const match = value.match(/<([^>]+)>/);
  const email = (match?.[1] ?? value).trim();

  return email || null;
}

function extractEmailDomain(value: string | null) {
  const email = extractEmailAddress(value);
  if (!email) return null;

  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1 || atIndex === email.length - 1) return null;

  return email.slice(atIndex + 1);
}

function getWebsiteDomain(): string {
  const envUrl = process.env.SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return BRAND_DOMAIN_FALLBACK;
}

function renderServicePillsHtml(selectedServices: string[]) {
  if (selectedServices.length === 0) {
    return `
      <span
        style="display:inline-block;margin:0 8px 8px 0;border:2px solid #1b1530;border-radius:999px;background:#ffffff;padding:10px 14px;font-size:14px;font-weight:700;line-height:20px;color:#1b1530;"
      >
        No subscriptions selected
      </span>
    `;
  }

  const pillBackgrounds = ["#fff0a8", "#d8f59b", "#d9f4ff", "#ffd5e6"];

  return selectedServices
    .map(
      (service, index) => `
        <span
          style="display:inline-block;margin:0 8px 8px 0;border:2px solid #1b1530;border-radius:999px;background:${pillBackgrounds[index % pillBackgrounds.length]};padding:10px 14px;font-size:14px;font-weight:700;line-height:20px;color:#1b1530;"
        >
          ${escapeHtml(service)}
        </span>
      `,
    )
    .join("");
}

function renderStepRowsHtml(steps: Array<{ title: string; copy: string }>) {
  return steps
    .map(
      (step, index) => `
        <tr>
          <td style="padding:0 12px 14px 0;vertical-align:top;">
            <div
              style="height:34px;width:34px;border:2px solid #1b1530;border-radius:12px;background:${
                index % 2 === 0 ? "#ffffff" : "#fff0a8"
              };text-align:center;font-size:15px;font-weight:800;line-height:30px;color:#1b1530;"
            >
              ${index + 1}
            </div>
          </td>
          <td style="padding:0 0 14px;vertical-align:top;">
            <div style="font-size:15px;font-weight:800;line-height:22px;color:#1b1530;">${escapeHtml(step.title)}</div>
            <div style="margin-top:4px;font-size:14px;line-height:22px;color:#605973;">${escapeHtml(step.copy)}</div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderDetailRowsHtml(rows: Array<[string, string]>) {
  return rows
    .map(
      ([label, value], index) => `
        <div
          style="margin-top:${index === 0 ? 0 : 12}px;border:2px solid #1b1530;border-radius:18px;overflow:hidden;background:#ffffff;"
        >
          <div
            style="padding:10px 12px;background:#fff6d1;font-size:11px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;"
          >
            ${escapeHtml(label)}
          </div>
          <div style="padding:12px;font-size:14px;font-weight:600;line-height:22px;color:#1b1530;">
            ${formatMultilineHtml(value)}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderEmailLayout(input: EmailLayoutInput) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(input.title)}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f7f0e8;">
        <div
          style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;"
          aria-hidden="true"
        >
          ${escapeHtml(input.previewText)}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f0e8;">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;">
                <tr>
                  <td
                    style="overflow:hidden;border:2px solid #1b1530;border-radius:30px;background:#fffaf6;box-shadow:10px 10px 0 #1b1530;"
                  >
                    <div style="height:10px;background:linear-gradient(90deg,#f04c89 0%,#ff9d4d 34%,#ffe175 68%,#a5ec57 100%);"></div>

                    <div style="padding:28px 26px 18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align:top;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-right:12px;vertical-align:middle;">
                                  <div
                                    style="height:48px;width:48px;border:2px solid #1b1530;border-radius:16px;background:linear-gradient(145deg,#54d3ff 0%,#7e53ff 55%,#f04c89 100%);text-align:center;font-size:16px;font-weight:900;line-height:44px;color:#1b1530;"
                                  >
                                    SZ
                                  </div>
                                </td>
                                <td style="vertical-align:middle;">
                                  <div style="font-size:11px;font-weight:800;line-height:16px;letter-spacing:0.18em;text-transform:uppercase;color:#605973;">
                                    signal. sync. zen.
                                  </div>
                                  <div style="margin-top:2px;font-size:30px;font-weight:900;line-height:30px;color:#1b1530;">
                                    <span style="color:#f04c89;">Soc</span>Zen
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td align="right" style="vertical-align:top;">
                            <div
                              style="display:inline-block;border:2px solid #1b1530;border-radius:999px;background:#ffffff;padding:10px 14px;text-align:left;"
                            >
                              <div style="font-size:11px;font-weight:800;line-height:14px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
                                ${escapeHtml(input.badgeLabel)}
                              </div>
                              <div style="margin-top:4px;font-size:15px;font-weight:900;line-height:18px;color:#1b1530;">
                                ${escapeHtml(input.badgeValue)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </table>

                      <div
                        style="margin-top:24px;border:2px solid #1b1530;border-radius:24px;background:linear-gradient(135deg,#1b1530 0%,#392f62 100%);padding:24px 22px 20px;"
                      >
                        <div style="font-size:11px;font-weight:800;line-height:16px;letter-spacing:0.16em;text-transform:uppercase;color:#ffe175;">
                          ${escapeHtml(input.eyebrow)}
                        </div>
                        <div style="margin-top:10px;font-size:34px;font-weight:900;line-height:38px;color:#fffaf6;">
                          ${escapeHtml(input.title)}
                        </div>
                        <div style="margin-top:12px;font-size:15px;line-height:24px;color:#ebe5ff;">
                          ${input.introHtml}
                        </div>
                      </div>

                      <div style="margin-top:22px;">
                        ${input.bodyHtml}
                      </div>

                      <div
                        style="margin-top:22px;border:2px solid #1b1530;border-radius:24px;background:#fff2c5;padding:18px 18px 16px;"
                      >
                        ${input.footerHtml}
                      </div>

                      <div
                        style="margin-top:18px;border:2px solid #1b1530;border-radius:24px;background:#ffffff;padding:16px 18px;"
                      >
                        <div style="font-size:11px;font-weight:800;line-height:16px;letter-spacing:0.14em;text-transform:uppercase;color:#605973;">
                          ${BRAND_SIGNATURE_LABEL}
                        </div>
                        <div style="margin-top:8px;font-size:24px;font-weight:900;line-height:28px;color:#1b1530;">
                          <span style="color:#605973;">SocZen</span>
                          <span style="display:inline-block;margin-left:8px;border:2px solid #1b1530;border-radius:999px;background:#ffe175;padding:2px 10px;color:#f04c89;">
                            Desk
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 8px 0;text-align:center;font-size:12px;font-weight:700;line-height:18px;color:#605973;">
                    ${new Date().getFullYear()} SocZen. Premium access, zero gatekeeping.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendResendEmail(input: SendEmailInput) {
  const config = getResendConfig();
  if (!config) {
    console.warn("Resend skipped: missing RESEND_API_KEY or RESEND_FROM_EMAIL");
    return { ok: false as const, skipped: true as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "SocZen/1.0",
    },
    body: JSON.stringify({
      from: config.from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? config.replyTo ?? undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { id?: string };
  return { ok: true as const, id: payload.id ?? null };
}

export async function sendSubmissionEmails(data: RequestEmailData) {
  const config = getResendConfig();
  if (!config) {
    return { requesterSent: false, adminSent: false, skipped: true as const };
  }

  const serviceCount = data.selectedServices.length;
  const subscriptionLabel = serviceCount === 1 ? "subscription" : "subscriptions";
  const websiteDomain = getWebsiteDomain();

  const company = formatOptionalValue(data.company);
  const useCase = formatOptionalValue(data.useCase);
  const message = formatOptionalValue(data.message);

  const requesterName = escapeHtml(data.name);
  const requesterEmail = escapeHtml(data.email);

  const requesterHtml = renderEmailLayout({
    previewText: `SocZen received your request for ${serviceCount} ${subscriptionLabel}.`,
    eyebrow: "Request received",
    title: "Your access request is officially in the queue",
    introHtml: `
      <p style="margin:0;">Hi ${requesterName}, your SocZen request landed cleanly.</p>
      <p style="margin:12px 0 0;">We are reviewing availability, fit, and handoff order now. Keep an eye on <a href="https://${escapeHtml(
        websiteDomain,
      )}" style="color:#2563eb;font-weight:700;text-decoration:underline;" target="_blank">${escapeHtml(
        websiteDomain,
      )}</a> for the next step.</p>
    `,
    badgeLabel: "Requested",
    badgeValue: `${serviceCount} ${subscriptionLabel}`,
    bodyHtml: `
      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#ffffff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Your lineup
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:24px;color:#605973;">
          These are the subscriptions currently attached to your request.
        </div>
        <div style="margin-top:16px;">
          ${renderServicePillsHtml(data.selectedServices)}
        </div>
      </div>

      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#fff7d6;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          What happens next
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
          ${renderStepRowsHtml([
            {
              title: "We review your request",
              copy: "The SocZen desk checks your requested stack, availability, and context.",
            },
            {
              title: "We line up the handoff",
              copy: "If a slot is available, we prepare the next step without extra friction.",
            },
            {
              title: "We reach back out",
              copy: "You will hear from us again with approval, follow-up, or any missing details.",
            },
          ])}
        </table>
      </div>

      <div style="border:2px solid #1b1530;border-radius:24px;background:#f5f2ff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Request snapshot
        </div>
        <div style="margin-top:14px;">
          ${renderDetailRowsHtml([
            ["Reference code", data.referenceCode],
            ["Email", data.email],
            ["Company", company],
            ["Use case", useCase],
          ])}
        </div>
      </div>
    `,
    footerHtml: `
      <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
        Save this tracking code
      </div>
      <div style="margin-top:8px;font-size:15px;line-height:24px;color:#1b1530;">
        Use <strong>${escapeHtml(data.referenceCode)}</strong> together with <strong>${escapeHtml(
          data.email,
        )}</strong> on the SocZen website to check your status timeline later. You can also reply here with corrections or extra context before we finish the review.
      </div>
    `,
  });

  const requesterText = [
    `Hi ${data.name},`,
    "",
    "Your SocZen access request is officially in the queue.",
    "",
    "You requested:",
    formatServicesText(data.selectedServices),
    "",
    "What happens next:",
    "1. We review your request and current availability.",
    "2. We line up the handoff if a slot is open.",
    "3. We reach back out with the next step.",
    "",
    `Reference code: ${data.referenceCode}`,
    `Tracking email: ${data.email}`,
    "",
    `Website & live tracker: https://${websiteDomain}`,
    "",
    "Thanks,",
    "SocZen",
    BRAND_SIGNATURE_LABEL,
    BRAND_SIGNATURE_NAME,
  ].join("\n");

  const adminDetails: Array<[string, string]> = [
    ["Reference code", data.referenceCode],
    ["Name", data.name],
    ["Email", data.email],
    ["Company", company],
  ];

  const adminHtml = renderEmailLayout({
    previewText: `New SocZen request from ${data.name} for ${serviceCount} ${subscriptionLabel}.`,
    eyebrow: "Admin signal",
    title: "A new SocZen request just landed",
    introHtml: `
      <p style="margin:0;"><strong>${requesterName}</strong> submitted a new access request.</p>
      <p style="margin:12px 0 0;">This notification is reply-ready, so you can continue the handoff straight from your inbox.</p>
    `,
    badgeLabel: "Reference",
    badgeValue: data.referenceCode,
    bodyHtml: `
      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#ffffff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Requested subscriptions
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:24px;color:#605973;">
          Requested by ${requesterName} <span style="color:#8c86a1;">(${requesterEmail})</span>
        </div>
        <div style="margin-top:16px;">
          ${renderServicePillsHtml(data.selectedServices)}
        </div>
      </div>

      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#fff7d6;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Requester snapshot
        </div>
        <div style="margin-top:14px;">
          ${renderDetailRowsHtml(adminDetails)}
        </div>
      </div>

      <div style="border:2px solid #1b1530;border-radius:24px;background:#f5f2ff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Intent + context
        </div>
        <div style="margin-top:14px;">
          ${renderDetailRowsHtml([
            ["Use case", useCase],
            ["Message", message],
          ])}
        </div>
      </div>
    `,
    footerHtml: `
      <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
        Fastest next move
      </div>
      <div style="margin-top:8px;font-size:15px;line-height:24px;color:#1b1530;">
        Reply to this email if you want to continue the conversation directly with ${requesterName}. The reply address is already wired for handoff.
      </div>
    `,
  });

  const adminText = [
    `New SocZen request from ${data.name}`,
    "",
    `Reference code: ${data.referenceCode}`,
    "",
    "Requested subscriptions:",
    formatServicesText(data.selectedServices),
    "",
    "Requester snapshot:",
    ...adminDetails.map(([label, value]) => `${label}: ${value}`),
    "",
    `Use case: ${useCase}`,
    `Message: ${message}`,
    "",
    "Reply to this email to continue the handoff.",
    "",
    BRAND_SIGNATURE_LABEL,
    BRAND_SIGNATURE_NAME,
  ].join("\n");

  const tasks: Promise<unknown>[] = [
    sendResendEmail({
      to: data.email,
      subject: "SocZen request received | You're in the queue",
      html: requesterHtml,
      text: requesterText,
    }),
  ];

  if (config.adminEmail) {
    tasks.push(
      sendResendEmail({
        to: config.adminEmail,
        subject: `SocZen admin signal | ${data.referenceCode}`,
        html: adminHtml,
        text: adminText,
        replyTo: data.email,
      }),
    );
  }

  const [requesterResult, adminResult] = await Promise.allSettled(tasks);

  if (requesterResult.status === "rejected") {
    console.error("Failed to send requester email:", requesterResult.reason);
  }

  if (adminResult?.status === "rejected") {
    console.error("Failed to send admin notification email:", adminResult.reason);
  }

  return {
    requesterSent: requesterResult.status === "fulfilled",
    adminSent: adminResult ? adminResult.status === "fulfilled" : false,
    skipped: false as const,
  };
}

export async function sendRequestStatusEmail(data: RequestStatusEmailData) {
  const config = getResendConfig();
  if (!config) {
    return { sent: false, skipped: true as const };
  }

  const requesterName = escapeHtml(data.name);
  const websiteDomain = getWebsiteDomain();
  const customNote = data.note?.trim() || null;

  const meta = {
    approved: {
      subject: "SocZen update | Your request was approved",
      previewText: "Your SocZen request is now approved.",
      eyebrow: "Request approved",
      title: "Your request is approved",
      badgeValue: "Approved",
      introHtml: `
        <p style="margin:0;">Hi ${requesterName}, good news. Your SocZen request is now approved.</p>
        <p style="margin:12px 0 0;">The handoff can move forward from here. Check <a href="https://${escapeHtml(
          websiteDomain,
        )}" style="color:#2563eb;font-weight:700;text-decoration:underline;" target="_blank">${escapeHtml(
          websiteDomain,
        )}</a> for access details and timeline tracking.</p>
      `,
      statusLead: "Your request cleared review and is ready for the next step.",
      nextTitle: "What happens next",
      nextCopy:
        "Watch your inbox for the actual access handoff, follow-up details, or any final confirmation from SocZen.",
      footerTitle: "Keep this reference close",
      footerCopy:
        "If you need to check progress later, use your reference code and the same request email in the SocZen tracker.",
    },
    contacted: {
      subject: "SocZen update | We already reached out",
      previewText: "SocZen has contacted you about your request.",
      eyebrow: "Inbox update",
      title: "We already reached out about your request",
      badgeValue: "Contacted",
      introHtml: `
        <p style="margin:0;">Hi ${requesterName}, your request moved into the contact stage.</p>
        <p style="margin:12px 0 0;">Please check your inbox, spam, and promotions tabs for the latest SocZen message. If you already saw it, just reply there to keep things moving.</p>
      `,
      statusLead: "A follow-up message has already been sent for this request.",
      nextTitle: "What to do now",
      nextCopy:
        "Open the latest SocZen email, reply if needed, and follow the handoff instructions from there.",
      footerTitle: "Did not see the message?",
      footerCopy:
        "Search your inbox for SocZen, then use your tracker reference if you need to confirm the request status again.",
    },
    rejected: {
      subject: "SocZen update | Your request was closed",
      previewText: "Your SocZen request was closed.",
      eyebrow: "Request closed",
      title: "This request was closed",
      badgeValue: "Closed",
      introHtml: `
        <p style="margin:0;">Hi ${requesterName}, we could not move this request forward right now.</p>
        <p style="margin:12px 0 0;">That usually means the current slot, fit, or availability window did not line up. The request is now closed on our side.</p>
      `,
      statusLead: "This request is no longer active.",
      nextTitle: "What this means",
      nextCopy:
        "You will not receive access from this specific request, but you can always submit a new request later if things change.",
      footerTitle: "Need to try again later?",
      footerCopy:
        "Keep the reference code for your records, or submit a fresh request when you want another review cycle.",
    },
  }[data.status];

  const html = renderEmailLayout({
    previewText: meta.previewText,
    eyebrow: meta.eyebrow,
    title: meta.title,
    introHtml: meta.introHtml,
    badgeLabel: "Status",
    badgeValue: meta.badgeValue,
    bodyHtml: `
      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#ffffff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Request status
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:24px;color:#605973;">
          ${escapeHtml(meta.statusLead)}
        </div>
      </div>

      ${
        customNote
          ? `
      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#ffe7ef;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Custom note
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:24px;color:#1b1530;">
          ${formatMultilineHtml(customNote)}
        </div>
      </div>
      `
          : ""
      }

      <div style="margin-bottom:18px;border:2px solid #1b1530;border-radius:24px;background:#fff7d6;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Requested subscriptions
        </div>
        <div style="margin-top:16px;">
          ${renderServicePillsHtml(data.selectedServices)}
        </div>
      </div>

      <div style="border:2px solid #1b1530;border-radius:24px;background:#f5f2ff;padding:20px 18px;">
        <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
          Tracking snapshot
        </div>
        <div style="margin-top:14px;">
          ${renderDetailRowsHtml([
            ["Reference code", data.referenceCode],
            ["Tracking email", data.email],
          ])}
        </div>
      </div>
    `,
    footerHtml: `
      <div style="font-size:12px;font-weight:800;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#605973;">
        ${escapeHtml(meta.nextTitle)}
      </div>
      <div style="margin-top:8px;font-size:15px;line-height:24px;color:#1b1530;">
        ${escapeHtml(meta.nextCopy)}
      </div>
      <div style="margin-top:12px;font-size:14px;line-height:22px;color:#605973;">
        <strong>${escapeHtml(meta.footerTitle)}:</strong> ${escapeHtml(meta.footerCopy)}
      </div>
    `,
  });

  const text = [
    `Hi ${data.name},`,
    "",
    meta.title,
    "",
    meta.statusLead,
    "",
    ...(customNote ? ["Custom note:", customNote, ""] : []),
    "Requested subscriptions:",
    formatServicesText(data.selectedServices),
    "",
    `Reference code: ${data.referenceCode}`,
    `Tracking email: ${data.email}`,
    "",
    `${meta.nextTitle}: ${meta.nextCopy}`,
    "",
    meta.footerCopy,
    "",
    "SocZen",
    BRAND_SIGNATURE_LABEL,
    BRAND_SIGNATURE_NAME,
  ].join("\n");

  const emailTasks: Promise<unknown>[] = [
    sendResendEmail({
      to: data.email,
      subject: meta.subject,
      html,
      text,
    }),
  ];

  if (config.adminEmail) {
    emailTasks.push(
      sendResendEmail({
        to: config.adminEmail,
        subject: `[Admin Log] Request ${data.status.toUpperCase()} | ${data.name} (${data.referenceCode})`,
        html,
        text,
        replyTo: data.email,
      }),
    );
  }

  const [requesterRes, adminRes] = await Promise.allSettled(emailTasks);

  if (requesterRes.status === "rejected") {
    console.error("Failed to send status update email:", requesterRes.reason);
  }

  if (adminRes?.status === "rejected") {
    console.error("Failed to send admin status log email:", adminRes.reason);
  }

  return {
    sent: requesterRes.status === "fulfilled",
    skipped: false as const,
  };
}
