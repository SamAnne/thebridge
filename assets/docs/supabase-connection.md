# Supabase DB Connection

Use the **pooler** connection string, not the direct one.

`db.<project-ref>.supabase.co` (the direct host) is IPv6-only — it will fail with `DatabaseNotReachable` on any network without real outbound IPv6 (common on local machines/sandboxes).

Use the Supavisor pooler host instead:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Find it in the Supabase dashboard → Project Settings → Database → **Connection pooling**. Set it as `connectionstring` in `backend/.env`.
