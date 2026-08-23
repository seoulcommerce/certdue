const { AMOUNT, CURRENCY, INTERVAL, liveKeys, json } = require("../lib-util");
const { storageKind } = require("../lib-store");

module.exports = async function handler(req, res) {
  const { live } = liveKeys();
  json(res, 200, {
    product: "certdue",
    live,
    amount: AMOUNT,
    currency: CURRENCY,
    interval: INTERVAL,
    storage: storageKind()
  });
};
