# Data Directory

This directory contains earthquake catalog data loaded into PostGIS.

## Sample Data
The proof-of-concept uses landslide data from \inal_combined.geojson\ (539 MB).

**Note:** Large data files are NOT committed to Git. Instead:
1. Place your GeoJSON/CSV files in this directory
2. Run \docker compose up\ to load data into PostGIS
3. Access data via Martin tile server or PostGIS queries

## Data Sources
- TODO: Document where earthquake catalog data comes from
- TODO: Add data ingestion scripts
