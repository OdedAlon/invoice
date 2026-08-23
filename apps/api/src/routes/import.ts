import type { FastifyInstance } from "fastify";
import { unzipSync, strFromU8 } from "fflate";
import { importData } from "../data/prisma-store.js";

function getUserId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub;
}

const MAX_IMPORT_RECORDS = 20_000;

// Keeps only entries that are plain objects (rejects null/arrays/primitives
// before they ever reach importData, which otherwise treats every array
// element as `any`).
function keepPlainObjects(items: unknown[]): unknown[] {
  return items.filter((item) => typeof item === "object" && item !== null && !Array.isArray(item));
}

export async function registerImportRoutes(app: FastifyInstance) {
  app.post("/v1/import/full", async (request, reply) => {
    const body = request.body as Buffer | undefined;

    if (!body || body.length === 0) {
      return reply.code(400).send({ message: "לא נשלח קובץ ZIP" });
    }

    let unzipped: ReturnType<typeof unzipSync>;
    try {
      unzipped = unzipSync(body);
    } catch {
      return reply.code(400).send({ message: "קובץ ZIP לא תקין — ודא שהייצא בוצע מאפליקציה זו" });
    }

    // Locate customers.json and invoices.json anywhere in the archive
    let rawCustomers: unknown[] = [];
    let rawInvoices: unknown[] = [];

    for (const [filePath, fileData] of Object.entries(unzipped)) {
      const name = filePath.split("/").pop() ?? "";
      try {
        const parsed = JSON.parse(strFromU8(fileData)) as unknown;
        if (name === "customers.json") {
          rawCustomers = Array.isArray(parsed) ? parsed : ((parsed as any).customers ?? []);
        } else if (name === "invoices.json") {
          rawInvoices = Array.isArray(parsed) ? parsed : ((parsed as any).invoices ?? []);
        }
      } catch { /* skip unparseable files */ }
    }

    if (rawCustomers.length === 0 && rawInvoices.length === 0) {
      return reply.code(400).send({
        message: "לא נמצאו customers.json או invoices.json ב-ZIP — ייתכן שהקובץ לא מתאים לפורמט הייצוא"
      });
    }

    if (rawCustomers.length > MAX_IMPORT_RECORDS || rawInvoices.length > MAX_IMPORT_RECORDS) {
      return reply.code(400).send({ message: "מספר הרשומות בקובץ חורג מהמותר" });
    }

    rawCustomers = keepPlainObjects(rawCustomers);
    rawInvoices = keepPlainObjects(rawInvoices);

    const result = await importData(getUserId(request), rawCustomers, rawInvoices);

    return reply.send({
      ok: true,
      importedCustomers: result.importedCustomers,
      importedInvoices: result.importedInvoices,
      skippedInvoices: result.skippedInvoices
    });
  });
}
