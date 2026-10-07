import { z } from "zod";
import { CALL_FORMAT_VALUES, DEFAULT_CALL_FORMAT } from "./constants";

/**
 * Server-boundary validation for the Phase 6A pre-auth contact form
 * (section 20). Deliberately narrow: only the four fields the
 * instruction actually asks for -- guardian name, email, mobile
 * phone, preferred call format. No re-validation of Discovery answers
 * belongs here.
 */

const NAME_MAX_LENGTH = 120;
const PHONE_MAX_LENGTH = 32;

function stripMarkupAndControlChars(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

/**
 * Digits, spaces, and the punctuation a real phone number can contain
 * (+, -, (, ), .) -- rejects anything else without inventing a country
 * format assumption the instruction explicitly forbids (section 20).
 */
const PHONE_ALLOWED_CHARS = /^[0-9+\-()\s.]+$/;
const PHONE_MIN_DIGITS = 7;

export const consultationContactSchema = z.object({
  guardianName: z
    .string()
    .transform(stripMarkupAndControlChars)
    .pipe(z.string().min(1, "Please enter your name.").max(NAME_MAX_LENGTH, "That name is too long.")),
  email: z
    .string()
    .transform((v) => stripMarkupAndControlChars(v).toLowerCase())
    .pipe(z.email("Please enter a valid email address.")),
  mobilePhone: z
    .string()
    .transform(stripMarkupAndControlChars)
    .pipe(
      z
        .string()
        .min(1, "Please enter a phone number.")
        .max(PHONE_MAX_LENGTH, "That phone number is too long.")
        .refine((v) => PHONE_ALLOWED_CHARS.test(v), "Please enter a valid phone number.")
        .refine(
          (v) => v.replace(/\D/g, "").length >= PHONE_MIN_DIGITS,
          "Please enter a valid phone number.",
        ),
    ),
  preferredCallFormat: z.enum(CALL_FORMAT_VALUES).default(DEFAULT_CALL_FORMAT),
  consentAcknowledged: z
    .literal("true", { message: "Please confirm you agree to be contacted." })
    .transform(() => true as const),
});

export type ConsultationContactInput = z.infer<typeof consultationContactSchema>;

export interface ConsultationContactFieldError {
  field: "guardianName" | "email" | "mobilePhone" | "preferredCallFormat" | "consentAcknowledged" | "form";
  message: string;
}

export function parseConsultationContactForm(
  formData: FormData,
): { ok: true; data: ConsultationContactInput } | { ok: false; errors: ConsultationContactFieldError[] } {
  const raw = {
    guardianName: formData.get("guardianName"),
    email: formData.get("email"),
    mobilePhone: formData.get("mobilePhone"),
    preferredCallFormat: formData.get("preferredCallFormat") || DEFAULT_CALL_FORMAT,
    consentAcknowledged: formData.get("consentAcknowledged"),
  };
  const result = consultationContactSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const errors: ConsultationContactFieldError[] = result.error.issues.map((issue) => ({
    field: (issue.path[0] as ConsultationContactFieldError["field"] | undefined) ?? "form",
    message: issue.message,
  }));
  return { ok: false, errors };
}
