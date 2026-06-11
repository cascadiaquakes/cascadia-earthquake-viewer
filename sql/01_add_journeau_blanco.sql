-- Adds the Journeau et al. (2026) Blanco Transform Fault catalog.
-- Source paper: https://doi.org/10.1029/2025JB032982
-- Submitted via GitHub issue #22 by Cyril Journeau.
--
-- Run order (the CSV must be inside the container at /tmp/catalog_journeau.csv):
--   docker cp ./catalog_Journeau_etal_2026_JGR_Blanco_CRESCENT.csv postgis-eq:/tmp/catalog_journeau.csv
--   docker exec -i postgis-eq psql -U postgres -d gis < sql/01_add_journeau_blanco.sql
--
-- The whole thing runs in one transaction so it either lands cleanly or
-- leaves the DB exactly as it was.

BEGIN;

-- 1. Registry row in earthquake.catalogs.
INSERT INTO earthquake.catalogs (
    catalog_id,
    catalog_name,
    doi,
    publication_title,
    technique,
    network_codes,
    region,
    start_date,
    end_date,
    num_events,
    submitted_by,
    status,
    metadata
) VALUES (
    17,
    'Journeau et al. (2026) -- Blanco Transform Fault Tectonic EQs (30K)',
    '10.1029/2025JB032982',
    'OBS Data Mining Reveals Seismic Structure and Dynamics of the Oceanic Blanco Transform Fault, Northeast Pacific',
    'Machine learning OBS detection',
    NULL,
    'Blanco Transform Fault',
    '2012-09-24 00:00:00',
    '2013-10-03 23:59:59',
    30447,
    'CRESCENT',
    'active',
    jsonb_build_object(
        'magnitude_type',     'ML',
        'velocity_model',     'Christeson et al. (2010)',
        'detection_method',   'PickBlue ML OBS picker',
        'association_method', 'PyOcto',
        'location_method',    'NonLinLoc-SSST'
    )
);

-- 2. Stage the CSV in a temp table, then transform into earthquake.events.
CREATE TEMP TABLE staging_journeau (
    lon    double precision,
    lat    double precision,
    depth  double precision,
    year   integer,
    month  integer,
    day    integer,
    hour   integer,
    minute integer,
    second double precision,
    mag    double precision
) ON COMMIT DROP;

\copy staging_journeau FROM '/tmp/catalog_journeau.csv' WITH (FORMAT csv, HEADER true);

INSERT INTO earthquake.events (
    catalog_id,
    evid,
    lon,
    lat,
    depth,
    origin_time,
    magnitude,
    magnitude_type,
    geom
)
SELECT
    17,
    'JOURNEAU_' || row_number() OVER ()::text,
    lon,
    lat,
    depth,
    make_timestamp(year, month, day, hour, minute, second),
    mag,
    'ML',
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)
FROM staging_journeau;

-- Sanity check before committing. If the count doesn't match num_events
-- the transaction will still commit (these are just SELECTs), but the
-- numbers should match.
SELECT
    catalog_id,
    catalog_name,
    num_events AS expected,
    (SELECT count(*) FROM earthquake.events WHERE catalog_id = 17) AS loaded
FROM earthquake.catalogs
WHERE catalog_id = 17;

COMMIT;
