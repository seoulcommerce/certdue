const crypto = require("crypto");

const AMOUNT = 12900;
const CURRENCY = "usd";
const INTERVAL = "month";
const COOKIE = "certdue";

function liveKeys() {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  return {
    live: secret.startsWith("sk_live_") && publishable.startsWith("pk_live_"),
    secret,
    publishable
  };
}

function publicOrigin(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return proto + "://" + host;
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === "object" ? body : {};
}

function nid(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function cookieSecret() {
  return process.env.STRIPE_SECRET_KEY || process.env.SESSION_SECRET || "certdue-dev";
}

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", cookieSecret()).update(data).digest("base64url");
  return data + "." + sig;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return "";
}

function parseSession(req) {
  const tok = readCookie(req, COOKIE);
  if (!tok || !tok.includes(".")) return null;
  const i = tok.lastIndexOf(".");
  const data = tok.slice(0, i);
  const sig = tok.slice(i + 1);
  const expect = crypto.createHmac("sha256", cookieSecret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!obj || !obj.firmId) return null;
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

function setSession(res, firmId) {
  const tok = signSession({ firmId, exp: Date.now() + 30 * 24 * 3600 * 1000 });
  res.setHeader("set-cookie", COOKIE + "=" + tok + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000");
}

async function stripeForm(secret, path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

async function stripeGet(secret, path) {
  const r = await fetch("https://api.stripe.com/v1" + path, {
    headers: { authorization: "Bearer " + secret }
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

module.exports = {
  AMOUNT, CURRENCY, INTERVAL, COOKIE,
  liveKeys, publicOrigin, json, readBody, nid,
  parseSession, setSession, stripeForm, stripeGet
};
