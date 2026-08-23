import type { FastifyInstance } from "fastify";
import { createCustomer, listCustomers, updateCustomer } from "../data/prisma-store.js";

function getUserId(request: { user: unknown }): string {
  return (request.user as { sub: string }).sub;
}

type CreateCustomerBody = {
  displayNameHe?: string;
  legalNameHe?: string;
  type?: "PRIVATE" | "COMPANY";
  taxId?: string;
  email?: string;
  phone?: string;
  addressHe?: string;
  cityHe?: string;
  paymentTermsDays?: number;
};

function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

function validateCustomerFields(body: CreateCustomerBody): string | null {
  if (!isOptionalString(body.legalNameHe, 200)) return "שם משפטי לא תקין";
  if (!isOptionalString(body.taxId, 20)) return "מספר מזהה לא תקין";
  if (!isOptionalString(body.email, 254)) return "כתובת אימייל לא תקינה";
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return "כתובת אימייל לא תקינה";
  if (!isOptionalString(body.phone, 30)) return "מספר טלפון לא תקין";
  if (!isOptionalString(body.addressHe, 300)) return "כתובת לא תקינה";
  if (!isOptionalString(body.cityHe, 100)) return "שם עיר לא תקין";
  if (
    body.paymentTermsDays !== undefined &&
    (!Number.isFinite(body.paymentTermsDays) || body.paymentTermsDays < 0 || body.paymentTermsDays > 3650)
  ) {
    return "ימי אשראי לא תקינים";
  }
  return null;
}

export async function registerCustomerRoutes(app: FastifyInstance) {
  app.get("/v1/customers", async (request) => ({ items: await listCustomers(getUserId(request)) }));

  app.post<{ Body: CreateCustomerBody }>("/v1/customers", async (request, reply) => {
    const body = request.body ?? {};
    const userId = getUserId(request);

    if (!body.displayNameHe?.trim() || body.displayNameHe.length > 200) {
      return reply.code(400).send({ message: "שם לקוח הוא שדה חובה" });
    }

    if (body.type && body.type !== "PRIVATE" && body.type !== "COMPANY") {
      return reply.code(400).send({ message: "סוג לקוח לא תקין" });
    }

    const fieldError = validateCustomerFields(body);
    if (fieldError) {
      return reply.code(400).send({ message: fieldError });
    }

    try {
      const customer = await createCustomer(userId, {
        displayNameHe: body.displayNameHe,
        legalNameHe: body.legalNameHe,
        type: body.type ?? "PRIVATE",
        taxId: body.taxId,
        email: body.email,
        phone: body.phone,
        addressHe: body.addressHe,
        cityHe: body.cityHe,
        paymentTermsDays: body.paymentTermsDays ?? 0
      });

      return reply.code(201).send(customer);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return reply.code(409).send({ message: "כבר קיים לקוח עם מספר מזהה זה" });
      }

      throw error;
    }
  });

  app.put<{ Params: { id: string }; Body: CreateCustomerBody }>("/v1/customers/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body ?? {};
    const userId = getUserId(request);

    if (body.displayNameHe !== undefined && (!body.displayNameHe.trim() || body.displayNameHe.length > 200)) {
      return reply.code(400).send({ message: "שם לקוח לא יכול להיות ריק" });
    }

    if (body.type && body.type !== "PRIVATE" && body.type !== "COMPANY") {
      return reply.code(400).send({ message: "סוג לקוח לא תקין" });
    }

    const fieldError = validateCustomerFields(body);
    if (fieldError) {
      return reply.code(400).send({ message: fieldError });
    }

    try {
      const customer = await updateCustomer(userId, id, body);
      return reply.send(customer);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
        return reply.code(404).send({ message: "לקוח לא נמצא" });
      }
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return reply.code(409).send({ message: "כבר קיים לקוח עם מספר מזהה זה" });
      }
      throw error;
    }
  });
}
