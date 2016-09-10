-- Create a function that always returns the first non-NULL item
DROP FUNCTION IF EXISTS lyf.first_agg ( anyelement, anyelement );
CREATE OR REPLACE FUNCTION lyf.first_agg ( anyelement, anyelement )
RETURNS anyelement LANGUAGE SQL IMMUTABLE STRICT AS $$
        SELECT $1;
$$;

-- And then wrap an aggregate around it
DROP AGGREGATE  IF EXISTS lyf.FIRST(anyelement);
CREATE AGGREGATE lyf.FIRST (
        sfunc    = lyf.first_agg,
        basetype = anyelement,
        stype    = anyelement
);

-- Create a function that always returns the last non-NULL item
DROP FUNCTION  IF EXISTS lyf.last_agg(anyelement, anyelement);
CREATE OR REPLACE FUNCTION lyf.last_agg ( anyelement, anyelement )
RETURNS anyelement LANGUAGE SQL IMMUTABLE STRICT AS $$
        SELECT $2;
$$;

-- And then wrap an aggregate around it
DROP AGGREGATE  IF EXISTS lyf.LAST(anyelement);
CREATE AGGREGATE lyf.LAST (
        sfunc    = lyf.last_agg,
        basetype = anyelement,
        stype    = anyelement
);
