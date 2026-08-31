import type { FastifyInstance } from "fastify";
import { getInvoiceForExport } from "../data/prisma-store.js";
import { buildEmailHtml } from "../lib/invoice-html.js";
import { getDocumentTypeLabel } from "@invoice/shared";
import { DocumentType } from "@invoice/shared";
import { getMailTransporter, getMailFromAddress } from "../lib/mail.js";

function getUserId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub;
}

type SendEmailParams = { id: string };
type SendEmailBody = { to?: string };

export async function registerSendEmailRoutes(app: FastifyInstance) {
  const transporter = getMailTransporter();
  const gmailUser = getMailFromAddress();

  if (!transporter || !gmailUser) {
    app.log.warn("Gmail OAuth2 credentials not set — email sending disabled");
    return;
  }

  app.post<{ Params: SendEmailParams; Body: SendEmailBody }>(
    "/v1/invoices/:id/send-email",
    async (request, reply) => {
      const userId = getUserId(request);
      const invoice = await getInvoiceForExport(userId, request.params.id);

      if (!invoice) {
        return reply.code(404).send({ message: "המסמך לא נמצא" });
      }

      const to = request.body?.to?.trim() || invoice.customer.email;

      if (!to) {
        return reply
          .code(400)
          .send({ message: "לא הוגדרה כתובת מייל ללקוח — יש לציין כתובת" });
      }

      const docLabel = getDocumentTypeLabel(invoice.documentType as DocumentType);
      const prefix = invoice.seriesPrefix ?? "";
      const numberPart = invoice.sequenceNumber ? `${prefix}#${invoice.sequenceNumber}` : "טיוטה";
      const subject = `${docLabel} ${numberPart} מ${invoice.business.nameHe}`;
      const html = buildEmailHtml(invoice);

      try {
        await transporter.sendMail({
          from: `"${invoice.business.nameHe}" <${gmailUser}>`,
          to,
          subject,
          html,
        });
      } catch (err) {
        app.log.error({ err }, "Gmail SMTP error");
        return reply.code(502).send({ message: "שליחת המייל נכשלה — נסה שוב" });
      }

      return reply.send({ ok: true, to });
    }
  );
}
