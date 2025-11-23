// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"]; // tumhara private key
const TARGET_API = "https://api.postalpincode.in/pincode/"; // original API
const CACHE_TIME = 3600 * 1000; // 1 hour
// =================================================

const cache = new Map();

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { pincode: rawPin, key: rawKey } = req.query || {};

  if (!rawPin || !rawKey) {
    return res
      .status(400)
      .json({ error: "missing parameters: pincode or key" });
  }

  const pincode = String(rawPin).replace(/\D/g, "");
  const key = String(rawKey).trim();

  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  if (pincode.length !== 6) {
    return res.status(400).json({ error: "invalid pincode" });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(pincode);
  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  const url = `${TARGET_API}${encodeURIComponent(pincode)}`;

  try {
    const upstream = await fetch(url);
    const raw = await upstream.text();

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        details: `HTTP ${upstream.status}`,
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: "invalid JSON from upstream",
        raw_sample: raw.slice(0, 200),
      });
    }

    // Thoda clean + branding
    const payload = {
      status: true,
      pincode,
      original_status: data[0]?.Status || null,
      message: data[0]?.Message || null,
      post_offices: data[0]?.PostOffice || [],
      developer: "splexxo",
      credit_by: "splexx",
      powered_by: "splexxo-pincode-api",
    };

    const responseBody = JSON.stringify(payload);

    cache.set(pincode, {
      timestamp: Date.now(),
      response: responseBody,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    return res.status(200).send(responseBody);
  } catch (err) {
    return res.status(502).json({
      error: "upstream request error",
      details: err.message || "unknown error",
    });
  }
}
