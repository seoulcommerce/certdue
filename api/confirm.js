const { liveKeys, json, setSession, stripeGet, nid } = require("../lib-util");
const { getDb, saveDb } = require("../lib-store");

module.exports = async function handler(req, res) {
  const { live, secret } = liveKeys();
  if (!live) {
    json(res, 503, { error: "stripe_not_live" });
    return;
  }
  const sid = String((req.query && req.query.session_id) || "").trim();
  if (!sid.startsWith("cs_")) {
    json(res, 400, { error: "need session_id" });
    return;
  }
  const { ok, data } = await stripeGet(secret, "/checkout/sessions/" + encodeURIComponent(sid) + "?expand[]=subscription");
  if (!ok) {
    json(res, 502, { error: "session_lookup_failed" });
    return;
  }
  const status = (data.subscription && data.subscription.status) || data.status || "";
  const paid = status === "active" || status === "trialing" || data.payment_status === "paid";
  if (!paid) {
    json(res, 402, { error: "not_paid", status });
    return;
  }
  const email = (data.customer_details && data.customer_details.email) || data.customer_email || (data.metadata && data.metadata.email) || "";
  const firmName = (data.metadata && data.metadata.firm) || email;
  const db = await getDb();
  let firm = Object.values(db.firms).find((f) => f.sessionId === sid);
  if (!firm) {
    firm = Object.values(db.firms).find((f) => email && f.email === email);
  }
  if (!firm) {
    const id = nid("f");
    firm = {
      id,
      email,
      name: firmName,
      stripeCustomerId: data.customer || "",
      stripeSubId: typeof data.subscription === "string" ? data.subscription : (data.subscription && data.subscription.id) || "",
      sessionId: sid,
      created: Date.now()
    };
    db.firms[id] = firm;
    await saveDb(db);
  }
  setSession(res, firm.id);
  res.statusCode = 302;
  res.setHeader("location", "/app.html");
  res.end();
};
