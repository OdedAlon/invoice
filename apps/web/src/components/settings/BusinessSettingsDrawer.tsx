import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { X } from "lucide-react";
import {
  BusinessTaxProfile,
  DocumentType,
  getDocumentTypeLabel,
  PRINT_COLOR_PRESETS,
  PRINT_FONT_OPTIONS,
  type BusinessSettings,
  type DocumentSeriesConfig,
  type UpdateBusinessSettingsInput
} from "@invoice/shared";
import { apiPut } from "@/lib/api";
import type { ServiceItem } from "@/types/workspace";
import { Field } from "@/components/common/Field";

export function BusinessSettingsDrawer({
  businessSettings,
  setBusinessSettings,
  serviceItems,
  setServiceItems,
  newServiceItemName,
  setNewServiceItemName,
  newServiceItemPrice,
  setNewServiceItemPrice,
  onClose,
  onError
}: {
  businessSettings: BusinessSettings;
  setBusinessSettings: Dispatch<SetStateAction<BusinessSettings>>;
  serviceItems: ServiceItem[];
  setServiceItems: Dispatch<SetStateAction<ServiceItem[]>>;
  newServiceItemName: string;
  setNewServiceItemName: Dispatch<SetStateAction<string>>;
  newServiceItemPrice: string;
  setNewServiceItemPrice: Dispatch<SetStateAction<string>>;
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const [savingSettings, setSavingSettings] = useState(false);

  function updateBusinessSettingsField<Key extends keyof UpdateBusinessSettingsInput>(
    key: Key,
    value: UpdateBusinessSettingsInput[Key]
  ) {
    setBusinessSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleBusinessSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    onError(null);

    try {
      const updatedSettings = await apiPut<BusinessSettings>(
        "/v1/business/settings",
        {
          nameHe: businessSettings.nameHe,
          taxId: businessSettings.taxId,
          taxProfile: businessSettings.taxProfile,
          detailsHe: businessSettings.detailsHe,
          addressHe: businessSettings.addressHe,
          phone: businessSettings.phone,
          email: businessSettings.email,
          logoUrl: businessSettings.logoUrl,
          seriesConfig: businessSettings.seriesConfig,
          printTemplate: businessSettings.printTemplate
        } satisfies UpdateBusinessSettingsInput,
        "שמירת הגדרות העסק נכשלה"
      );

      setBusinessSettings(updatedSettings);
      onClose();
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "שמירת הגדרות העסק נכשלה");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <aside className="drawer-slide-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-base font-semibold">הגדרות עסק</h2>
          <p className="text-xs text-slate-500">שם, פרטי עסק ולוגו שיופיעו במסמכי הדפסה.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="סגירה">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
      <form className="grid gap-4" onSubmit={handleBusinessSettingsSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם עסק">
            <input
              className="input"
              value={businessSettings.nameHe}
              onChange={(event) => updateBusinessSettingsField("nameHe", event.target.value)}
              autoComplete="organization"
            />
          </Field>
          <Field label={businessSettings.taxProfile === BusinessTaxProfile.PTUR ? "ע.פ" : "ע.מ"}>
            <input
              className="input ltr-text"
              placeholder="מספר עוסק / חברה"
              value={businessSettings.taxId ?? ""}
              onChange={(event) => updateBusinessSettingsField("taxId", event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="סוג עוסק">
            <select
              className="input"
              value={businessSettings.taxProfile}
              onChange={(event) => updateBusinessSettingsField("taxProfile", event.target.value as BusinessTaxProfile)}
            >
              <option value={BusinessTaxProfile.MURSHE}>עוסק מורשה (עם מע״מ)</option>
              <option value={BusinessTaxProfile.PTUR}>עוסק פטור (ללא מע״מ)</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="כתובת">
            <input
              className="input"
              value={businessSettings.addressHe ?? ""}
              onChange={(event) => updateBusinessSettingsField("addressHe", event.target.value)}
              autoComplete="street-address"
            />
          </Field>
          <Field label="טלפון">
            <input
              className="input"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={businessSettings.phone ?? ""}
              onChange={(event) => updateBusinessSettingsField("phone", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="תיאור קצר">
            <input
              className="input"
              value={businessSettings.detailsHe ?? ""}
              onChange={(event) => updateBusinessSettingsField("detailsHe", event.target.value)}
              placeholder="למשל: שירותי הנהלת חשבונות לעסקים"
            />
          </Field>
          <Field label="אימייל">
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={businessSettings.email ?? ""}
              onChange={(event) => updateBusinessSettingsField("email", event.target.value)}
            />
          </Field>
          <div className="grid gap-2 text-sm font-medium text-slate-700">
            <span>לוגו עסק</span>
            <div className="flex items-center gap-3">
              {businessSettings.logoUrl ? (
                <img
                  src={businessSettings.logoUrl}
                  alt="לוגו"
                  style={{ maxHeight: "56px", maxWidth: "240px", width: "auto", height: "auto", display: "block", flexShrink: 0, border: "1px solid #e2e8f0", borderRadius: 0 }}
                />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-xs">
                  לוגו
                </div>
              )}
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => document.getElementById("logo-upload-input")?.click()}
              >
                {businessSettings.logoUrl ? "החלפת תמונה" : "העלאת תמונה"}
              </button>
              <input
                id="logo-upload-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => updateBusinessSettingsField("logoUrl", reader.result as string);
                  reader.readAsDataURL(file);
                  event.target.value = "";
                }}
              />
              {businessSettings.logoUrl ? (
                <button
                  type="button"
                  className="text-sm text-rose-600 hover:text-rose-800"
                  onClick={() => updateBusinessSettingsField("logoUrl", "")}
                >
                  הסרה
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-indigo-200 pt-4">
          <h3 className="mb-1 text-sm font-semibold">עיצוב תבנית הדפסה</h3>
          <p className="mb-3 text-xs text-slate-500">צבע ופונט שישמשו בכותרת ובטבלת הסכומים של מסמכי ה-PDF.</p>
          {(() => {
            const defaultColor = "#0f172a";
            const defaultFont = PRINT_FONT_OPTIONS[0]?.value ?? "Inter, Arial, sans-serif";
            const curColor = businessSettings.printTemplate?.primaryColor ?? defaultColor;
            const curFont = businessSettings.printTemplate?.fontFamily ?? defaultFont;
            const setPrintTemplate = (primaryColor: string, fontFamily: string) =>
              updateBusinessSettingsField("printTemplate", { primaryColor, fontFamily });
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-600">צבע ראשי</p>
                  <div className="flex flex-wrap gap-2">
                    {PRINT_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        title={preset.label}
                        onClick={() => setPrintTemplate(preset.value, curFont)}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          curColor === preset.value ? "scale-110 border-slate-900" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: preset.value }}
                      />
                    ))}
                    <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500">
                      <input
                        type="color"
                        className="h-7 w-7 cursor-pointer rounded-full border-0 p-0"
                        value={curColor}
                        onChange={(e) => setPrintTemplate(e.target.value, curFont)}
                      />
                      מותאם אישית
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded-sm" style={{ backgroundColor: curColor }} />
                    <span className="text-xs text-slate-500">{curColor}</span>
                  </div>
                </div>
                <Field label="פונט">
                  <select
                    className="input"
                    value={curFont}
                    onChange={(e) => setPrintTemplate(curColor, e.target.value)}
                  >
                    {PRINT_FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            );
          })()}
          {/* Live preview bar */}
          <div
            className="mt-3 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{
              backgroundColor: businessSettings.printTemplate?.primaryColor ?? "#0f172a",
              fontFamily: businessSettings.printTemplate?.fontFamily ?? (PRINT_FONT_OPTIONS[0]?.value ?? "Inter, Arial, sans-serif")
            }}
          >
            {businessSettings.nameHe || "שם העסק"} — תצוגה מקדימה של כותרת המסמך
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            סגירה
          </button>
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            disabled={savingSettings}
          >
            {savingSettings ? "שומר..." : "שמירת הגדרות"}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h3 className="mb-1 text-base font-semibold">מספור מסמכים — סדרות</h3>
        <p className="mb-4 text-sm text-slate-500">הגדר קידומת (למשל INV-) ומספר התחלה לכל סוג מסמך. שינוי מספר ההתחלה ייכנס לתוקף רק אם טרם הונפק מסמך מאותו סוג בשנה הנוכחית.</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-right font-medium text-slate-600">סוג מסמך</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">קידומת</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">מספר התחלה</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(DocumentType).map((dt) => {
                const cfg = businessSettings.seriesConfig?.find((c) => c.documentType === dt);
                return (
                  <tr key={dt} className="border-t border-slate-200">
                    <td className="px-4 py-2 font-medium">{getDocumentTypeLabel(dt)}</td>
                    <td className="px-4 py-2">
                      <input
                        className="input w-28 py-1 text-sm"
                        placeholder="למשל: INV-"
                        value={cfg?.prefix ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBusinessSettings((prev) => {
                            const existing = prev.seriesConfig ?? [];
                            const idx = existing.findIndex((c) => c.documentType === dt);
                            const entry: DocumentSeriesConfig = { documentType: dt, prefix: val, startingNumber: cfg?.startingNumber ?? 1 };
                            const next = idx >= 0 ? existing.map((c, i) => i === idx ? entry : c) : [...existing, entry];
                            return { ...prev, seriesConfig: next };
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="input w-24 py-1 text-sm"
                        type="number"
                        min="1"
                        step="1"
                        value={cfg?.startingNumber ?? 1}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setBusinessSettings((prev) => {
                            const existing = prev.seriesConfig ?? [];
                            const idx = existing.findIndex((c) => c.documentType === dt);
                            const entry: DocumentSeriesConfig = { documentType: dt, prefix: cfg?.prefix ?? "", startingNumber: val };
                            const next = idx >= 0 ? existing.map((c, i) => i === idx ? entry : c) : [...existing, entry];
                            return { ...prev, seriesConfig: next };
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">השינויים יישמרו בלחיצה על "שמירת הגדרות" בטופס למעלה.</p>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h3 className="mb-1 text-base font-semibold">רשימת שירותים ומוצרים</h3>
        <p className="mb-4 text-sm text-slate-500">פריטים לבחירה מהירה בשורות חיוב, כולל מחיר ברירת מחדל הניתן לעריכה בכל שורה.</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <input
            className="input flex-1"
            value={newServiceItemName}
            onChange={(e) => setNewServiceItemName(e.target.value)}
            placeholder="שם שירות / מוצר"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const name = newServiceItemName.trim();
                if (name && !serviceItems.find((s) => s.name === name)) {
                  setServiceItems((prev) => [...prev, { name, defaultPrice: Number(newServiceItemPrice) || 0 }]);
                  setNewServiceItemName("");
                  setNewServiceItemPrice("");
                }
              }
            }}
          />
          <input
            className="input w-32"
            type="number"
            min="0"
            step="1"
            value={newServiceItemPrice}
            onChange={(e) => setNewServiceItemPrice(e.target.value)}
            placeholder="מחיר ברירת מחדל"
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            onClick={() => {
              const name = newServiceItemName.trim();
              if (name && !serviceItems.find((s) => s.name === name)) {
                setServiceItems((prev) => [...prev, { name, defaultPrice: Number(newServiceItemPrice) || 0 }]);
                setNewServiceItemName("");
                setNewServiceItemPrice("");
              }
            }}
          >
            הוספה
          </button>
        </div>
        {serviceItems.length === 0 ? (
          <p className="text-sm text-slate-400">עדיין לא נוספו שירותים.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">שם</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">מחיר ברירת מחדל</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {serviceItems.map((item) => (
                  <tr key={item.name} className="border-t border-slate-200">
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">
                      <input
                        className="input w-28 py-1 text-sm"
                        type="number"
                        min="0"
                        step="1"
                        value={item.defaultPrice}
                        onChange={(e) =>
                          setServiceItems((prev) =>
                            prev.map((s) => s.name === item.name ? { ...s, defaultPrice: Number(e.target.value) || 0 } : s)
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                        onClick={() => setServiceItems((prev) => prev.filter((s) => s.name !== item.name))}
                        aria-label="הסר שירות"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>
    </aside>
  );
}
