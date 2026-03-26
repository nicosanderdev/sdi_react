# admin-ban-user

Admin-only. Calls `auth.admin.updateUserById` with a long `ban_duration` so the user cannot sign in after a logical delete on `Members`.

## Deploy

```bash
supabase functions deploy admin-ban-user
```

## Request

`POST` with admin JWT.

```json
{ "userId": "<auth.users id>" }
```

The app should call this after a successful `soft_delete_user` RPC when you want auth access revoked immediately.
