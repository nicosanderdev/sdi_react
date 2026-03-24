# admin-update-user

Admin-only edge function. Updates `Members` via `admin_update_member_contact` (using the caller’s JWT so `is_admin()` works), then syncs `auth.users` with the service role.

## Deploy

```bash
supabase functions deploy admin-update-user
```

## Secrets

Uses the same env as other functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Request

`POST` with `Authorization: Bearer <user JWT>` (admin).

```json
{
  "memberId": "uuid",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "optional string"
}
```

## Response

- `200` `{ "success": true, "message": "Updated" }`
- `200` `{ "success": false, "message": "...", "fieldErrors": { "email"?: "...", "phone"?: "..." } }` (validation)
- `4xx/5xx` on auth or hard failures

Apply migration `20260324120000_admin_update_member_contact.sql` before relying on this function.
