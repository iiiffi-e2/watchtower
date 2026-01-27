import { Resend } from "resend";

export type EmailPayload = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendEmail(payload: EmailPayload) {
  const provider = process.env.EMAIL_PROVIDER ?? "resend";
  if (provider !== "resend") {
    throw new Error(`Unsupported email provider: ${provider}`);
  }

  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error("FROM_EMAIL is not set");
  }

  const resend = getResendClient();
  await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}
