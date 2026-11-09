import type { FastifyRequest } from "fastify";
import { ensure } from "../../core/errors.js";
export function validateRequest(
  request: FastifyRequest,
  base: string,
  token?: string,
  upstreamBase?: string,
  allowOpaquePreview = false,
) {
  const urls = [base, ...(upstreamBase ? [upstreamBase] : [])].map(
    (value) => new URL(value),
  );
  ensure(
    urls.some((url) => request.headers.host === url.host),
    "invalid_host",
    "Host is not allowed",
    403,
  );
  ensure(
    !request.headers.origin ||
      urls.some((url) => request.headers.origin === url.origin) ||
      (allowOpaquePreview && request.headers.origin === "null"),
    "invalid_origin",
    "Origin is not allowed",
    403,
  );
  if (token)
    ensure(
      request.headers.authorization === `Bearer ${token}`,
      "unauthorized",
      "Open the review URL from your AI client to authenticate",
      401,
    );
}
