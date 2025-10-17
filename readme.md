
# PostGIS + Martin Local Development Sandbox

This repository is a proof-of-concept (POC) for a local development environment to serve geospatial vector tiles. It uses Docker Compose to orchestrate three services: a **PostGIS** database, a **Martin** tile server, and an **Nginx** web server for a simple map viewer.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## 1. Setup

1.  Place your geospatial data file (e.g., `final_combined.geojson`) into the `/data` directory.
2.  The `.env` file contains the default configuration for ports and database credentials. You can edit these if needed.

---

## 2. Usage

All commands should be run from the root of the project directory.

### Start the Environment

To start all services (PostGIS, Martin, Nginx) in the background, run:
```bash
docker compose up -d
````

### Load Data (One-Time Step)

After starting the services for the first time, you must load your data into the database. These commands use a temporary GDAL container to perform the import.

**Import Polygons:**

```bash
docker run --rm -v "${PWD}:/data" ghcr.io/osgeo/gdal:alpine-small-latest ogr2ogr -f PostgreSQL PG:"host=host.docker.internal port=5432 dbname=gis user=postgres password=pass active_schema=landslides" /data/data/final_combined.geojson -nln landslides.ls_polygons -where "OGR_GEOMETRY IN ('POLYGON','MULTIPOLYGON')" -nlt MULTIPOLYGON -t_srs EPSG:4326 -lco GEOMETRY_NAME=geom -lco FID=gid -skipfailures -overwrite
```

**Import Points:**

```bash
docker run --rm -v "${PWD}:/data" ghcr.io/osgeo/gdal:alpine-small-latest ogr2ogr -f PostgreSQL PG:"host=host.docker.internal port=5432 dbname=gis user=postgres password=pass active_schema=landslides" /data/data/final_combined.geojson -nln landslides.ls_points -where "OGR_GEOMETRY IN ('POINT','MULTIPOINT')" -nlt POINT -explodecollections -t_srs EPSG:4326 -lco GEOMETRY_NAME=geom -lco FID=gid -skipfailures -overwrite
```

### Stop the Environment

To stop all services:

```bash
docker compose down
```

### Full Reset

To stop all services and **delete the database volume** (all data will be lost):

```bash
docker compose down -v
```

-----

## 3\. Verify It's Working

Once the environment is running and data is loaded, you can check the following URLs in your browser:

  - **Map Viewer:** [http://localhost:8080](https://www.google.com/search?q=http://localhost:8080)
  - **Martin Web UI:** [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000)
  - **Martin Catalog (JSON):** [http://localhost:3000/catalog](https://www.google.com/search?q=http://localhost:3000/catalog)

-----

## Project Structure

  - `docker-compose.yml`: The main recipe that defines and connects all the services.
  - `.env`: Contains environment variables for port numbers and database credentials.
  - `sql/`: Holds `.sql` scripts that are automatically run when the database is first created.
  - `data/`: A place to store your raw data files (e.g., `.geojson`).
  - `web/`: Contains the static files for the map viewer (`index.html`).
