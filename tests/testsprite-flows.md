# NomadXE TestSprite Test Plan

Run these against the deployed app or `http://localhost:3000` once `.env.local` has real credentials.

## How to run with TestSprite
In the nomadxe-v2 directory (with `testsprite` MCP connected):
```
Use TestSprite MCP to run all flows below against https://www.nomadxe.com (or localhost:3000)
```

---

## Flow 1: Invite → Activate → Login (critical path)

**Steps:**
1. Admin logs into `/admin` with admin credentials
2. Fill "Invite New Client" form → enter a test email → click Send Invitation
3. Assert: success toast "Invitation sent to <email>"
4. Check email inbox → click invite link
5. Assert: redirect lands on `/activate-account` (NOT landing page `/`)
6. Fill Full Name + Password (min 8 chars) → click Activate Account
7. Assert: redirect to `/dashboard`
8. Assert: user appears in admin table as active (no "Awaiting first login" pulse)

**Previously failing:** step 5 redirected to `/` due to session cookies not attached to redirect response in `/auth/confirm`.

---

## Flow 2: Delete User

**Steps:**
1. Admin navigates to `/admin`
2. Hover a non-admin user row → click Delete
3. Assert: browser `confirm()` dialog appears — click OK
4. Assert: success toast "User deleted successfully"
5. Assert: user no longer in table
6. Assert: no error toast / no FK constraint error

**Previously failing:** `profiles.id` FK to `auth.users` had no CASCADE — delete threw constraint violation.

---

## Flow 3: Multiple Victron Device Assignment

**Steps:**
1. Admin navigates to `/admin`
2. Use "Register Victron Device" panel → add a second device (Site ID + name)
3. Assert: success toast, device appears in fleet count
4. Use "Assign Device to User" panel → select existing user + new device → click Assign
5. Assert: success toast "Device assigned successfully"
6. Locate the user in the table → assert BOTH devices appear in the "Assigned Devices" column
7. Click `×` next to one device → assert it's removed, other device remains

---

## Flow 4: Suspend / Reactivate User

**Steps:**
1. Admin hovers an active user row → click Suspend
2. Assert: success toast "User suspended successfully"
3. Assert: user row shows red "Suspended" badge
4. Hover row → click Reactivate
5. Assert: success toast "User reactivated successfully"
6. Assert: suspended badge gone

---

## Flow 5: Role Toggle (Admin ↔ Client)

**Steps:**
1. Admin hovers a client row → click Make Admin
2. Assert: role badge changes to "⬡ Admin" (violet)
3. Click Revoke Admin
4. Assert: role badge changes back to "◯ Client"

---

## Flow 6: Resend Invite (pending user)

**Steps:**
1. Admin finds a user with "Awaiting first login" pulse
2. Hover row → click Resend Invite
3. Assert: success toast "Invitation resent to <email>"

---

## Flow 7: Register Device (standalone)

**Steps:**
1. Admin fills "Register Victron Device" → VRM Site ID + name → submit
2. Assert: success toast "Device registered successfully"
3. Assert: Victron Devices stat counter increments

---

## Flow 8: Expired / Invalid Invite Link

**Steps:**
1. Navigate to `/auth/confirm` with a fake/expired code
2. Assert: redirect to `/login?error=Invalid+or+expired+invite+link`
3. Assert: error message is displayed on the login page

---

## Flow 9: Activate with Already-Used Link

**Steps:**
1. Navigate to `/activate-account` without going through `/auth/confirm` first (no session)
2. Assert: "Invite Link Expired" error state is shown
3. Assert: "← Back to Sign In" link works

---

## Flow 10: RBAC — Non-admin cannot access /admin

**Steps:**
1. Log in as a regular client user
2. Manually navigate to `/admin`
3. Assert: redirect to `/dashboard`
4. Assert: no admin UI is visible

---

## DB Migration Required Before Testing

Run in Supabase SQL editor:
```sql
-- migrations/00000000000002_fix_profile_fk_cascade.sql
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
```
This is required for Flow 2 (Delete User) to work without FK errors.
