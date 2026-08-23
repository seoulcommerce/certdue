const { json } = require("../lib-util");
const { getDb, saveDb } = require("../lib-store");
const { checklist, windowLabel } = require("../lib-cert");

function cronOk(req) {
  if (req.headers["x-vercel-cron"] === "1") return true;
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;
  const q = (req.query && (req.query.secret || req.query.CRON_SECRET)) || "";
  const auth = String(req.headers.authorization || "");
  return q === secret || auth === "Bearer " + secret;
}

async function mailFirm(email, subject, text) {
  if (!email || !email.includes("@")) return { sent: false, via: "none" };
  try {
    const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(email), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        message: text,
        _template: "box"
      })
    });
    return { sent: r.ok, via: "formsubmit", status: r.status };
  } catch (e) {
    return { sent: false, via: "formsubmit", error: e.message };
  }
}

module.exports = async function handler(req, res) {
  if (!cronOk(req)) {
    json(res, 401, { error: "cron" });
    return;
  }
  const db = await getDb();
  const now = Date.now();
  const byFirm = {};
  for (const c of Object.values(db.certs)) {
    const ck = checklist({ ...c, hasPdf: !!(c.pdf && (c.pdf.url || c.pdf.path)) });
    const win = windowLabel(ck.days);
    if (!win) continue;
    const key = c.id + ":" + win;
    if (db.mailed && db.mailed[key]) continue;
    const firm = db.firms[c.firmId];
    const client = db.clients[c.clientId] || {};
    if (!firm) continue;
    if (!byFirm[firm.id]) byFirm[firm.id] = { firm, items: [], keys: [] };
    byFirm[firm.id].items.push({
      client: client.name || client.email || c.clientId,
      state: ck.state || "—",
      expiry: ck.expiry || "",
      window: win,
      days: ck.days,
      missing: ck.missing
    });
    byFirm[firm.id].keys.push(key);
  }
  const sent = [];
  for (const pack of Object.values(byFirm)) {
    const lines = pack.items.map((it) => {
      if (it.window === "expired") return "- " + it.client + " / " + it.state + " expired " + it.expiry;
      return "- " + it.client + " / " + it.state + " expires " + it.expiry + " (" + it.window + " day window, " + it.days + " days)";
    });
    const subject = "CertDue: " + pack.items.length + " certificate(s) need attention";
    const text = "These client certs are missing fields or will expire.\nThis is not a legal opinion.\n\n" + lines.join("\n");
    const mail = await mailFirm(pack.firm.email, subject, text);
    db.alerts.push({
      id: "a" + now + pack.firm.id,
      firmId: pack.firm.id,
      at: now,
      subject,
      text,
      mail
    });
    if (!db.mailed) db.mailed = {};
    for (const k of pack.keys) db.mailed[k] = now;
    sent.push({ firm: pack.firm.email, count: pack.items.length, mail });
  }
  await saveDb(db);
  json(res, 200, { ok: true, firms: sent.length, sent });
};
