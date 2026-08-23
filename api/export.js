const { json, parseSession } = require("../lib-util");
const { getDb, getPdf } = require("../lib-store");
const { checklist, packetCsv, zipStore, safeName } = require("../lib-cert");

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
  const files = [];
  const rows = [];
  for (const c of Object.values(db.certs).filter((x) => x.firmId === firm.id)) {
    const client = db.clients[c.clientId] || {};
    const ck = checklist({ ...c, hasPdf: !!(c.pdf && (c.pdf.url || c.pdf.path)) });
    rows.push({
      client_name: client.name || "",
      client_email: client.email || "",
      ...ck
    });
    if (c.pdf) {
      const buf = await getPdf(c.pdf);
      if (buf) {
        files.push({
          name: "certs/" + safeName(client.name || "client") + "-" + (ck.state || "xx") + "-" + c.id + ".pdf",
          data: buf
        });
      }
    }
  }
  const csv = packetCsv(rows);
  files.unshift({ name: "packet.csv", data: Buffer.from(csv, "utf8") });
  const zip = zipStore(files);
  res.statusCode = 200;
  res.setHeader("content-type", "application/zip");
  res.setHeader("content-disposition", 'attachment; filename="certdue-packet.zip"');
  res.end(zip);
};
