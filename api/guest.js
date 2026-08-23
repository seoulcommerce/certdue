const { json } = require("../lib-util");
const { getDb } = require("../lib-store");

module.exports = async function handler(req, res) {
  const token = String((req.query && req.query.token) || "").trim();
  if (!token) {
    json(res, 400, { error: "need token" });
    return;
  }
  const db = await getDb();
  const link = db.links[token];
  if (!link) {
    json(res, 404, { error: "bad_link" });
    return;
  }
  const client = db.clients[link.clientId];
  const firm = db.firms[link.firmId];
  if (!client || !firm) {
    json(res, 404, { error: "gone" });
    return;
  }
  json(res, 200, { token, client: client.name, firm: firm.name });
};
