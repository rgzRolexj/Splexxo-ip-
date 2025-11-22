// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"];
const TARGET_API = "https://ipwho.is/"; // NEW backend
const CACHE_TIME = 3600 * 1000;
// =================================================

const cache = new Map();

// Remove DrSudo link from JSON (deep clean, safety)
function cleanDrSudo(value) {
  if (typeof value === "string") {
    return value
      .replace(/https?:\/\/t\.me\/DrSudo/gi, "")
      .replace(/DrSudo/gi, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(cleanDrSudo);
  }
  if (value && typeof value === "object") {
    const c = {};
    for (const key of Object.keys(value)) {
      c[key] = cleanDrSudo(value[key]);
    }
    return c;
  }
  return value;
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { ip: rawIP, key: rawKey } = req.query || {};

  if (!rawIP || !rawKey) {
    return res.status(400).json({ error: "missing ip or key" });
  }

  const ip = String(rawIP).trim();
  const key = String(rawKey).trim();

  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  const now = Date.now();
  const cached = cache.get(ip);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  // ipwho.is format -> https://ipwho.is/8.8.8.8
  const url = `${TARGET_API}${encodeURIComponent(ip)}`;

  try {
    const upstream = await fetch(url);
    const raw = await upstream.text();

    if (!upstream.ok || !raw) {
      return res.status(502).json({
        error: "upstream API failed",
        details: `HTTP ${upstream.status}`,
      });
    }

    let finalResponse;

    try {
      let data = JSON.parse(raw);

      // ipwho.is failure flag
      if (data && data.success === false) {
        return res.status(400).json({
          error: "invalid ip or lookup failed",
          reason: data.message || null,
        });
      }

      // Clean any DrSudo (safety)
      data = cleanDrSudo(data);

      // Add your branding
      data.developer = "splexxo";
      data.credit_by = "splexx";
      data.powered_by = "splexxo-ip-api";

      finalResponse = JSON.stringify(data);
    } catch (e) {
      finalResponse = raw
        .replace(/https?:\/\/t\.me\/DrSudo/gi, "")
        .replace(/DrSudo/gi, "")
        .trim();
    }

    cache.set(ip, {
      timestamp: Date.now(),
      response: finalResponse,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    return res.status(200).send(finalResponse);
  } catch (err) {
    return res.status(502).json({
      error: "upstream request error",
      details: err.message,
    });
  }
};
