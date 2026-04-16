import { timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function decodeBasicAuthorization(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "basic") {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function isAdminAuthEnabled() {
  return Boolean(config.ADMIN_AUTH_USERNAME && config.ADMIN_AUTH_PASSWORD);
}

export function matchesBasicAuthorizationHeader(
  authorizationHeader: string | undefined,
  expectedUsername: string,
  expectedPassword: string,
) {
  const credentials = decodeBasicAuthorization(authorizationHeader);
  if (!credentials) {
    return false;
  }

  return safeEqual(credentials.username, expectedUsername)
    && safeEqual(credentials.password, expectedPassword);
}

export function isValidAdminAuthorizationHeader(authorizationHeader: string | undefined) {
  if (!isAdminAuthEnabled()) {
    return true;
  }

  if (!config.ADMIN_AUTH_USERNAME || !config.ADMIN_AUTH_PASSWORD) {
    return false;
  }

  return matchesBasicAuthorizationHeader(
    authorizationHeader,
    config.ADMIN_AUTH_USERNAME,
    config.ADMIN_AUTH_PASSWORD,
  );
}

export function issueAdminAuthChallenge(reply: FastifyReply) {
  reply.header("www-authenticate", 'Basic realm="relaynew.ai admin", charset="UTF-8"');
  return reply.status(401).send({
    statusCode: 401,
    error: "Unauthorized",
    message: "Admin authentication required",
  });
}

export async function requireAdminAuthorization(request: FastifyRequest, reply: FastifyReply) {
  if (isValidAdminAuthorizationHeader(request.headers.authorization)) {
    return;
  }

  return issueAdminAuthChallenge(reply);
}
