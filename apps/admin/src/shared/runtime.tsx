import { clsx } from "clsx";
import { type ProbeCompatibilityMode } from "@relaynews/shared";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

export { clsx, createPortal, Link, Navigate, NavLink, Route, Routes, useEffect, useLocation, useMemo, useNavigate, useParams, useSearchParams, useState };

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";
export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4173";
export const ADMIN_AUTH_STORAGE_KEY = "relaynews.admin.basic-auth";
export const ADMIN_AUTH_REQUIRED_EVENT = "relaynews.admin.auth-required";
export const PROBE_COMPATIBILITY_OPTIONS: Array<{ value: ProbeCompatibilityMode; label: string }> = [
  { value: "auto", label: "自动识别" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-chat-completions", label: "OpenAI Chat Completions" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-gemini-generate-content", label: "Google Gemini Generate Content" },
];

export type ApiErrorPayload = {
  message?: string | string[];
};

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
  }
}

export function readStoredAdminAuthorization() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
}

export function writeStoredAdminAuthorization(value: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, value);
    return;
  }

  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

export function buildBasicAuthorization(username: string, password: string) {
  return `Basic ${window.btoa(`${username}:${password}`)}`;
}

export function dispatchAdminAuthRequired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT));
}

export function formatApiErrorPayload(payload: ApiErrorPayload | null) {
  if (!payload?.message) {
    return null;
  }

  return Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  options: {
    authHeader?: string | null;
    skipStoredAuth?: boolean;
    suppressUnauthorizedEvent?: boolean;
  } = {},
): Promise<T> {
  const headers = new Headers(init?.headers);
  const authorization = options.skipStoredAuth
    ? options.authHeader
    : options.authHeader ?? readStoredAdminAuthorization();

  if (typeof init?.body !== "undefined" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (authorization && !headers.has("authorization")) {
    headers.set("authorization", authorization);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && !options.suppressUnauthorizedEvent) {
      dispatchAdminAuthRequired();
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiErrorPayload;
      throw new ApiRequestError(
        formatApiErrorPayload(payload) ?? `Request failed with ${response.status}`,
        response.status,
      );
    }

    const text = await response.text();
    throw new ApiRequestError(text || `Request failed with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}
