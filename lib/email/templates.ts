function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type ChangeEmailParams = {
  monitorName: string;
  url: string;
  summary: string;
  diffHtml: string;
  beforeSnippet: string;
  afterSnippet: string;
  appUrl: string;
  monitorId: string;
  eventId: string;
};

export function buildChangeEmail({
  monitorName,
  url,
  summary,
  diffHtml,
  beforeSnippet,
  afterSnippet,
  appUrl,
  monitorId,
  eventId,
}: ChangeEmailParams) {
  const subject = `Watchtower: ${monitorName} changed`;
  const safeBefore = escapeHtml(beforeSnippet);
  const safeAfter = escapeHtml(afterSnippet);
  const link = `${appUrl}/monitors/${monitorId}#event-${eventId}`;

  const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
    <style>
      ins { background:#dcfce7;color:#166534;text-decoration:none; }
      del { background:#fee2e2;color:#991b1b;text-decoration:line-through; }
    </style>
    <h2 style="margin:0 0 12px;">${escapeHtml(monitorName)} changed</h2>
    <p style="margin:0 0 12px;">${escapeHtml(summary)}</p>
    <p style="margin:0 0 16px;"><a href="${escapeHtml(
      url
    )}" style="color:#2563eb;">${escapeHtml(url)}</a></p>
    <h3 style="margin:24px 0 8px;">What changed</h3>
    <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
      <div style="white-space:pre-wrap;">${diffHtml}</div>
    </div>
    <h3 style="margin:24px 0 8px;">Before</h3>
    <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;white-space:pre-wrap;">${safeBefore}</div>
    <h3 style="margin:24px 0 8px;">After</h3>
    <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;white-space:pre-wrap;">${safeAfter}</div>
    <p style="margin:24px 0 0;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">View change history</a>
    </p>
  </div>
  `;

  const text = [
    `${monitorName} changed`,
    summary,
    url,
    "",
    "What changed:",
    diffHtml.replace(/<[^>]+>/g, ""),
    "",
    "Before:",
    beforeSnippet,
    "",
    "After:",
    afterSnippet,
    "",
    `View change history: ${link}`,
  ].join("\n");

  return { subject, html, text };
}
