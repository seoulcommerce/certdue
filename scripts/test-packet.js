const fs = require("fs");
const path = require("path");
const { checklist, packetCsv, zipStore } = require("../lib-cert");

const samplePdf = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

const good = checklist({
  state: "CA",
  signed: true,
  dated: "2026-01-15",
  expiry: "2027-01-15",
  hasPdf: true
});
if (!good.complete) {
  console.error("FAIL expected complete", good);
  process.exit(1);
}

const bad = checklist({ state: "CA", signed: false, dated: "", expiry: "2020-01-01", hasPdf: false });
if (bad.complete || !bad.missing.includes("signed") || !bad.missing.includes("unexpired")) {
  console.error("FAIL expected gaps", bad);
  process.exit(1);
}

const csv = packetCsv([{
  client_name: "Sample Client LLC",
  client_email: "books@example.com",
  state: "CA",
  signed: true,
  dated: "2026-01-15",
  expiry: "2027-01-15",
  hasPdf: true,
  complete: true,
  missing: [],
  days: 140
}]);
if (!csv.includes("Sample Client LLC") || !csv.includes("complete")) {
  console.error("FAIL csv", csv);
  process.exit(1);
}

const zip = zipStore([
  { name: "packet.csv", data: Buffer.from(csv) },
  { name: "certs/sample-CA.pdf", data: samplePdf }
]);
if (zip.slice(0, 2).toString("latin1") !== "PK") {
  console.error("FAIL not zip");
  process.exit(1);
}
const out = path.join(__dirname, "..", "test-packet.zip");
fs.writeFileSync(out, zip);
console.log("OK", out, "bytes=" + zip.length, "complete=" + good.complete, "missing=" + bad.missing.join("|"));
