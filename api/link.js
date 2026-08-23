const { json, parseSession, nid } = require("../lib-util");
const { getDb, saveDb } = require("../lib-store");

module.exports = async function handler(req, res) {
  const sess = parseSession(req);
  if (!sess) {
    json(res, 401, { error: "sign_in" });
    return;
  }
  const clientId = String((req.query && req.query.clientId) || (req.body && req.body.clientId) || "").trim();
  const db = await getDb();
  const client = db.clients[clientId];
  if (!client || client.firmId !== sess.firmId) {
    json(res, 404, { error: "no_client" });
    return;
  }
  const token = nid("l");
  db.links[token] = { token, firmId: sess.firmId, clientId, created: Date.now() };
  await saveDb(db);
  json(res, 200, { token, clientId });
};
