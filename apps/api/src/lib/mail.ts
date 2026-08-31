import nodemailer, { type Transporter } from "nodemailer";

let _transporter: Transporter | null = null;

export function getMailTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const gmailUser = process.env.GMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!gmailUser || !clientId || !clientSecret || !refreshToken) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      type: "OAuth2",
      user: gmailUser,
      clientId,
      clientSecret,
      refreshToken,
    },
  });

  return _transporter;
}

export function getMailFromAddress(): string | undefined {
  return process.env.GMAIL_USER;
}
