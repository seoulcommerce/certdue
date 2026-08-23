const { AMOUNT, CURRENCY, INTERVAL, json } = require("../lib-util");

module.exports = async function handler(req, res) {
  json(res, 200, {
    product: "certdue",
    live: false,
    killed: true,
    amount: AMOUNT,
    currency: CURRENCY,
    interval: INTERVAL,
    storage: "off"
  });
};
