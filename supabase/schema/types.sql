-- Custom types/enums for team authentication
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'super_admin');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked');