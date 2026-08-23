const { json, readBody, parseSession, nid } = require("../lib-util");
const { getDb, saveDb, putPdf } = require("../lib-store");
const { checklist, US_STATES } = require("../lib-cert");

function decodePdf(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const i = s.indexOf("base64,");
  if (i >= 0) s = s.slice(i + 7);
  const buf = Buffer.from(s, "base64");
  if (buf.length < 5) return null;
  if (buf.slice(0, 5).toString("latin1") !== "%PDF-") return null;
  if (buf.length > 4.2 * 1024 * 1024) return null;
  return buf;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "POST only" });
    return;
  }
  const body = readBody(req);
  const db = await getDb();
  let firmId = "";
  let clientId = "";
  const token = String(body.token || "").trim();
  if (token) {
    const link = db.links[token];
    if (!link) {
      json(res, 404, { error: "bad_link" });
      return;
    }
    firmId = link.firmId;
    clientId = link.clientId;
  } else {
    const sess = parseSession(req);
    if (!sess) {
      json(res, 401, { error: "sign_in" });
      return;
    }
    firmId = sess.firmId;
    clientId = String(body.clientId || "").trim();
  }
  const client = db.clients[clientId];
  if (!client || client.firmId !== firmId) {
    json(res, 404, { error: "no_client" });
    return;
  }
  const state = String(body.state || "").toUpperCase().trim();
  if (state && !US_STATES.includes(state)) {
    json(res, 400, { error: "Need a US state" });
    return;
  }
  const pdf = decodePdf(body.pdf);
  let stored = null;
  const id = nid("x");
  if (pdf) {
    stored = await putPdf(id, pdf);
  }
  const rec = {
    id,
    firmId,
    clientId,
    state,
    signed: !!(body.signed === true || body.signed === "true" || body.signed === "1" || body.signed === "on"),
    dated: String(body.dated || "").slice(0, 10),
    expiry: String(body.expiry || "").slice(0, 10),
    pdf: stored,
    created: Date.now()
  };
  db.certs[id] = rec;
  await saveDb(db);
  json(res, 200, { cert: rec, check: checklist({ ...rec, hasPdf: !!stored }) });
};
