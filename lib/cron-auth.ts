import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined) {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const providedBuffer = Buffer.from(provided);
  const secretBuffer = Buffer.from(secret);

  return (
    providedBuffer.length === secretBuffer.length &&
    timingSafeEqual(providedBuffer, secretBuffer)
  );
}
