const fs = require("fs");
const path = require("path");

const DB_PATH = "certdue-db.json";
const TMP = path.join("/tmp", "certdue-db.json");

function emptyDb() {
  return { firms: {}, clients: {}, certs: {}, links: {}, alerts: [], mailed: {} };
}

function blobEnvNames() {
  return Object.keys(process.env).filter((k) => /blob/i.test(k) || k === "VERCEL_OIDC_TOKEN").sort();
}

function hasBlob() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) return true;
  if (process.env.BLOB_STORE_ID) return true;
  return false;
}

function storageKind() {
  return hasBlob() ? "blob" : "memory";
}

function blobSdk() {
  return require("@vercel/blob");
}

async function blobPut(pathname, body, contentType) {
  const { put } = blobSdk();
  return put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentType || "application/octet-stream"
  });
}

async function blobGet(pathname) {
  const { list, get } = blobSdk();
  const listed = await list({ prefix: pathname, limit: 10 });
  const blobs = (listed && listed.blobs) || [];
  const hit = blobs.find((b) => b.pathname === pathname) || blobs[0];
  if (!hit) return null;
  const res = await get(hit.url || pathname, { access: "private" });
  if (!res) return null;
  if (res.stream) {
    const chunks = [];
    for await (const c of res.stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    return Buffer.concat(chunks);
  }
  if (res.blob) return Buffer.from(await res.blob.arrayBuffer());
  return null;
}

function readTmp() {
  try {
    return JSON.parse(fs.readFileSync(TMP, "utf8"));
  } catch {
    return emptyDb();
  }
}

function writeTmp(db) {
  fs.writeFileSync(TMP, JSON.stringify(db));
}

async function getDb() {
  if (!hasBlob()) return readTmp();
  try {
    const buf = await blobGet(DB_PATH);
    if (!buf) return emptyDb();
    return JSON.parse(buf.toString("utf8"));
  } catch (e) {
    console.log("certdue_db_read", e && e.message);
    return emptyDb();
  }
}

async function saveDb(db) {
  if (!hasBlob()) {
    writeTmp(db);
    return;
  }
  await blobPut(DB_PATH, Buffer.from(JSON.stringify(db)), "application/json");
}

async function putPdf(certId, buf) {
  const name = "certs/" + certId + ".pdf";
  if (!hasBlob()) {
    const p = path.join("/tmp", name.replace("/", "-"));
    fs.writeFileSync(p, buf);
    return { kind: "memory", path: p, url: "" };
  }
  const data = await blobPut(name, buf, "application/pdf");
  return { kind: "blob", path: name, url: (data && data.url) || "" };
}

async function getPdf(rec) {
  if (!rec) return null;
  if (rec.kind === "memory" && rec.path) {
    try { return fs.readFileSync(rec.path); } catch { return null; }
  }
  if (rec.url && hasBlob()) {
    try {
      const { get } = blobSdk();
      const res = await get(rec.url, { access: "private" });
      if (res && res.stream) {
        const chunks = [];
        for await (const c of res.stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
        return Buffer.concat(chunks);
      }
    } catch (e) {
      console.log("certdue_pdf_get", e && e.message);
    }
  }
  if (rec.path && hasBlob()) return blobGet(rec.path);
  return null;
}

module.exports = { emptyDb, storageKind, blobEnvNames, getDb, saveDb, putPdf, getPdf };
