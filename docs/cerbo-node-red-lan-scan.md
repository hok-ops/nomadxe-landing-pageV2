# Cerbo GX LAN Inventory Using Node-RED

This runbook configures one Cerbo GX at a time to scan its local trailer LAN and post discovered devices into the NomadXE dashboard using Node-RED.

Use this when:

- You can open the Cerbo's Node-RED editor remotely.
- You cannot reach the Cerbo with `ssh` and `scp` from your workstation.
- You want the Cerbo itself, not the Teltonika API, to observe LAN devices.

Use the batch deployment runbook instead when SSH/SCP is reachable: [cerbo-batch-lan-scan-deployment.md](./cerbo-batch-lan-scan-deployment.md).

## What This Flow Does

The flow runs locally on the Cerbo:

1. Runs every 15 minutes, plus manual trigger.
2. Scans the configured `/24` LAN from the Cerbo.
3. Uses ping to trigger ARP resolution.
4. Treats a device as online when ping succeeds or a complete ARP entry appears in `/proc/net/arp`.
5. Posts the discovered devices to:

```txt
https://www.nomadxe.com/api/cerbo/network-scan
```

The dashboard then shows those devices inside the matching trailer tile by VRM site ID.

## Verified Platform Facts

- Victron Venus OS Large includes Node-RED and Signal K for compatible GX devices including Cerbo GX.
- Victron documents Node-RED as browser-accessible locally and remotely through VRM.
- Victron documents Node-RED on Venus OS Large using HTTPS port `1881`.
- Node-RED includes an `exec` node that can run local system commands and return stdout, stderr, and return code.

Sources:

- [Victron Venus OS Large image](https://www.victronenergy.com/live/venus-os%3Alarge)
- [Victron Cerbo GX access methods](https://www.victronenergy.com/media/pg/Cerbo-S_GX/en/accessing-the-gx-device.html)
- [Node-RED exec node documentation](https://flowfuse.com/node-red/core-nodes/exec/)

## Why Not Signal K

Signal K is the marine/NMEA data hub. It is useful for GPS, vessel data, and NMEA integrations. It is not the best control surface for LAN scanning, shell execution, or HTTP posting.

Use Node-RED for this feature because it provides scheduling, command execution, payload shaping, and HTTP requests in one visible flow.

## Prerequisites

For each Cerbo:

- Venus OS Large installed.
- Node-RED enabled.
- Node-RED editor reachable through local access or VRM.
- Cerbo is on the same Teltonika LAN as the devices it should observe.
- NomadXE production has `CERBO_INGEST_TOKEN` configured in Vercel.
- You know the trailer's VRM site ID from the NomadXE dashboard/admin page.

Security note:

The currently implemented backend uses one shared fleet ingest token. This Node-RED flow stores that token inside a function node. Protect Node-RED access and do not share screenshots that reveal the token.

## Step 1: Enable Node-RED

On the Cerbo Remote Console:

1. Open `Settings`.
2. Open `Firmware`.
3. Open `Online updates`.
4. Confirm `Image type` is `Large`.
5. Open `Settings -> Integrations -> Venus OS Large Features`.
6. Enable `Node-RED`.

Open Node-RED:

```txt
https://<cerbo-lan-ip>:1881/
```

The browser may show a certificate warning because Venus OS uses a self-signed certificate.

## Step 2: Create The Flow Canvas

In Node-RED:

1. Create a new tab named `NomadXE LAN Inventory`.
2. Add an `inject` node.
3. Add a `function` node named `CONFIG - EDIT PER CERBO`.
4. Add a `function` node named `Build ARP scan command`.
5. Add an `exec` node named `Run LAN scan`.
6. Add a `function` node named `Build NomadXE POST`.
7. Add an `http request` node named `POST to NomadXE`.
8. Add a `debug` node named `NomadXE response`.
9. Add two optional debug nodes named `scan stderr` and `scan return code`.

Wire the nodes:

```txt
inject -> CONFIG -> Build ARP scan command -> exec stdout -> Build NomadXE POST -> http request -> response debug
                                                    exec stderr -> scan stderr debug
                                                    exec rc     -> scan return code debug
```

## Step 3: Configure The Inject Node

Double-click the `inject` node:

- Name: `Every 15 min + manual`
- Repeat: `interval`
- Every: `15 minutes`
- Inject once after deploy: optional, leave off during setup
- Payload: timestamp is fine

Click `Done`.

## Step 4: Configure The Cerbo-Specific Values

Paste this code into `CONFIG - EDIT PER CERBO`.

Replace:

- `PASTE_VRM_SITE_ID_HERE`
- `PASTE_CERBO_INGEST_TOKEN_HERE`
- `192.168.1.0/24` only if the trailer LAN is different.

```javascript
msg.nomadxe = {
    siteUrl: "https://www.nomadxe.com",
    vrmSiteId: "PASTE_VRM_SITE_ID_HERE",
    ingestToken: "PASTE_CERBO_INGEST_TOKEN_HERE",
    scanCidr: "192.168.1.0/24",
    maxParallel: 24,
    pingTimeout: 1
};

if (!msg.nomadxe.vrmSiteId || msg.nomadxe.vrmSiteId.includes("PASTE_")) {
    node.error("VRM site ID is not configured", msg);
    return null;
}

if (!msg.nomadxe.ingestToken || msg.nomadxe.ingestToken.includes("PASTE_")) {
    node.error("CERBO_INGEST_TOKEN is not configured", msg);
    return null;
}

return msg;
```

Click `Done`.

## Step 5: Build The ARP Scan Command

Paste this code into `Build ARP scan command`.

This function builds a shell command and passes it safely to `/bin/sh -c`. It supports `/24` networks only by design.

```javascript
const cfg = msg.nomadxe;
const cidr = String(cfg.scanCidr || "192.168.1.0/24").trim();
const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}\/24$/);

if (!match) {
    node.error("Only /24 IPv4 scans are supported. Example: 192.168.1.0/24", msg);
    return null;
}

const octets = match.slice(1, 4).map(Number);
if (octets.some((octet) => octet < 0 || octet > 255)) {
    node.error("Invalid IPv4 network: " + cidr, msg);
    return null;
}

const base = octets.join(".");
const maxParallel = Math.max(1, Math.min(64, Number(cfg.maxParallel) || 24));
const pingTimeout = Math.max(1, Math.min(5, Number(cfg.pingTimeout) || 1));

function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

const script = [
    "PATH=/usr/sbin:/usr/bin:/sbin:/bin",
    "BASE=" + shellQuote(base),
    "MAX_PARALLEL=" + shellQuote(maxParallel),
    "PING_TIMEOUT=" + shellQuote(pingTimeout),
    "tmp=\"/tmp/nomadxe-lan-scan.$$\"",
    "mkdir -p \"$tmp\"",
    "trap 'rm -rf \"$tmp\"' EXIT HUP INT TERM",
    "lookup_mac(){ awk -v ip_addr=\"$1\" '$1 == ip_addr && $3 == \"0x2\" && $4 != \"00:00:00:00:00:00\" { print $4; exit }' /proc/net/arp 2>/dev/null; }",
    "emit_online(){ ip=\"$1\"; lat=\"$2\"; detail=\"$3\"; mac=\"$(lookup_mac \"$ip\")\"; printf '{\"ipAddress\":\"%s\",\"status\":\"online\"' \"$ip\"; [ -n \"$mac\" ] && printf ',\"macAddress\":\"%s\"' \"$mac\"; [ -n \"$lat\" ] && printf ',\"latencyMs\":%s' \"$lat\"; printf ',\"detail\":\"%s\"}\\n' \"$detail\"; }",
    "probe(){ ip=\"$1\"; n=\"$2\"; out=\"$tmp/$n.out\"; err=\"$tmp/$n.err\"; if ping -c 1 -W \"$PING_TIMEOUT\" \"$ip\" >\"$out\" 2>\"$err\"; then lat=$(sed -n 's/.*time[=<]\\([0-9.]*\\).*/\\1/p' \"$out\" | tail -n 1); emit_online \"$ip\" \"$lat\" \"ping ok\"; else mac=\"$(lookup_mac \"$ip\")\"; [ -n \"$mac\" ] && emit_online \"$ip\" \"\" \"arp observed\"; fi; }",
    "i=1",
    "running=0",
    "while [ \"$i\" -le 254 ]; do ip=\"$BASE.$i\"; probe \"$ip\" \"$i\" >\"$tmp/$i.json\" & running=$((running+1)); if [ \"$running\" -ge \"$MAX_PARALLEL\" ]; then wait; running=0; fi; i=$((i+1)); done",
    "wait",
    "first=1",
    "printf '{\"devices\":['",
    "for f in \"$tmp\"/*.json; do [ -s \"$f\" ] || continue; [ \"$first\" -eq 0 ] && printf ','; cat \"$f\"; first=0; done",
    "printf ']}'"
].join("; ");

msg.payload = shellQuote(script);
return msg;
```

Click `Done`.

## Step 6: Configure The Exec Node

Double-click `Run LAN scan`.

Set:

- Command: `/bin/sh -c`
- Append `msg.payload`: enabled
- Use spawn: disabled
- Timeout: `120` seconds

Outputs:

- Output 1: stdout
- Output 2: stderr
- Output 3: return code

Click `Done`.

Why this works:

The previous function stores the shell script in `msg.payload` as one safely quoted argument. The exec node appends it after `/bin/sh -c`, so the Cerbo runs the generated command locally.

## Step 7: Build The NomadXE POST

Paste this code into `Build NomadXE POST`.

```javascript
let scan;

try {
    scan = JSON.parse(msg.payload);
} catch (error) {
    node.error("Scan command did not return JSON: " + error.message, msg);
    return null;
}

const cfg = msg.nomadxe;

msg.url = cfg.siteUrl.replace(/\/$/, "") + "/api/cerbo/network-scan";
msg.headers = {
    "Authorization": "Bearer " + cfg.ingestToken,
    "Content-Type": "application/json"
};

msg.payload = {
    vrmSiteId: cfg.vrmSiteId,
    observedAt: new Date().toISOString(),
    scanMode: "full",
    devices: Array.isArray(scan.devices) ? scan.devices : []
};

node.status({
    fill: "blue",
    shape: "dot",
    text: msg.payload.devices.length + " host(s) found"
});

return msg;
```

Click `Done`.

## Step 8: Configure The HTTP Request Node

Double-click `POST to NomadXE`.

Set:

- Method: `POST`
- URL: leave blank because `msg.url` is set by the function
- Return: parsed JSON object
- Authentication: none

Click `Done`.

## Step 9: Configure Debug Nodes

For `NomadXE response`:

- Output: complete `msg.payload`
- Show in sidebar: enabled
- Show status: enabled

For `scan stderr`:

- Output: complete `msg.payload`
- Show in sidebar: enabled

For `scan return code`:

- Output: complete `msg.payload`
- Show in sidebar: enabled

You can disable the debug nodes after rollout.

## Step 10: Deploy And Test

1. Click `Deploy`.
2. Open the debug sidebar.
3. Click the inject button on `Every 15 min + manual`.
4. Wait for the scan to finish.

Expected successful response:

```json
{
  "ok": true,
  "vrmSiteId": "799263",
  "discovered": 4,
  "updated": 0,
  "markedOffline": 0,
  "scanMode": "full",
  "ignored": []
}
```

`discovered` can be `0` if no devices responded to ping or ARP from the Cerbo.

## Step 11: Verify In NomadXE

1. Open the NomadXE dashboard.
2. Click the trailer tile for the same VRM site ID.
3. Open `LAN Device Inventory`.
4. Confirm the observed devices appear.
5. In admin, promote only devices that should alert when offline.

The dashboard detail panel refreshes while open.

## Troubleshooting

### `401 Unauthorized`

Cause:

- The token in Node-RED does not match Vercel `CERBO_INGEST_TOKEN`.
- Vercel production was not redeployed after the environment variable was added.

Fix:

- Confirm the Vercel token.
- Paste the exact same token into the config function.
- Redeploy Vercel if the env var was newly added.

### `404 Unknown vrmSiteId`

Cause:

- The Node-RED `vrmSiteId` does not match a registered trailer in NomadXE.

Fix:

- Copy the VRM site ID from the admin/dashboard source of truth.

### Scan Returns No Devices

Cause:

- Cerbo is not on the same LAN/broadcast domain as the devices.
- `scanCidr` is wrong.
- Devices are on a VLAN or routed network the Cerbo cannot directly ARP.
- Devices are silent during the scan.

Fix:

- Confirm the Cerbo IP, netmask, and gateway in Remote Console.
- Confirm cameras/NVR/router LAN devices are actually in the same subnet.
- Keep `scanCidr` aligned with the Cerbo LAN, usually `192.168.1.0/24`.

### Exec Node Times Out

Cause:

- The Cerbo is overloaded.
- The LAN is slow.
- `maxParallel` is too high.

Fix:

- Lower `maxParallel` to `12`.
- Increase exec timeout to `180` seconds.
- Keep the interval at 15 minutes or longer.

## Operator Guidance

- Start with one Cerbo.
- Confirm one successful POST.
- Confirm dashboard inventory appears.
- Repeat on the next Cerbo.
- Disable debug nodes after rollout.
- Treat the flow as secret-bearing because it stores the ingest token.
