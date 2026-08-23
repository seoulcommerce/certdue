const {
  AMOUNT, CURRENCY, INTERVAL, liveKeys, publicOrigin, json, readBody, stripeForm
} = require("../lib-util");

function clean(s, n) {
  return String(s || "").trim().slice(0, n);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "POST only" });
    return;
  }
  const { live, secret } = liveKeys();
  if (!live) {
    json(res, 503, { error: "stripe_not_live", detail: "Need sk_live_ and pk_live_ in Vercel env." });
    return;
  }
  const body = readBody(req);
  const email = clean(body.email, 200);
  const firm = clean(body.firm, 120);
  if (!email || !email.includes("@")) {
    json(res, 400, { error: "Need a firm email" });
    return;
  }
  if (!firm) {
    json(res, 400, { error: "Need a firm name" });
    return;
  }
  const origin = publicOrigin(req);
  if (!origin) {
    json(res, 500, { error: "missing_origin" });
    return;
  }
  const params = {
    mode: "subscription",
    customer_email: email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][unit_amount]": String(AMOUNT),
    "line_items[0][price_data][recurring][interval]": INTERVAL,
    "line_items[0][price_data][product_data][name]": "CertDue firm vault",
    success_url: origin + "/thanks.html?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/",
    "metadata[product]": "certdue",
    "metadata[firm]": firm,
    "metadata[email]": email,
    "subscription_data[metadata][product]": "certdue",
    "subscription_data[metadata][firm]": firm
  };
  const { ok, data } = await stripeForm(secret, "/checkout/sessions", params);
  if (!ok || !data.url) {
    console.log("certdue_checkout_fail", data && data.error);
    json(res, 502, { error: "checkout_failed" });
    return;
  }
  json(res, 200, { url: data.url });
};
