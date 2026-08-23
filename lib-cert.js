const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

function ymd(s) {
  if (!s) return "";
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(expiry) {
  const e = ymd(expiry);
  if (!e) return null;
  const a = Date.parse(todayYmd() + "T00:00:00Z");
  const b = Date.parse(e + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

function checklist(cert) {
  const state = String((cert && cert.state) || "").toUpperCase();
  const signed = !!(cert && (cert.signed === true || cert.signed === "true" || cert.signed === "1" || cert.signed === "on"));
  const dated = ymd(cert && cert.dated);
  const expiry = ymd(cert && cert.expiry);
  const hasPdf = !!(cert && (cert.pdf || cert.hasPdf));
  const missing = [];
  if (!US_STATES.includes(state)) missing.push("state");
  if (!signed) missing.push("signed");
  if (!dated) missing.push("dated");
  if (!expiry) missing.push("expiry");
  if (!hasPdf) missing.push("pdf");
  const expired = !!(expiry && expiry < todayYmd());
  if (expired) missing.push("unexpired");
  return {
    state: US_STATES.includes(state) ? state : "",
    signed,
    dated,
    expiry,
    hasPdf,
    expired,
    complete: missing.length === 0,
    missing,
    days: daysUntil(expiry)
  };
}

function windowLabel(days) {
  if (days === null) return "";
  if (days < 0) return "expired";
  if (days <= 7) return "7";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "";
}

function csvEscape(s) {
  const t = s == null ? "" : String(s);
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

function packetCsv(rows) {
  const head = ["client_name", "client_email", "state", "signed", "dated", "expiry", "has_pdf", "complete", "missing", "days"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.client_name),
      csvEscape(r.client_email),
      csvEscape(r.state),
      r.signed ? "yes" : "no",
      csvEscape(r.dated),
      csvEscape(r.expiry),
      r.hasPdf ? "yes" : "no",
      r.complete ? "yes" : "no",
      csvEscape((r.missing || []).join("|")),
      r.days == null ? "" : String(r.days)
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n >>> 0, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const crc = crc32(data);
    const local = Buffer.concat([
      Buffer.from("PK\u0003\u0004", "latin1"),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0),
      name, data
    ]);
    const central = Buffer.concat([
      Buffer.from("PK\u0001\u0002", "latin1"),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), name
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.concat([
    Buffer.from("PK\u0005\u0006", "latin1"),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0)
  ]);
  return Buffer.concat(locals.concat([centralBuf, end]));
}

function safeName(s) {
  return String(s || "file").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60);
}

module.exports = {
  US_STATES, ymd, todayYmd, daysUntil, checklist, windowLabel,
  packetCsv, zipStore, safeName
};
