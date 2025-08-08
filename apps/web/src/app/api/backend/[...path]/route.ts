import { NextRequest } from "next/server";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

async function proxy(req: NextRequest, params: { path?: string[] }) {
  const segments = params.path || [];
  const suffix = segments.join("/");
  const url = new URL(req.url);
  const search = url.search ? url.search : url.searchParams.toString() ? `?${url.searchParams.toString()}` : "";
  const target = `${API_BASE}/${suffix}${search}`.replace(/\/+$/, "");

  // 过滤掉不可转发的头
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    redirect: "manual",
  };

  const resp = await fetch(target, init);
  const respHeaders = new Headers(resp.headers);
  // 去除 hop-by-hop 头
  respHeaders.delete("transfer-encoding");
  respHeaders.delete("content-encoding");

  const body = await resp.arrayBuffer();
  return new Response(body, { status: resp.status, headers: respHeaders });
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, params);
}


