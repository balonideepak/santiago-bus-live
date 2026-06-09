const form = document.querySelector("#search-form");
const stopInput = document.querySelector("#stop-input");
const routeFilter = document.querySelector("#route-filter");
const refreshButton = document.querySelector("#refresh-button");
const results = document.querySelector("#results");
const message = document.querySelector("#message");
const template = document.querySelector("#route-template");
const stopTitle = document.querySelector("#stop-title");
const updatedAt = document.querySelector("#updated-at");
const routeCount = document.querySelector("#route-count");

let currentData = null;

function normalizeStop(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function setMessage(text, visible = true) {
  message.textContent = text;
  message.classList.toggle("hidden", !visible);
}

function setLoading(isLoading) {
  form.querySelector("button").disabled = isLoading;
  refreshButton.disabled = isLoading;
  form.querySelector("button span").textContent = isLoading ? "…" : "↵";
}

function formatUpdated(data) {
  if (!data.prediction.date && !data.prediction.time) return "Unknown";
  return [data.prediction.date, data.prediction.time].filter(Boolean).join(" at ");
}

function arrivalLine(arrival) {
  const item = document.createElement("div");
  item.className = "arrival";

  const left = document.createElement("div");
  const time = document.createElement("strong");
  const meta = document.createElement("span");
  time.textContent = arrival.time || "No time";
  meta.textContent = [arrival.distance && arrival.distance.label, arrival.plate && `Bus ${arrival.plate}`]
    .filter(Boolean)
    .join(" · ");

  const right = document.createElement("span");
  right.textContent = `#${arrival.busNumber}`;

  left.append(time, meta);
  item.append(left, right);
  return item;
}

function render(data) {
  currentData = data;
  const filter = routeFilter.value.trim().toLowerCase();
  const services = data.services.filter((service) => service.route.toLowerCase().includes(filter));

  stopTitle.textContent = `${data.stop.code} · ${data.stop.name || "Unknown stop"}`;
  updatedAt.textContent = formatUpdated(data);
  routeCount.textContent = String(services.length);
  results.innerHTML = "";

  if (!services.length) {
    setMessage("No routes match that filter.", true);
    return;
  }

  setMessage("", false);

  for (const service of services) {
    const card = template.content.firstElementChild.cloneNode(true);
    const badge = card.querySelector(".route-badge");
    const title = card.querySelector("h2");
    const destination = card.querySelector(".route-head p");
    const arrivalList = card.querySelector(".arrival-list");
    const serviceMessage = card.querySelector(".service-message");

    badge.textContent = service.route;
    badge.style.background = service.color || "#cf152d";
    title.textContent = `Route ${service.route}`;
    destination.textContent = service.destination ? `To ${service.destination}` : "Destination unavailable";
    serviceMessage.textContent = service.message || "No service message.";

    if (service.arrivals.length) {
      service.arrivals.forEach((arrival) => arrivalList.append(arrivalLine(arrival)));
    } else {
      const empty = document.createElement("div");
      empty.className = "arrival";
      empty.innerHTML = "<div><strong>No live bus time</strong><span>Check the service message below.</span></div>";
      arrivalList.append(empty);
    }

    results.append(card);
  }
}

async function loadArrivals(stop) {
  const stopCode = normalizeStop(stop);
  if (!stopCode) {
    setMessage("Enter a paradero code like PA433.");
    return;
  }

  stopInput.value = stopCode;
  setLoading(true);
  setMessage("Checking Red Movilidad live arrivals...");

  try {
    const response = await fetch(`/api/arrivals?stop=${encodeURIComponent(stopCode)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load arrivals.");
    }

    render(data);
  } catch (error) {
    results.innerHTML = "";
    routeCount.textContent = "0";
    setMessage(`${error.message} Try again, or verify the stop code on red.cl.`);
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadArrivals(stopInput.value);
});

routeFilter.addEventListener("input", () => {
  if (currentData) render(currentData);
});

refreshButton.addEventListener("click", () => {
  loadArrivals(stopInput.value);
});

loadArrivals(stopInput.value);
