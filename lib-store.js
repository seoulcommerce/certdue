const fs = require("fs");
const path = require("path");

const DB_PATH = "certdue-db.json";
const TMP = path.join("/tmp", "certdue-db.json");

function emptyDb() {
  return { firms: {}, clients: {}, certs: {}, links: {}, alerts: [], mailed: {} };
}

function blobEnvNames() {
  return Object.keys(process.env).filter((k) => /blob/i.test(k) || /READ_WRITE_TOKEN$/i.test(k)).sort();
}

function blobToken() {
  const direct = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || "";
  if (direct) return direct;
  for (const k of blobEnvNames()) {
    const v = process.env[k];
    if (v && /READ_WRITE_TOKEN/i.test(k)) return v;
  }
  return "";
}

function storageKind() {
  return blobToken() ? "blob" : "memory";
}

async function blobPut(pathname, body, contentType) {
  const token = blobToken();
  const r = await fetch("https://blob.vercel-storage.com/" + pathname, {
    method: "PUT",
    headers: {
      authorization: "Bearer " + token,
      "x-api-version": "7",
      "x-content-type": contentType || "application/octet-stream",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "true"
    },
    body
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) {
    const err = new Error("blob_put_failed");
    err.detail = data;
    err.status = r.status;
    throw err;
  }
  return data;
}

async function blobGet(pathname) {
  const token = blobToken();
  const listed = await fetch("https://blob.vercel-storage.com?prefix=" + encodeURIComponent(pathname) + "&limit=10", {
    headers: { authorization: "Bearer " + token, "x-api-version": "7" }
  });
  const info = await listed.json();
  const blobs = (info && info.blobs) || [];
  const hit = blobs.find((b) => b.pathname === pathname) || blobs[0];
  if (!hit || !hit.url) return null;
  const r = await fetch(hit.url, {
    headers: { authorization: "Bearer " + token }
  });
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
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
  if (!blobToken()) return readTmp();
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
  if (!blobToken()) {
    writeTmp(db);
    return;
  }
  await blobPut(DB_PATH, Buffer.from(JSON.stringify(db)), "application/json");
}

async function putPdf(certId, buf) {
  const name = "certs/" + certId + ".pdf";
  if (!blobToken()) {
    const p = path.join("/tmp", name.replace("/", "-"));
    fs.writeFileSync(p, buf);
    return { kind: "memory", path: p, url: "" };
  }
  const data = await blobPut(name, buf, "application/pdf");
  return { kind: "blob", path: name, url: data.url || "" };
}

async function getPdf(rec) {
  if (!rec) return null;
  if (rec.kind === "memory" && rec.path) {
    try { return fs.readFileSync(rec.path); } catch { return null; }
  }
  if (rec.url) {
    const r = await fetch(rec.url, {
      headers: blobToken() ? { authorization: "Bearer " + blobToken() } : {}
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  }
  if (rec.path && blobToken()) return blobGet(rec.path);
  return null;
}

module.exports = { emptyDb, storageKind, blobEnvNames, getDb, saveDb, putPdf, getPdf };
