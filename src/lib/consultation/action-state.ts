import { DEFAULT_CALL_FORMAT } from "./constants";

/**
 * Shared shape for the contact form's client-visible state (both the
 * real, server-action-wired form and the DB-free demo). Deliberately
 * NOT defined inside app/discover/consultation/actions.ts: a `"use
 * server"` file may only export async functions for a Client
 * Component to import -- a plain object/type export from that file
 * silently becomes `undefined` on the client bundle. This is a plain
 * module, safe to import from either server or client code.
 */
export interface ConsultationContactActionState {
  errors: Partial<
    Record<"guardianName" | "email" | "mobilePhone" | "preferredCallFormat" | "consentAcknowledged" | "form", string>
  >;
  values: {
    guardianName: string;
    email: string;
    mobilePhone: string;
    preferredCallFormat: string;
  };
}

export const initialConsultationContactActionState: ConsultationContactActionState = {
  errors: {},
  values: { guardianName: "", email: "", mobilePhone: "", preferredCallFormat: DEFAULT_CALL_FORMAT },
};
