-- Teams table - Core team information
CREATE TABLE teams (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    address text,
    vat_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT teams_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Comments
COMMENT ON TABLE teams IS 'Teams in the system. Each team can have multiple members with different roles.';
COMMENT ON COLUMN teams.name IS 'Team display name, must be non-empty.';
COMMENT ON COLUMN teams.address IS 'Legal address for team settings.';
COMMENT ON COLUMN teams.vat_number IS 'VAT/Tax number for team settings.';