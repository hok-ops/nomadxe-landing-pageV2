# Teltonika RMS Gateway

This project now includes a one-click modem WebUI gateway at:

`/access/device/:id`

The route creates a Teltonika RMS Remote HTTP session and redirects the user to
the returned WebUI URL.

## Required environment variables

- `TELTONIKA_RMS_API_TOKEN`
- `TELTONIKA_GATEWAY_BEARER_TOKEN`

## How to get the `device_id`

The `:id` parameter is the Teltonika RMS device ID, not the Victron site ID.

You can retrieve it from the RMS API by calling `GET /devices` and reading the
device `id` field, then store it in:

`public.vrm_devices.teltonika_rms_device_id`

This project includes a migration that adds that column.

## Frontend anchor example

If the user is already signed into the NomadXE dashboard and assigned to the
device, a normal anchor works because the route also accepts the current app
session:

```html
<a href="/access/device/123456" target="_blank" rel="noopener noreferrer">
  Open Modem WebUI
</a>
```

## Programmatic bearer example

For server-to-server or scripted use, send:

```http
Authorization: Bearer YOUR_TELTONIKA_GATEWAY_BEARER_TOKEN
```

to the same route.
