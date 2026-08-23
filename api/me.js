const { json, parseSession } = require("../lib-util");
const { getDb } = require("../lib-store");
const { checklist, windowLabel } = require("../lib-cert");

module.exports = async function handler(req, res) {
  const sess = parseSession(req);
  if (!sess) {
    json(res, 401, { error: "sign_in" });
    return;
  }
  const db = await getDb();
  const firm = db.firms[sess.firmId];
  if (!firm) {
    json(res, 401, { error: "no_firm" });
    return;
  }
  const clients = Object.values(db.clients).filter((c) => c.firmId === firm.id);
  const certs = Object.values(db.certs).filter((c) => c.firmId === firm.id).map((c) => {
    const ck = checklist({ ...c, hasPdf: !!(c.pdf && (c.pdf.url || c.pdf.path)) });
    const client = db.clients[c.clientId] || {};
    return {
      id: c.id,
      clientId: c.clientId,
      client_name: client.name || "",
      client_email: client.email || "",
      state: ck.state,
      signed: ck.signed,
      dated: ck.dated,
      expiry: ck.expiry,
      hasPdf: ck.hasPdf,
      complete: ck.complete,
      missing: ck.missing,
      days: ck.days,
      window: windowLabel(ck.days)
    };
  });
  const alerts = (db.alerts || []).filter((a) => a.firmId === firm.id).slice(-40).reverse();
  json(res, 200, {
    firm: { id: firm.id, name: firm.name, email: firm.email },
    clients,
    certs,
    alerts
  });
};
