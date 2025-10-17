-- Enable the PostGIS extension for geospatial capabilities.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create a dedicated schema for the landslide data.
CREATE SCHEMA IF NOT EXISTS landslides;