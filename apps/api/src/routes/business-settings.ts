import type { FastifyInstance } from "fastify";
import { getBusinessSettings, updateBusinessSettings } from "../data/prisma-store.js";
import { BusinessTaxProfile, DocumentType, PRINT_FONT_OPTIONS } from "@invoice/shared";
import type { DocumentSeriesConfig, PrintTemplateConfig } from "@invoice/shared";

const VALID_FONT_FAMILIES = new Set(PRINT_FONT_OPTIONS.map((opt) => opt.value));
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
// Matches only what the settings UI actually produces (FileReader.readAsDataURL
// on an <input type="file" accept="image/*">) — deliberately excludes
// image/svg+xml, since printTemplate/logoUrl values are interpolated
// directly into the invoice HTML that Puppeteer renders server-side for
// PDF export, so an unconstrained value here is a server-side injection
// vector, not just a client-side display concern.
const LOGO_DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_LOGO_URL_LENGTH = 3_000_000;

function getUserId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub;
}

type UpdateBusinessSettingsBody = {
  nameHe?: string;
  taxId?: string;
  taxProfile?: BusinessTaxProfile;
  detailsHe?: string;
  addressHe?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  seriesConfig?: DocumentSeriesConfig[];
  printTemplate?: PrintTemplateConfig;
};

export async function registerBusinessSettingsRoutes(app: FastifyInstance) {
  app.get("/v1/business/settings", async (request) => {
    return getBusinessSettings(getUserId(request));
  });

  app.put<{ Body: UpdateBusinessSettingsBody }>("/v1/business/settings", async (request, reply) => {
    const body = request.body ?? {};
    const userId = getUserId(request);

    if (!body.nameHe?.trim() || body.nameHe.length > 200) {
      return reply.code(400).send({ message: "שם עסק הוא שדה חובה" });
    }

    const optionalStringOk = (value: string | undefined, maxLength: number) =>
      value === undefined || (typeof value === "string" && value.length <= maxLength);

    if (
      !optionalStringOk(body.taxId, 20) ||
      !optionalStringOk(body.detailsHe, 500) ||
      !optionalStringOk(body.addressHe, 300) ||
      !optionalStringOk(body.phone, 30) ||
      !optionalStringOk(body.email, 254)
    ) {
      return reply.code(400).send({ message: "אחד משדות העסק אינו תקין" });
    }

    if (body.logoUrl && (body.logoUrl.length > MAX_LOGO_URL_LENGTH || !LOGO_DATA_URL_RE.test(body.logoUrl))) {
      return reply.code(400).send({ message: "קובץ הלוגו אינו תקין" });
    }

    if (body.printTemplate) {
      if (body.printTemplate.primaryColor && !HEX_COLOR_RE.test(body.printTemplate.primaryColor)) {
        return reply.code(400).send({ message: "צבע ראשי אינו תקין" });
      }
      if (body.printTemplate.fontFamily && !VALID_FONT_FAMILIES.has(body.printTemplate.fontFamily)) {
        return reply.code(400).send({ message: "פונט אינו תקין" });
      }
    }

    // Validate series config if provided
    const validTypes = Object.values(DocumentType) as string[];
    if (body.seriesConfig) {
      for (const cfg of body.seriesConfig) {
        if (!validTypes.includes(cfg.documentType)) {
          return reply.code(400).send({ message: `סוג מסמך לא חוקי: ${cfg.documentType}` });
        }
        if (typeof cfg.startingNumber !== "number" || cfg.startingNumber < 1) {
          return reply.code(400).send({ message: "מספר התחלה חייב להיות לפחות 1" });
        }
      }
    }

    const settings = await updateBusinessSettings(userId, {
      nameHe: body.nameHe,
      taxId: body.taxId,
      taxProfile: body.taxProfile,
      detailsHe: body.detailsHe,
      addressHe: body.addressHe,
      phone: body.phone,
      email: body.email,
      logoUrl: body.logoUrl,
      seriesConfig: body.seriesConfig,
      printTemplate: body.printTemplate
    });

    return reply.send(settings);
  });
}
