const { json } = require("../lib-util");

module.exports = async function handler(req, res) {
  json(res, 503, { error: "certdue_killed", detail: "Checkout is off. No $129 charges." });
};
