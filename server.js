const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const RED_BASE = "https://www.red.cl";
const PAGE_URL = `${RED_BASE}/planifica-tu-viaje/cuando-llega/`;
const PREDICTOR_URL = `${RED_BASE}/predictorPlus/prediccion`;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

function normalizeStopCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function extractEncodedJwt(html) {
  const match = html.match(/\$jwt\s*=\s*'([^']+)'/);
  if (!match) return null;
  return match[1];
}

function decodeBase64(value) {
  return Buffer.from(value, "base64").toString("utf8");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "santiago-bus-live/1.0",
      Accept: "text/html,application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Red responded with HTTP ${response.status}`);
  }

  return response.text();
}

async function getCurrentJwt(stopCode) {
  const html = await fetchText(`${PAGE_URL}?codsimt=${encodeURIComponent(stopCode)}`);
  const encoded = extractEncodedJwt(html);

  if (!encoded) {
    throw new Error("Could not find Red predictor token on the stop page.");
  }

  return decodeBase64(encoded);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeDistance(meters) {
  const numeric = Number(meters);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return {
    meters: numeric,
    label: numeric >= 1000 ? `${(numeric / 1000).toFixed(1)} km` : `${Math.round(numeric)} m`,
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildArrival(service, busNumber) {
  const time = cleanText(service[`horaprediccionbus${busNumber}`]);
  const plate = cleanText(service[`ppubus${busNumber}`]);
  const distance = normalizeDistance(service[`distanciabus${busNumber}`]);

  if (!time && !plate && !distance) return null;

  return {
    busNumber,
    time,
    plate,
    distance,
  };
}

function normalizePredictor(raw, stopCode) {
  const services = asArray(raw.servicios && raw.servicios.item).map((service) => {
    const arrivals = [buildArrival(service, 1), buildArrival(service, 2)].filter(Boolean);
    const message = cleanText(service.respuestaServicio);

    return {
      route: cleanText(service.servicio),
      destination: cleanText(service.destino),
      statusCode: cleanText(service.codigorespuesta),
      message,
      color: cleanText(service.color) || "#cf152d",
      itinerary: Boolean(service.itinerario),
      arrivals,
      hasLiveTimes: arrivals.length > 0,
    };
  });

  return {
    stop: {
      code: cleanText(raw.paradero) || stopCode,
      name: cleanText(raw.nomett),
      response: cleanText(raw.respuestaParadero),
      x: cleanText(raw.x),
      y: cleanText(raw.y),
    },
    prediction: {
      date: cleanText(raw.fechaprediccion),
      time: cleanText(raw.horaprediccion),
    },
    services,
    raw,
  };
}

async function getArrivals(stopCode) {
  const jwt = await getCurrentJwt(stopCode);
  const url = new URL(PREDICTOR_URL);
  url.searchParams.set("t", jwt);
  url.searchParams.set("codsimt", stopCode);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "santiago-bus-live/1.0",
      Accept: "application/json",
      Referer: `${PAGE_URL}?codsimt=${encodeURIComponent(stopCode)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Red predictor responded with HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.nomett == null) {
    const hint = data && data.respuestaParadero ? data.respuestaParadero : "Stop not found.";
    throw new Error(hint);
  }

  return normalizePredictor(data, stopCode);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  sendFile(res, filePath);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/arrivals") {
    const stopCode = normalizeStopCode(url.searchParams.get("stop"));

    if (!/^P[A-Z][0-9]{1,5}$/.test(stopCode)) {
      sendJson(res, 400, {
        error: "Enter a valid Santiago paradero code, for example PA433.",
      });
      return;
    }

    try {
      sendJson(res, 200, await getArrivals(stopCode));
    } catch (error) {
      sendJson(res, 502, {
        error: error.message,
        source: "Red Movilidad predictor",
      });
    }
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Santiago Bus Live running at http://localhost:${PORT}`);
});
