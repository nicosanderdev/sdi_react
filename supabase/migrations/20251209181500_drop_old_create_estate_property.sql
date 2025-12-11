-- Drop the old create_estate_property function with text owner_user_id parameter
-- to resolve function overload ambiguity

DROP FUNCTION IF EXISTS create_estate_property(
    text, text, text, text, text, text, text,
    double precision, double precision, text, integer,
    double precision, integer, integer, integer, boolean,
    integer, text, timestamp with time zone, boolean,
    integer, text, integer, double precision, double precision,
    boolean, double precision, boolean, boolean, boolean,
    integer, boolean, boolean, jsonb, jsonb, jsonb, jsonb
);
