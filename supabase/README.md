# supabase/

## What each file is

| File | What it is | Do you run it again? |
|---|---|---|
| `migrations/0001_init.sql` | The schema: tables, enums, indexes, RLS policies, reporting functions | **No** — already applied |
| `migrations/0002_seed.sql` | The first product row and starting settings | **No** — already applied |
| `setup.sql` | The two files above concatenated, for one-shot setup | **No** — already applied |

You already ran `setup.sql`, which is why the database works. **Nothing here needs
to be run again.** Keep the files.

## Why keep them

They are the definition of your database in version control. If you had to
recreate everything tomorrow — a new Supabase project, a staging copy, a
restored backup — you would run `setup.sql` and be back exactly where you are,
schema-wise. Deleting them means the only copy of your schema lives inside
Supabase's dashboard, with no history of how it got that way.

They are also safe to re-run. Every statement is written to be idempotent:
`create table if not exists`, `create or replace function`,
`drop policy if exists` before each `create policy`, and the seed uses
`on conflict do nothing`. Re-running `setup.sql` on the live database would
change nothing — it would **not** reset your prices or delete your orders.

## Changing the schema later

Do not edit `0001_init.sql`. It represents what has already been applied.
Add a new numbered file instead:

```
migrations/0003_add_something.sql
```

Write it so it can run twice without breaking, run it in the Supabase SQL
editor, then verify:

```bash
npm run db:verify
```

If you want a refreshed one-shot file after adding migrations, regenerate
`setup.sql` by concatenating them in order.

## Useful commands

```bash
npm run db:verify
```

Checks every table, function, index and RLS policy, confirms the anon key can
read and write nothing, and reports the current product economics. Read-only.

```bash
npm run db:verify -- --grant-admin someone@example.com
```

Same checks, and adds an existing confirmed Supabase Auth user to the
`admin_users` allow-list. This is the only way to grant admin access — creating
an auth user alone does not do it.

```bash
npm run db:e2e -- --confirm
```

Full order-flow test against whatever database `.env.local` points at: places
an order, checks the server ignores browser-supplied prices, walks the status
funnel, and asserts only PAID orders count as revenue.

**This one writes to the database.** Everything it touches is scoped to the
test phone `0699887766` and deleted afterwards, and it prints the real orders
it left untouched — but it is still a live write, which is why it refuses to
run without `--confirm`. Prefer running it against a staging project.
