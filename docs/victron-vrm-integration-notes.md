# Victron VRM Integration Notes

## What was added to the website

The customer dashboard now uses a two-tier VRM integration:

1. A lightweight fleet snapshot for every assigned trailer:
   - battery SOC, voltage, current, power
   - solar power, solar voltage, yield today
   - DC load estimate
   - recent sparkline data
   - online or offline status

2. A richer per-trailer intelligence panel for opened cards:
   - GPS location snapshot with map deep link
   - KML, CSV, and XLSX exports proxied through the website
   - installation inventory from `system-overview`
   - status, battery, solar, and historic summary widgets
   - configured alarm coverage and notification recipients
   - 24 hour graph series for solar, battery SOC, and DC load
   - forecast series when VRM returns forecast data
   - rolled-up solar yield and consumption windows for today, week, month, and year

## Why the architecture is split

The VRM API rate limits requests. Pulling every widget and report for every trailer on page load would create unnecessary burst traffic and make larger fleets fragile.

The app now keeps:

- fleet polling fast and cheap
- richer API fan-out only for the trailer cards a customer actually opens

## Best customer-facing VRM features for solar security trailer rentals

### Highest value on the website

- Live battery reserve:
  Customers want immediate confidence that the trailer can keep cameras, radios, and lights running.

- Solar harvest and load coverage:
  The most useful operational question is not just "is solar producing" but "is solar covering the active trailer load."

- Telemetry freshness:
  "Last seen" is crucial for rentals because a dead modem, moved trailer, or wiring issue can look like a power problem.

- Location visibility:
  GPS is useful for trailer relocation verification, dispatch, theft deterrence, and confirming that a rental was deployed where expected.

- Historical performance windows:
  Today, week, and month summaries help customers see whether a trailer is operating sustainably over time, not just in the current moment.

- Downloadable reports:
  CSV and XLSX exports help customers attach energy history to job-site reports, incident reviews, and service tickets.

- Alarm coverage:
  Even when the alarms endpoint is primarily configuration-oriented, showing whether alarm rules and recipients exist gives customers confidence that guardrails are in place.

### Strong admin or ops features

- System inventory and firmware visibility
- Detailed alarm authoring and recipient management
- Site sharing and user-rights management
- GPS track download for relocation audits
- Data downloads for long-range reporting

## Official VRM API endpoints used or mapped

### Used directly in the site

- `/installations/{idSite}/diagnostics`
- `/installations/{idSite}/stats`
- `/installations/{idSite}/widgets/GPS`
- `/installations/{idSite}/widgets/Graph`
- `/installations/{idSite}/widgets/Status`
- `/installations/{idSite}/widgets/BatterySummary`
- `/installations/{idSite}/widgets/SolarChargerSummary`
- `/installations/{idSite}/widgets/HistoricData`
- `/installations/{idSite}/system-overview`
- `/installations/{idSite}/alarms`
- `/installations/{idSite}/overallstats`
- `/installations/{idSite}/data-download`
- `/installations/{idSite}/gps-download`

### Mapped for future extensions

- state widgets such as inverter, charger, generator, VE.Bus, and warning graphs
- `custom-widget`
- `settings`
- `dynamic-ess-settings`
- installation tags and favorites
- site users, invites, rights, and group linking

## Business-specific ideas for NomadXE

- Fleet confidence score:
  Combine SOC, solar coverage, telemetry freshness, and alarm coverage into a single rental-health indicator.

- Trailer deployment verification:
  Use GPS plus telemetry freshness to show that a rented trailer is active at the expected site.

- Runtime exception feed:
  Highlight low battery reserve, stale telemetry, MPPT faults, and poor solar coverage before they become downtime.

- Customer report center:
  Offer one-click "last 7 days" and "last 30 days" power exports alongside GPS track downloads for project closeout or billing support.
