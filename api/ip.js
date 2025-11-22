// ==================== CONFIG =====================
const YOUR_API_KEYS = ["SPLEXXO"]; // tumhara private key
const TARGET_API = "https://ip-info.hosters.club/"; // original IP API
const CACHE_TIME = 3600 * 1000; // 1 hour (ms)
// =================================================

const cache = new Map();

// 🔹 Deep cleaner: remove https://t.me/DrSudo from JSON values
function cleanDrSudo(value) {
  if (typeof value === "string") {
    // Link + naam dono hata dega agar kahin mix ho
    return value.replace(/https?:\/\/t\.me\/DrSudo/gi, "").replace(/DrSudo/gi, "").trim();
  }

  if (Array.isArray(value)) {
    return value.map(cleanDrSudo);
  }

  if (value && typeof value === "object") {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = cleanDrSudo(value[key]);
    }
    return cleaned;
  }

  return value;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Sirf GET allow
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { ip: rawIP, key: rawKey } = req.query || {};

  // Param check
  if (!rawIP || !rawKey) {
    return res.status(400).json({ error: "missing parameters: ip or key" });
  }

  const ip = String(rawIP).trim();
  const key = String(rawKey).trim();

  // API key check
  if (!YOUR_API_KEYS.includes(key)) {
    return res.status(403).json({ error: "invalid key" });
  }

  // Cache check
  const now = Date.now();
  const cached = cache.get(ip);

  if (cached && now - cached.timestamp < CACHE_TIME) {
    res.setHeader("X-Proxy-Cache", "HIT");
    return res.status(200).send(cached.response);
  }

  // Upstream URL build
  const url = `${TARGET_API}?ip=${encodeURIComponent(ip)}`;

  try {
    const upstream = await fetch(url);
    const rawText = await upstream.text();

    if (!upstream.ok || !rawText) {
      return res.status(502).json({
        error: "upstream API failed",
        details: `HTTP ${upstream.status}`,
      });
    }

    let finalResponse;

    try {
      // JSON parse
      let data = JSON.parse(rawText);

      // 🔥 Poore JSON se https://t.me/DrSudo hatao
      data = cleanDrSudo(data);

      // 🔥 Sirf tumhara credit add karo
      data.developer = "splexxo";
      data.credit_by = "splexx";
      data.powered_by = "splexxo IP Info API";

      finalResponse = JSON.stringify(data);
    } catch (e) {
      // Agar upstream JSON proper nahi hai, raw text me bhi clean kar do
      const cleanedText = rawText
        .replace(/https?:\/\/t\.me\/DrSudo/gi, "")
        .replace(/DrSudo/gi, "")
        .trim();

      finalResponse = cleanedText;
    }

    // Cache save
    cache.set(ip, {
      timestamp: Date.now(),
      response: finalResponse,
    });

    res.setHeader("X-Proxy-Cache", "MISS");
    return res.status(200).send(finalResponse);
  } catch (err) {
    return res.status(502).json({
      error: "upstream request error",
      details: err.message || "unknown error",
    });
  }
};
