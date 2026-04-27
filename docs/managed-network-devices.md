# Managed Network Devices

## Design intent

This feature separates LAN visibility from alert responsibility.

The operator-facing model is:

1. Let the Cerbo observe hosts on the same Teltonika LAN.
2. Store those hosts as discovered inventory.
3. Show discovered hosts automatically in each trailer dashboard detail view.
4. Promote only mission-critical hosts into managed targets.
5. Send alerts only on confirmed managed-target status transitions.

That keeps the interface legible under pressure and aligns with usability guidance around:

- progressive disclosure for complex operational data
- visibility of system status
- minimalist presentation where noncritical information does not compete with urgent information

## Website pieces added

- Managed-device schema:
  - [00000000000011_managed_network_devices.sql](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/supabase/migrations/00000000000011_managed_network_devices.sql)
- Admin workflow:
  - [ManagedNetworkPanel.tsx](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/app/admin/ManagedNetworkPanel.tsx)
  - [AdminLeftPanel.tsx](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/app/admin/AdminLeftPanel.tsx)
- User dashboard panel:
  - [ManagedNetworkDevicesPanel.tsx](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/components/dashboard/ManagedNetworkDevicesPanel.tsx)
- API routes:
  - [managed-network GET route](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/app/api/devices/[siteId]/managed-network/route.ts)
  - [Cerbo ingest route](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/app/api/cerbo/network-scan/route.ts)
- Cerbo reporter script:
  - [report-managed-lan.sh](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/scripts/cerbo-gx/report-managed-lan.sh)

## Verified platform facts used

- Venus OS supports persistent custom startup hooks on `/data/rc.local` and `/data/rcS.local`.
- Venus OS custom code should live on `/data` so it survives upgrades.
- Venus OS Large is the supported Cerbo path for built-in Node-RED and Signal K workflows.

Sources:

- [Victron root access and startup hooks](https://www.victronenergy.com/live/ccgx%3Aroot_access)
- [Victron Venus OS Large manual](https://www.victronenergy.com/live/venus-os%3Alarge)

## Cerbo reporting model

The Cerbo does not need the cameras or Teltonika to be directly attached to it. It only needs to be an IP host on the same Teltonika LAN/broadcast domain as the devices being observed.

What this can do:

- observe/probe devices on the Cerbo's directly connected LAN subnet
- report every host the Cerbo scan script can identify
- report online/offline status for promoted managed targets

What this cannot guarantee:

- discovery across separate VLANs or routed-only networks unless the Cerbo has a valid route and probing is allowed
- complete visibility of devices that block ARP/ICMP or sleep between scans
- Teltonika DHCP lease visibility without using Teltonika APIs

The Cerbo script expects:

- a config file at `/data/conf/managed-network-monitor.conf`
- no target list for automatic `/24` LAN discovery
- an optional target list at `/data/conf/managed-network-targets.txt` only when `SCAN_MODE=targets`

### Example config

```sh
SITE_URL="https://www.nomadxe.com"
CERBO_INGEST_TOKEN="replace-with-your-secret"
VRM_SITE_ID="123456"
SCAN_MODE="auto"
# Optional. If omitted, the script detects the default IPv4 LAN CIDR.
# Automatic scanning intentionally supports /24 networks only.
SCAN_CIDR="192.168.1.0/24"
MAX_PARALLEL="32"
```

### Optional targets file

```txt
# One IP per line. Comments allowed.
192.168.1.20
192.168.1.30
192.168.1.40
```

### Manual execution

```sh
chmod +x /data/report-managed-lan.sh
/data/report-managed-lan.sh
```

The script:

- loads the configured trailer site ID
- scans the Cerbo's `/24` LAN automatically by default
- pings each target only when `SCAN_MODE=targets`
- sends a compact JSON payload to `/api/cerbo/network-scan`
- includes latency when the local ping output exposes it cleanly
- includes MAC addresses from the Cerbo ARP table when available

The website ingest route now accepts both use cases:

- known managed IPs update alertable target status
- unpromoted IPs are stored as discovered inventory and appear in the dashboard device details
- full automatic scans mark previously observed missing hosts as offline

It self-checks for:

- `ping`
- `date`
- `ip`
- `awk`
- either `curl` or `wget`

## Alert behavior

The ingest route only sends an alert when:

- `online -> offline`, or
- `offline -> online`

It does not alert on:

- `unknown -> offline`
- `unknown -> online`

That avoids false urgency during first-time setup or after long gaps in reporting.

Optional environment variable for alerts:

- `MAKE_NETWORK_ALERT_WEBHOOK_URL`

Required environment variable for Cerbo authentication:

- `CERBO_INGEST_TOKEN`

## Suggested operator flow

1. Register the trailer in the existing admin console.
2. Install the Cerbo reporter on the trailer.
3. Let the first automatic LAN scan populate observed inventory.
4. Open that trailer tile in the dashboard to view discovered hosts.
5. Promote only devices that should alert.
6. Validate manual post success.
7. Turn on scheduled execution on the Cerbo.

## UX rationale

The UI is structured around three layers:

1. Summary:
   Counts for online, offline, and unknown targets.
2. Exception scanning:
   Offline devices are visually loud; healthy ones are quiet.
3. Detail on demand:
   Operators can open full target lists only when they need them.

This follows guidance from:

- NN/g on visibility of system status and aesthetic/minimalist design
- NN/g examples of progressive disclosure to reduce cognitive overload
- Atlassian and Material patterns for compact status indicators and tabular operational data

Sources:

- [NN/g usability heuristics summary](https://media.nngroup.com/media/articles/attachments/NNg_Jakob%27s_Usability_Heuristic_Summary.pdf)
- [NN/g application design showcase discussing progressive disclosure in dashboards](https://media.nngroup.com/media/reports/free/Application_Design_Showcase_1st_edition.pdf)
- [Atlassian design components overview](https://atlassian.design/components/)
- [Material data tables guidance](https://m1.material.io/components/data-tables.html)
