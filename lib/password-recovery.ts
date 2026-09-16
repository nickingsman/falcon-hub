export const passwordRecoveryCookieName = "falcon-hub:password-recovery";
export const passwordRecoveryMaxAgeSeconds = 15 * 60;
export const minimumPasswordLength = 8;

export const passwordRecoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
