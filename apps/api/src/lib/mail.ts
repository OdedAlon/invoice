type SendMailOptions = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type Mailer = {
  sendMail(opts: SendMailOptions): Promise<void>;
};

function encodeMimeWord(str: string): string {
  return `=?UTF-8?B?${Buffer.from(str, "utf-8").toString("base64")}?=`;
}

// "Name" <email> or Name <email> -> RFC 2047-encode the display name if it's non-ASCII.
function encodeFromHeader(from: string): string {
  const match = from.match(/^(.*)<(.+)>$/);
  if (!match) return from;
  const name = (match[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
  const email = (match[2] ?? "").trim();
  if (!name) return `<${email}>`;
  if (/^[\x00-\x7F]*$/.test(name)) return `"${name}" <${email}>`;
  return `${encodeMimeWord(name)} <${email}>`;
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Gmail token refresh returned no access_token");
  return data.access_token;
}

let _mailer: Mailer | null | undefined;

// Sends via the Gmail REST API over HTTPS rather than raw SMTP — Render (and many
// hosts) block outbound SMTP ports (587/465/25) as an anti-spam measure, but HTTPS
// is never blocked since the whole app already depends on it.
export function getMailTransporter(): Mailer | null {
  if (_mailer !== undefined) return _mailer;

  const gmailUser = process.env.GMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!gmailUser || !clientId || !clientSecret || !refreshToken) {
    _mailer = null;
    return null;
  }

  _mailer = {
    async sendMail({ from, to, subject, html }) {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

      const mime =
        `From: ${encodeFromHeader(from)}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${encodeMimeWord(subject)}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/html; charset="UTF-8"\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n` +
        Buffer.from(html, "utf-8").toString("base64");

      const raw = Buffer.from(mime, "utf-8").toString("base64url");

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      if (!res.ok) {
        throw new Error(`Gmail API send failed: ${res.status} ${await res.text()}`);
      }
    },
  };

  return _mailer;
}

export function getMailFromAddress(): string | undefined {
  return process.env.GMAIL_USER;
}
