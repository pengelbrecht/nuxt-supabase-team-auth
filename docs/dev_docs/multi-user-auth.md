# Multi-User Authentication & Invitation System

This guide explains how **authentication**, **authorization** and the **user-invitation flow** are implemented in the KwikRate code-base. Read this first before touching any auth-related code.

---

## 1. Core Concepts

1. **Supabase Auth** is the source of truth for credentials (email / password / magic-link tokens).
2. Each Supabase auth user has exactly **one row** in `public.users`, which adds business metadata: `first_name`, `last_name`, `company_id`, and a **role** (`member`, `admin`, `super_admin`).
3. Users belong to a single **company** (`public.companies`). All data access is filtered by `company_id` via **Row Level Security (RLS)**.
4. A **company admin** may invite additional users via e-mail. Invitations are delivered by Supabase's _inviteUserByEmail_ endpoint and completed on the `/confirm` page.

---

## 2. Database Schema

### 2.1 Enumerations

```sql
CREATE TYPE public.user_role AS ENUM ('member', 'admin', 'super_admin');
```

### 2.2 Users

```sql
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  first_name  text     NOT NULL,
  last_name   text     NOT NULL,
  company_id  uuid     NOT NULL REFERENCES public.companies(id),
  role        public.user_role NOT NULL,
  created_at  timestamptz DEFAULT now(),
  closed_at   timestamptz
);
```

### 2.3 User Invitations

```sql
CREATE TABLE public.user_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        public.user_role NOT NULL,
  token       text UNIQUE NOT NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
```

### 2.4 RLS Policies (Highlights)

- **public.users** – every query must satisfy `company_id = current_user_company()` unless caller is `super_admin`.
- **public.user_invitations**
  - `INSERT` / `SELECT` / `DELETE` allowed to company `admin`.
  - Invited user can `SELECT` their own invitation via `token`.

The concrete SQL lives in `supabase/migrations/*user_invitations*.sql`.

---

## 3. Auth Workflows

### 3.1 Regular Sign-Up

1. Visitor submits `/signup` form.
2. Supabase creates `auth.users` record and sends a confirmation e-mail.
3. After confirming, the user is redirected to `/confirm` which:
   - Requests **first / last name + password**.
   - Calls `POST /api/users/ensure-user` which:
     - Creates **a brand-new company** ( `<first_name>'s Organization` ).
     - Inserts row in `public.users` with role `member`.

### 3.2 Invitation Flow

Mermaid sequence:

```mermaid
sequenceDiagram
  participant A as Admin (authenticated)
  participant FE as Nuxt front-end
  participant BE as /api/company/users/invite
  participant SB as Supabase (service role)
  participant E as Invitee

  A->>FE: Fill e-mail & role
  FE->>BE: POST {email, role}
  BE->>SB: auth.admin.inviteUserByEmail()
  SB-->>BE: {user_id, email, token}
  BE->>SB: INSERT INTO user_invitations
  BE-->>FE: 200 OK
  SB->>E: Invitation e-mail (magic-link)
  E->>/confirm: Click link with `access_token` & `refresh_token`
  /confirm->>SB: auth.setSession(tokens)
  /confirm->>SB: auth.updateUser(password)
  /confirm->>/api/users/ensure-user: {names, company_id, role}
  ensure-user->>SB: INSERT public.users
  /confirm-->>E: Redirect to /dashboard
```

### 3.3 Login / Session Handling

- **Supabase client** is initialised in `app/plugins/00-supabase-client.client.ts`.
- Session persistence uses localStorage; auto token refresh is enabled by default.
- Middleware `auth.global.ts` redirects to `/login` if the user is not authenticated.

### 3.4 Password Reset

- `/forgot-password` page triggers `supabase.auth.resetPasswordForEmail()`.
- E-mail link redirects to `/reset-password` (type=`recovery`).
- Similar to `/confirm`, page sets new password.

---

## 4. Server-Side Endpoints

| Route                                    | File                                                          | Purpose                                                   |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `POST /api/company/users/invite`         | `server/api/company/users/invite.post.ts`                     | Send invitation e-mail (admin only)                       |
| `POST /api/users/ensure-user`            | `server/api/users/ensure-user.post.ts`                        | Create / update `public.users` after signup or invitation |
| `PATCH /api/company/users/[userId]/role` | `server/api/company/users/[userId]/role.patch.ts`             | Promote / demote user within company                      |
| _(plus)_ `/api/auth/debug.get.ts`        | Handy endpoint for inspecting auth headers during development |

All handlers rely on shared helpers in `server/utils/auth-helper.ts` to:

- Validate JWT (or Bearer token in tests).
- Provide `supabase` client that respects the caller's RLS context.

---

## 5. Front-End Components

1. **Dashboard → Settings → Members** (`app/pages/dashboard/settings/members.vue`)
   - Shows current company members.
   - Opens modal to send invitations.
2. **Admin Users Page** (`app/pages/admin/users.vue`)
   - Super-admins can invite across companies.
3. **`/confirm.vue`**
   - Universal handler for both email confirmation and invitation acceptance.
   - Parses `access_token` / `refresh_token` from URL hash when self-hosted mail clients strip query strings.
4. **Pinia Stores**
   - `auth.ts` – caches `role` & `companyId` from `public.users`.

---

## 6. Security Guarantees

1. **RLS by Default** – every table has `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. The service-role client is only used in trusted backend endpoints.
2. **Role Escalation Protection** –
   - Only `admin` can send invites for **their own company**.
   - Only `super_admin` can cross-company invite.
   - Endpoint prevents demotion of the **last admin** in a company.
3. **Tokens** – Invitation tokens are stored only in `user_invitations.token` and in the e-mail; never exposed elsewhere.

---

## 7. Helper Functions (SQL)

| Function                 | File                                          | Description                                    |
| ------------------------ | --------------------------------------------- | ---------------------------------------------- |
| `admin_create_user()`    | `20250606000002_add_admin_user_functions.sql` | Service-role helper used by tests to seed data |
| `admin_get_user_by_id()` | same file                                     | Bypass RLS for inspection                      |
| `check_db_details()`     | same file                                     | Sanity check for CI                            |

All helpers are `SECURITY DEFINER` and **not** exposed to the client SDK.

---

## 8. Extending / Debugging Tips

- Use `supabase.auth.admin.*` methods only inside **service-role** API routes.
- If adding new tables, always create RLS policies that align with `company_id` filtering.
- When updating `public.user_role`, also update the Zod enums in `role.patch.ts` & any UI selectors.
- To inspect current session server-side, call `/api/auth/debug`.

---

## 9. Quick Reference

| Task                | Location                                 |
| ------------------- | ---------------------------------------- |
| Invite user         | `POST /api/company/users/invite`         |
| Complete invitation | `/confirm` page + `ensure-user` endpoint |
| Promote/Demote user | `PATCH /api/company/users/[userId]/role` |
| User metadata       | Table `public.users`                     |
| Invitation metadata | Table `public.user_invitations`          |

---

_Last updated: 2025-06-11_
