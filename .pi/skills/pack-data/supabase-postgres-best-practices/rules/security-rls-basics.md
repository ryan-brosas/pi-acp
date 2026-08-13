---
title: Enable Row Level Security for Multi-Tenant Data
impact: CRITICAL
impactDescription: Database-enforced tenant isolation, prevent data leaks
tags: rls, row-level-security, multi-tenant, security
---

## Enable Row Level Security for Multi-Tenant Data

Row Level Security (RLS) enforces data access at the database level, ensuring users only see their own data.

**Incorrect (application-level filtering only):**

```sql
-- Relying only on application to filter
select * from orders where user_id = $current_user_id;

-- Bug or bypass means all data is exposed!
select * from orders;  -- Returns ALL orders
```

**Correct (database-enforced RLS):**

```sql
-- Enable RLS on the table
alter table orders enable row level security;

-- Policy using the authenticated user's id (Supabase): auth.uid() is not client-settable
create policy orders_user_policy on orders
  for all
  to authenticated
  using (user_id = auth.uid());

-- Force RLS even for table owners
alter table orders force row level security;
```

> Never gate policies on client-settable session variables (`current_setting('app.current_user_id')` is spoofable). Use `auth.uid()` or a trusted, transaction-local context with restricted `set_config` and role separation.

Reference: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
