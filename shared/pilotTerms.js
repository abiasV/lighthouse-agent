export const PILOT_TERMS_VERSION = "2026-09-24-v2";
export const DEFAULT_SUPPORT_EMAIL = "vaziria.cv@gmail.com";

export function publicLegalConfig(env = {}) {
  const email = env.LIGHTHOUSE_SUPPORT_EMAIL === undefined ? DEFAULT_SUPPORT_EMAIL
    : typeof env.LIGHTHOUSE_SUPPORT_EMAIL === "string" ? env.LIGHTHOUSE_SUPPORT_EMAIL.trim() : "";
  return { termsVersion: PILOT_TERMS_VERSION,
    supportEmail: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email) ? email : null };
}
