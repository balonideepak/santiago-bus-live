# Santiago Bus Live

A small dynamic website for checking live Red Movilidad bus arrivals in Santiago, Chile.

## Run it

```bash
node server.js
```

Then open:

```text
http://localhost:4173
```

## Use it

Enter a Santiago paradero code such as `PA433`, then press Enter. The site shows:

- stop name
- prediction date and time
- bus route
- destination
- next one or two arrival estimates
- distance and bus plate when Red provides them

Use the route filter when you only care about one bus, for example `506v`.

## Use it on iPhone

### Option 1: Same Wi-Fi, from your Mac

Keep the server running on your Mac:

```bash
node server.js
```

Find your Mac's Wi-Fi IP address:

```bash
ipconfig getifaddr en0
```

On your iPhone, connect to the same Wi-Fi network and open this URL in Safari:

```text
http://YOUR_MAC_IP:4173
```

For example:

```text
http://192.168.1.23:4173
```

Then tap **Share** > **Add to Home Screen**.

This only works while your Mac is awake, the server is running, and your iPhone is on the same network.

### Option 2: Public deployment

Deploy the folder to a Node-capable host such as Render, Railway, Fly.io, or a VPS. The website needs the Node server because the browser UI calls `/api/arrivals`, and the server talks to Red Movilidad's predictor service.

After deployment, open the public HTTPS URL on your iPhone and tap **Share** > **Add to Home Screen**.

#### Render free deployment

This folder includes `package.json` and `render.yaml`, so Render knows how to start the app.

1. Create a GitHub repository.
2. Upload these files to the repository root.
3. Open Render and choose **New** > **Web Service**.
4. Connect your GitHub repository.
5. Use these settings:

- Runtime: `Node`
- Build command: leave empty
- Start command: `npm start`
- Instance type: `Free`

After Render finishes deploying, open the Render URL on your iPhone in Safari and use **Share** > **Add to Home Screen**.

## Data Source

The server fetches the public Red Movilidad "Cuándo llega" page, extracts the predictor token used by that page, and calls Red's predictor endpoint from the server. This keeps the browser UI simple and avoids hardcoding a stale token.

If Red's predictor service is unavailable or a stop code is invalid, the website shows a clear error message.
