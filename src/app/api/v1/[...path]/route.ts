import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { withState, storageMode } from "@/lib/store";
import { sessionValid } from "@/lib/auth";
import {
  ingest,
  review,
  updateRule,
  createRule,
  summary,
  profiles,
  HttpError,
  alertPatchSchema,
  audit,
} from "@/lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!sessionValid(req.cookies.get("mfs_session")?.value))
      throw new HttpError(401, "Sign in to continue");
    if (
      req.method !== "GET" &&
      req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin
    )
      throw new HttpError(403, "Cross-origin writes are not allowed");
    const { path } = await params;
    const [resource, id, action] = path;
    const method = req.method;
    let body: unknown;
    if (method !== "GET") {
      if (Number(req.headers.get("content-length") ?? 0) > 65536)
        throw new HttpError(413, "Request is too large");
      body = await req.json();
    }
    const result = await withState(method !== "GET", (s) => {
      if (resource === "workspace" && method === "GET")
        return {
          ...s,
          summary: summary(s),
          storage_mode: storageMode(),
          profiles: {
            users: profiles(s, "users"),
            devices: profiles(s, "devices"),
            recipients: profiles(s, "recipients"),
            agents: profiles(s, "agents"),
          },
        };
      if (resource === "transactions") {
        if (id === "analyze" && method === "POST") return ingest(s, body);
        if (method === "GET") {
          if (id) {
            const t = s.transactions.find(
              (x) => x.id === id || x.payload.transaction_id === id,
            );
            if (!t) throw new HttpError(404, "Transaction not found");
            return t;
          }
          return s.transactions.slice().reverse();
        }
      }
      if (resource === "rules") {
        if (method === "GET") return s.rules;
        if (method === "PATCH" && id) return updateRule(s, id, body);
        if (method === "POST" && !id) return createRule(s, body);
      }
      if (resource === "cases" || resource === "alerts") {
        if (method === "GET") {
          const list = s.cases.map((c) => ({
            ...c,
            transaction: s.transactions.find((t) => t.id === c.transaction_id),
          }));
          if (id) {
            const c = list.find((x) => x.id === id);
            if (!c) throw new HttpError(404, "Case not found");
            return c;
          }
          return list.reverse();
        }
        if (
          method === "POST" &&
          id &&
          action === "review" &&
          resource === "cases"
        )
          return review(s, id, body);
        if (method === "PATCH" && id && resource === "alerts") {
          const { status } = alertPatchSchema.parse(body);
          const c = s.cases.find((x) => x.id === id);
          if (!c) throw new HttpError(404, "Alert not found");
          const before = c.status;
          c.status = status;
          c.actions.push({
            action: "STATUS_CHANGED",
            note: `${before} to ${status}`,
            actor: "analyst",
            timestamp: new Date().toISOString(),
          });
          audit(s, "ALERT_STATUS_CHANGED", id, { before, status });
          return c;
        }
      }
      if (resource === "dashboard" && method === "GET") {
        const data = summary(s);
        if (id === "risk-distribution") return data.risk_distribution;
        if (id === "recent-alerts") return s.cases.slice(-5).reverse();
        return data;
      }
      if (
        ["users", "devices", "recipients", "agents"].includes(resource) &&
        method === "GET"
      ) {
        const kind = resource as "users" | "devices" | "recipients" | "agents";
        const data = profiles(s, kind);
        if (id) {
          const profile = data.find((x) => x.id === id);
          if (!profile) throw new HttpError(404, "Profile not found");
          const field =
            kind === "users"
              ? "user_id"
              : kind === "devices"
                ? "device_id"
                : kind === "agents"
                  ? "agent_id"
                  : "receiver_id";
          return {
            ...profile,
            transactions: s.transactions.filter((t) => t.payload[field] === id),
          };
        }
        return data;
      }
      if (resource === "audit" && method === "GET")
        return s.audit.slice().reverse();
      throw new HttpError(404, "Endpoint not found");
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        { error: "Validation failed", issues: e.issues },
        { status: 422 },
      );
    if (e instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(
      "API request failed",
      e instanceof Error ? e.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "Storage or server configuration unavailable. Check database migration and environment variables.",
      },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
