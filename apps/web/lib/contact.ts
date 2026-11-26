import { z } from "zod";

const instagram = /^@[a-z\d._]{1,30}$/i;
const phone = /^\+?\d(?:[ -]*\d)*$/;
const phoneNumber = /^(?:08\d{7,11}|628\d{7,11}|\+[1-9]\d{7,14})$/;

export const contactError = "Enter an Instagram username starting with @ or a WhatsApp number.";

export const contactSchema = z.string().trim().max(48, contactError).refine((value) => (
  value === "" || instagram.test(value) || (phone.test(value) && phoneNumber.test(value.replace(/[ -]/g, "")))
), contactError);

export function contactLabel(value: string) {
  return value.startsWith("@") ? "Instagram" : "WhatsApp";
}
