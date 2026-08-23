const { json, readBody, parseSession, nid } = require("../lib-util");
const { getDb, saveDb } = require("../lib-store");

module.exports = async function handler(req, res) {
  const sess = parseSession(req);
  if (!sess) {
    json(res, 401, { error: "sign_in" });
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "POST only" });
    return;
  }
  const body = readBody(req);
  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 200);
  if (!name) {
    json(res, 400, { error: "Need a client name" });
    return;
  }
  const db = await getDb();
  if (!db.firms[sess.firmId]) {
    json(res, 401, { error: "no_firm" });
    return;
  }
  const id = nid("c");
  const token = nid("l");
  db.clients[id] = { id, firmId: sess.firmId, name, email, created: Date.now() };
  db.links[token] = { token, firmId: sess.firmId, clientId: id, created: Date.now() };
  await saveDb(db);
  json(res, 200, { client: db.clients[id], token });
};
