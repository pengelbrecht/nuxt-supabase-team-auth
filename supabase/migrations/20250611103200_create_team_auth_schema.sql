create type "public"."invite_status" as enum ('pending', 'accepted', 'revoked');

create type "public"."team_role" as enum ('owner', 'admin', 'member', 'super_admin');

create table "public"."impersonation_sessions" (
    "id" uuid not null default uuid_generate_v4(),
    "admin_user_id" uuid not null,
    "target_user_id" uuid not null,
    "started_at" timestamp with time zone not null default now(),
    "ended_at" timestamp with time zone,
    "reason" text not null
);


alter table "public"."impersonation_sessions" enable row level security;

create table "public"."invites" (
    "id" uuid not null default uuid_generate_v4(),
    "team_id" uuid not null,
    "email" text not null,
    "token_hash" text not null,
    "expires_at" timestamp with time zone not null,
    "status" invite_status not null default 'pending'::invite_status,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."invites" enable row level security;

create table "public"."team_members" (
    "team_id" uuid not null,
    "user_id" uuid not null,
    "role" team_role not null default 'member'::team_role,
    "joined_at" timestamp with time zone not null default now()
);


alter table "public"."team_members" enable row level security;

create table "public"."teams" (
    "id" uuid not null default uuid_generate_v4(),
    "name" text not null,
    "address" text,
    "vat_number" text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."teams" enable row level security;

CREATE INDEX idx_impersonation_sessions_admin_user_id ON public.impersonation_sessions USING btree (admin_user_id);

CREATE INDEX idx_impersonation_sessions_started_at ON public.impersonation_sessions USING btree (started_at);

CREATE INDEX idx_impersonation_sessions_target_user_id ON public.impersonation_sessions USING btree (target_user_id);

CREATE INDEX idx_invites_email ON public.invites USING btree (email);

CREATE INDEX idx_invites_expires_at ON public.invites USING btree (expires_at);

CREATE INDEX idx_invites_status ON public.invites USING btree (status);

CREATE INDEX idx_invites_team_id ON public.invites USING btree (team_id);

CREATE INDEX idx_invites_token_hash ON public.invites USING btree (token_hash);

CREATE INDEX idx_team_members_role ON public.team_members USING btree (role);

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);

CREATE UNIQUE INDEX idx_team_members_unique_owner ON public.team_members USING btree (team_id) WHERE (role = 'owner'::team_role);

CREATE INDEX idx_team_members_user_id ON public.team_members USING btree (user_id);

CREATE UNIQUE INDEX impersonation_sessions_pkey ON public.impersonation_sessions USING btree (id);

CREATE UNIQUE INDEX invites_pkey ON public.invites USING btree (id);

CREATE UNIQUE INDEX invites_token_hash_key ON public.invites USING btree (token_hash);

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (team_id, user_id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

alter table "public"."impersonation_sessions" add constraint "impersonation_sessions_pkey" PRIMARY KEY using index "impersonation_sessions_pkey";

alter table "public"."invites" add constraint "invites_pkey" PRIMARY KEY using index "invites_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."impersonation_sessions" add constraint "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."impersonation_sessions" validate constraint "impersonation_sessions_admin_user_id_fkey";

alter table "public"."impersonation_sessions" add constraint "impersonation_sessions_different_users" CHECK ((admin_user_id <> target_user_id)) not valid;

alter table "public"."impersonation_sessions" validate constraint "impersonation_sessions_different_users";

alter table "public"."impersonation_sessions" add constraint "impersonation_sessions_ended_after_started" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))) not valid;

alter table "public"."impersonation_sessions" validate constraint "impersonation_sessions_ended_after_started";

alter table "public"."impersonation_sessions" add constraint "impersonation_sessions_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."impersonation_sessions" validate constraint "impersonation_sessions_target_user_id_fkey";

alter table "public"."invites" add constraint "invites_email_format" CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)) not valid;

alter table "public"."invites" validate constraint "invites_email_format";

alter table "public"."invites" add constraint "invites_expires_at_future" CHECK ((expires_at > created_at)) not valid;

alter table "public"."invites" validate constraint "invites_expires_at_future";

alter table "public"."invites" add constraint "invites_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."invites" validate constraint "invites_team_id_fkey";

alter table "public"."invites" add constraint "invites_token_hash_key" UNIQUE using index "invites_token_hash_key";

alter table "public"."team_members" add constraint "team_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_team_id_fkey";

alter table "public"."team_members" add constraint "team_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_user_id_fkey";

alter table "public"."teams" add constraint "teams_name_not_empty" CHECK ((length(TRIM(BOTH FROM name)) > 0)) not valid;

alter table "public"."teams" validate constraint "teams_name_not_empty";

grant delete on table "public"."impersonation_sessions" to "anon";

grant insert on table "public"."impersonation_sessions" to "anon";

grant references on table "public"."impersonation_sessions" to "anon";

grant select on table "public"."impersonation_sessions" to "anon";

grant trigger on table "public"."impersonation_sessions" to "anon";

grant truncate on table "public"."impersonation_sessions" to "anon";

grant update on table "public"."impersonation_sessions" to "anon";

grant delete on table "public"."impersonation_sessions" to "authenticated";

grant insert on table "public"."impersonation_sessions" to "authenticated";

grant references on table "public"."impersonation_sessions" to "authenticated";

grant select on table "public"."impersonation_sessions" to "authenticated";

grant trigger on table "public"."impersonation_sessions" to "authenticated";

grant truncate on table "public"."impersonation_sessions" to "authenticated";

grant update on table "public"."impersonation_sessions" to "authenticated";

grant delete on table "public"."impersonation_sessions" to "service_role";

grant insert on table "public"."impersonation_sessions" to "service_role";

grant references on table "public"."impersonation_sessions" to "service_role";

grant select on table "public"."impersonation_sessions" to "service_role";

grant trigger on table "public"."impersonation_sessions" to "service_role";

grant truncate on table "public"."impersonation_sessions" to "service_role";

grant update on table "public"."impersonation_sessions" to "service_role";

grant delete on table "public"."invites" to "anon";

grant insert on table "public"."invites" to "anon";

grant references on table "public"."invites" to "anon";

grant select on table "public"."invites" to "anon";

grant trigger on table "public"."invites" to "anon";

grant truncate on table "public"."invites" to "anon";

grant update on table "public"."invites" to "anon";

grant delete on table "public"."invites" to "authenticated";

grant insert on table "public"."invites" to "authenticated";

grant references on table "public"."invites" to "authenticated";

grant select on table "public"."invites" to "authenticated";

grant trigger on table "public"."invites" to "authenticated";

grant truncate on table "public"."invites" to "authenticated";

grant update on table "public"."invites" to "authenticated";

grant delete on table "public"."invites" to "service_role";

grant insert on table "public"."invites" to "service_role";

grant references on table "public"."invites" to "service_role";

grant select on table "public"."invites" to "service_role";

grant trigger on table "public"."invites" to "service_role";

grant truncate on table "public"."invites" to "service_role";

grant update on table "public"."invites" to "service_role";

grant delete on table "public"."team_members" to "anon";

grant insert on table "public"."team_members" to "anon";

grant references on table "public"."team_members" to "anon";

grant select on table "public"."team_members" to "anon";

grant trigger on table "public"."team_members" to "anon";

grant truncate on table "public"."team_members" to "anon";

grant update on table "public"."team_members" to "anon";

grant delete on table "public"."team_members" to "authenticated";

grant insert on table "public"."team_members" to "authenticated";

grant references on table "public"."team_members" to "authenticated";

grant select on table "public"."team_members" to "authenticated";

grant trigger on table "public"."team_members" to "authenticated";

grant truncate on table "public"."team_members" to "authenticated";

grant update on table "public"."team_members" to "authenticated";

grant delete on table "public"."team_members" to "service_role";

grant insert on table "public"."team_members" to "service_role";

grant references on table "public"."team_members" to "service_role";

grant select on table "public"."team_members" to "service_role";

grant trigger on table "public"."team_members" to "service_role";

grant truncate on table "public"."team_members" to "service_role";

grant update on table "public"."team_members" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant references on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant trigger on table "public"."teams" to "anon";

grant truncate on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant references on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant trigger on table "public"."teams" to "authenticated";

grant truncate on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant references on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant trigger on table "public"."teams" to "service_role";

grant truncate on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";

create policy "service_role_impersonation_update"
on "public"."impersonation_sessions"
as permissive
for update
to public
using ((auth.role() = 'service_role'::text));


create policy "service_role_impersonation_write"
on "public"."impersonation_sessions"
as permissive
for insert
to public
with check ((auth.role() = 'service_role'::text));


create policy "super_admins_can_select_own_sessions"
on "public"."impersonation_sessions"
as permissive
for select
to public
using (((admin_user_id = auth.uid()) AND (auth.uid() IN ( SELECT team_members.user_id
   FROM team_members
  WHERE (team_members.role = 'super_admin'::team_role)))));


create policy "invitees_can_select_own_invites"
on "public"."invites"
as permissive
for select
to public
using (((email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text) AND (status = 'pending'::invite_status)));


create policy "service_role_invites_access"
on "public"."invites"
as permissive
for all
to public
using ((auth.role() = 'service_role'::text));


create policy "team_admins_can_manage_invites"
on "public"."invites"
as permissive
for all
to public
using ((team_id IN ( SELECT team_members.team_id
   FROM team_members
  WHERE ((team_members.user_id = auth.uid()) AND (team_members.role = ANY (ARRAY['owner'::team_role, 'admin'::team_role]))))));


create policy "service_role_team_members_access"
on "public"."team_members"
as permissive
for all
to public
using ((auth.role() = 'service_role'::text));


create policy "super_admins_full_access_team_members"
on "public"."team_members"
as permissive
for all
to public
using ((auth.uid() IN ( SELECT team_members_1.user_id
   FROM team_members team_members_1
  WHERE (team_members_1.role = 'super_admin'::team_role))));


create policy "team_admins_can_delete_members"
on "public"."team_members"
as permissive
for delete
to public
using ((team_id IN ( SELECT team_members_1.team_id
   FROM team_members team_members_1
  WHERE ((team_members_1.user_id = auth.uid()) AND (team_members_1.role = ANY (ARRAY['owner'::team_role, 'admin'::team_role]))))));


create policy "team_admins_can_manage_members"
on "public"."team_members"
as permissive
for insert
to public
with check ((team_id IN ( SELECT team_members_1.team_id
   FROM team_members team_members_1
  WHERE ((team_members_1.user_id = auth.uid()) AND (team_members_1.role = ANY (ARRAY['owner'::team_role, 'admin'::team_role]))))));


create policy "team_admins_can_update_member_roles"
on "public"."team_members"
as permissive
for update
to public
using ((team_id IN ( SELECT team_members_1.team_id
   FROM team_members team_members_1
  WHERE ((team_members_1.user_id = auth.uid()) AND (team_members_1.role = ANY (ARRAY['owner'::team_role, 'admin'::team_role]))))));


create policy "team_members_can_select_same_team"
on "public"."team_members"
as permissive
for select
to public
using ((team_id IN ( SELECT team_members_1.team_id
   FROM team_members team_members_1
  WHERE (team_members_1.user_id = auth.uid()))));


create policy "service_role_teams_access"
on "public"."teams"
as permissive
for all
to public
using ((auth.role() = 'service_role'::text));


create policy "team_members_can_select_their_team"
on "public"."teams"
as permissive
for select
to public
using ((id IN ( SELECT team_members.team_id
   FROM team_members
  WHERE (team_members.user_id = auth.uid()))));


create policy "team_owners_can_update_their_team"
on "public"."teams"
as permissive
for update
to public
using ((id IN ( SELECT team_members.team_id
   FROM team_members
  WHERE ((team_members.user_id = auth.uid()) AND (team_members.role = 'owner'::team_role)))));



