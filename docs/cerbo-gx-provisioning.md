# Cerbo GX Provisioning Runbook

## What was verified

- `Venus OS Large` is the required image for Cerbo GX if you want the built-in Node-RED and Signal K services.
- Current public Victron code does **not** use `/Settings/VenusOsLarge/NodeRedEnabled` or `/Settings/VenusOsLarge/SignalKEnabled` for service control.
- Current public Victron code uses:
  - `com.victronenergy.settings /Settings/Services/NodeRed`
  - `com.victronenergy.settings /Settings/Services/SignalK`
- Current public Victron UI reads the proxied platform paths:
  - `com.victronenergy.platform /Services/NodeRed/Mode`
  - `com.victronenergy.platform /Services/SignalK/Enabled`
- Current public Victron code manages the daemons at:
  - `/service/node-red-venus`
  - `/service/signalk-server`
- Current public Victron packaging puts Node-RED under the `nodered` user with home `/data/home/nodered`; the provisioning script resolves both service homes dynamically from `/etc/passwd` instead of hard-coding them.

## Correction to the draft blueprint

The original draft is close in intent but outdated in two important places:

1. The DBus paths should target the current `Settings/Services/*` items, not `Settings/VenusOsLarge/*`.
2. Copying only `flows.json` is not enough if your Node-RED flows contain credentials.

For Node-RED, the safe export set is:

- Required: `flows.json`
- Required for credentialed flows: `flows_cred.json`
- Required if you rely on a custom credential secret or user overrides: `settings-user.js`
- Required if credentials were encrypted with a generated runtime key: `.config.runtime.json`

Signal K remains:

- Required: `settings.json`

## Files added in this repo

- [provision-venus-large.sh](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/scripts/cerbo-gx/provision-venus-large.sh)
- [export-golden.sh](/C:/Users/hlim/.gemini/antigravity/scratch/nomadxe-v2/scripts/cerbo-gx/export-golden.sh)

## Step 1: Verify the source Cerbo is truly the master

On the manually configured Cerbo:

1. Confirm it is on `Venus OS Large`.
2. Confirm Node-RED and Signal K both work from the browser.
3. If Node-RED flows use any usernames, passwords, API keys, or tokens, treat the Node-RED credential files as part of the golden bundle.

## Step 2: Export the golden bundle

Copy the helper to the source Cerbo and run it:

```bash
scp scripts/cerbo-gx/export-golden.sh root@<SOURCE_CERBO_IP>:/data/
ssh root@<SOURCE_CERBO_IP> "chmod +x /data/export-golden.sh && /data/export-golden.sh /data/cerbo-golden"
scp -r root@<SOURCE_CERBO_IP>:/data/cerbo-golden ./cerbo-golden
```

If you run from Windows PowerShell, keep the `scp` command on one line or use PowerShell line continuations instead of Bash `\`.

At minimum, keep these files from `./cerbo-golden`:

- `master_flows.json`
- `master_sk_settings.json`

Keep these too if they exist:

- `master_flows_cred.json`
- `master_nodered_settings_user.js`
- `master_nodered_config_runtime.json`

## Step 3: Push the payload to a fresh Cerbo GX

Copy the provisioning script and the exported payload to the target Cerbo:

```bash
scp \
  scripts/cerbo-gx/provision-venus-large.sh \
  ./cerbo-golden/master_flows.json \
  ./cerbo-golden/master_sk_settings.json \
  ./cerbo-golden/master_flows_cred.json \
  ./cerbo-golden/master_nodered_settings_user.js \
  ./cerbo-golden/master_nodered_config_runtime.json \
  root@<TARGET_CERBO_IP>:/data/
```

PowerShell users should either run that as a single line or replace the Bash `\` line continuations with PowerShell backticks.

Notes:

- `scp` will fail for optional files that do not exist. If you do not have them, remove those arguments.
- The script expects the payload in `/data` by default.

## Step 4: Run provisioning on the target Cerbo

Normal mode:

```bash
ssh root@<TARGET_CERBO_IP> "chmod +x /data/provision-venus-large.sh && NODE_RED_MODE=1 /data/provision-venus-large.sh"
```

Safe mode for first boot of untrusted flows:

```bash
ssh root@<TARGET_CERBO_IP> "chmod +x /data/provision-venus-large.sh && NODE_RED_MODE=2 /data/provision-venus-large.sh"
```

Mode values:

- `0` = disabled
- `1` = enabled
- `2` = enabled in safe mode

## Step 5: Validate after provisioning

Run these checks on the target Cerbo:

```bash
ssh root@<TARGET_CERBO_IP> "dbus -y com.victronenergy.platform /Services/NodeRed/Mode GetValue"
ssh root@<TARGET_CERBO_IP> "dbus -y com.victronenergy.platform /Services/SignalK/Enabled GetValue"
ssh root@<TARGET_CERBO_IP> "svstat /service/node-red-venus"
ssh root@<TARGET_CERBO_IP> "svstat /service/signalk-server"
```

Expected:

- Node-RED mode returns `1` or `2`
- Signal K enabled returns `1`
- Both services report `up`

Then validate functionally:

1. Open Node-RED from the Cerbo.
2. Open Signal K at `http://<TARGET_CERBO_IP>:3000/`.
3. Confirm the Teltonika-fed NMEA connection appears in Signal K.
4. Confirm GPS or NMEA-derived data reaches the expected consumers.

## Failure modes to account for

1. Not on `Venus OS Large`
   The script will fail if `/service/node-red-venus` or `/service/signalk-server` does not exist.

2. Node-RED credentials missing
   If your flow uses credentials and you only copy `flows.json`, Node-RED may load the flow structure but lose secrets.

3. Node-RED generated encryption key missing
   If the source Node-RED instance used a generated key, you must also move `.config.runtime.json` or re-enter credentials manually.

4. Extra Node-RED packages missing
   If your golden flow depends on additional palette modules beyond the stock Venus OS Large set, you must reproduce those packages too.

## Sources

- [Victron Venus OS Large manual](https://www.victronenergy.com/live/venus-os%3Alarge)
- [Victron root access and DBus scripting examples](https://www.victronenergy.com/live/ccgx%3Aroot_access)
- [Victron `node-red-venus` recipe](https://github.com/victronenergy/meta-victronenergy/blob/fc0dc6899230d3c7fa84aa8eea2f594ce2d54738/meta-venus/recipes-extended/node-red-venus/node-red-venus.bb)
- [Victron `prepare-node-red-venus.sh`](https://github.com/victronenergy/meta-victronenergy/blob/fc0dc6899230d3c7fa84aa8eea2f594ce2d54738/meta-venus/recipes-extended/node-red-venus/files/prepare-node-red-venus.sh)
- [Victron Venus platform service wiring](https://github.com/victronenergy/venus-platform/blob/bb9ce068bc09cb1e4055514da16f29dd6fe18fe5/src/application.cpp)
- [Victron GUI Node-RED settings page](https://github.com/victronenergy/gui-v2/blob/ec49f887abcb278cc38a61847cd04bd8e01ece64/pages/settings/PageSettingsNodeRed.qml)
- [Victron GUI Signal K settings page](https://github.com/victronenergy/gui-v2/blob/ec49f887abcb278cc38a61847cd04bd8e01ece64/pages/settings/PageSettingsSignalK.qml)
- [Victron GUI mock config showing platform service values](https://github.com/victronenergy/gui-v2/blob/ec49f887abcb278cc38a61847cd04bd8e01ece64/data/mock/conf/maximal.json)
- [Node-RED runtime configuration](https://nodered.org/docs/user-guide/runtime/configuration)
- [Node-RED credentials are stored separately from flows](https://nodered.org/docs/creating-nodes/credentials)
- [Node-RED maintainer guidance on generated credential keys and `.config.runtime.json`](https://discourse.nodered.org/t/unexpected-debug-message-your-flow-credentials-file-is-encrypted-using-a-system-generated-key/87490/3)
