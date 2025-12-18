# Cascadia Earthquake Catalog Viewer

Interactive web-based visualization tool for exploring multiple earthquake catalogs across the Cascadia region.

## 🌍 Available Catalogs

### 1. Brenton et al. — Cascadia ML Catalog (279,060 events)
- **Technique**: Machine Learning
- **Networks**: UW, CN, CC
- **Region**: Cascadia Subduction Zone
- **Coverage**: 2002-2020

### 2. Littel et al. 2024 — Queen Charlotte (18,038 events)
- **DOI**: [10.1029/2022TC007494](https://doi.org/10.1029/2022TC007494)
- **Technique**: hypoDD relocation
- **Networks**: GSC, CHIS
- **Region**: Queen Charlotte Triple Junction

### 3. Merrill et al. — Nootka Fault Zone (92,002 events)
- **DOI**: [10.1029/2021GC010205](https://doi.org/10.1029/2021GC010205)
- **Technique**: REST algorithm + tomoDD
- **Networks**: CHIS
- **Region**: Nootka Fault Zone

### 4. Morton et al. 2023 — Cascadia Subduction (5,282 events)
- **DOI**: [10.1029/2023JB026607](https://doi.org/10.1029/2023JB026607)
- **Technique**: Subspace detection + Hypoinverse
- **Networks**: Cascadia Initiative
- **Region**: Cascadia Subduction Zone

### 5. Shelly et al. 2025 — LFE Southern Cascadia (61,441 events)
- **DOI**: [10.1029/2025GL116116](https://doi.org/10.1029/2025GL116116)
- **Technique**: Template matching + cross-correlation
- **Networks**: BK, NC
- **Region**: Southern Cascadia (MTJ region)

**Total Events**: 455,823 across all catalogs

---

## Features

### 🗺️ Dual Visualization Modes

**2D Interactive Map**
- Intelligent clustering with blue circles showing event counts (zoom 0-14)
- Individual earthquake points at high zoom (14+) with depth-based coloring
- Satellite imagery basemap (Esri World Imagery)
- Smooth zoom transitions and cluster expansion on click

**3D Globe Visualization (Cesium)**
- Real-time 3D rendering with Cesium engine
- Terrain modes: Satellite / Dark
- Political boundaries overlay (US states, Canadian provinces)
- Draggable info boxes with detailed earthquake data
- Cascadia study region boundary box with corner labels

### 📊 Data Analysis & Visualization

**Depth-Based Color Coding**
- 🟡 Yellow: Shallow (0-20 km)
- 🟠 Orange: Medium (20-40 km)
- 🔴 Red: Deep (40+ km)

**Advanced Filters**
- **Depth range**: Slider control (0-100 km)
- **Magnitude range**: Slider control (0-10)
- **Date range**: Calendar picker with validation (prevents invalid ranges)
- **Spatial bounds**: Lat/lon bounding box for geographic filtering
- **API-powered**: All filters processed server-side for optimal performance

**Interactive Features**
- Clustering for large datasets (auto-decluster on zoom)
- Click events to view detailed metadata
- Real-time catalog switching (279K events loaded in seconds)

**Data Export**
- GeoJSON format (preserves all metadata and geometry)
- CSV format (tabular data with all attributes)
- Exports filtered earthquakes based on current filters
- Timestamped filenames for version control

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend Build | Vite | 7.2.2 |
| 2D Mapping | MapLibre GL JS | 5.0.0 |
| 3D Visualization | CesiumJS | Latest |
| Backend API | Node.js + Express | 18+ |
| Database | PostgreSQL + PostGIS | 16 / 3.4 |
| Tile Server | Martin | 0.14.0 |
| Container Platform | Docker Compose | Latest |

---

## Quick Start

### Prerequisites

- Node.js 18+ (LTS)
- Docker Desktop (latest)
- Git

### Installation

**1. Clone repository**
```bash
git clone https://github.com/billmj/cascadia-earthquake-viewer.git
cd cascadia-earthquake-viewer
```

**2. Start backend services**
```bash
cd backend
docker-compose up -d
```

**3. Start API server**
```bash
cd backend
npm install
npm start
```

**4. Start frontend**
```bash
cd frontend
npm install
npm run dev
```

**5. Open application**
- 2D Map: http://localhost:5173
- 3D Globe: http://localhost:5173/viewer3d.html
- API: http://localhost:3002

---

## Project Structure

```text
cascadia-earthquake-viewer/
├── backend/
│   ├── src/
│   │   ├── api.js              # Express API talking to Postgres/Martin
│   │   ├── cesium3d.js         # 3D tiles / helper logic (node-side)
│   │   └── main.js             # Backend entry point (npm start)
│   ├── config.yaml             # Martin tile server config
│   ├── docker-compose.yml      # PostgreSQL + PostGIS + Martin stack
│   ├── eq-style.json           # Martin vector style for earthquake tiles
│   ├── gis_backup.dump         # Postgres/PostGIS database backup
│   ├── index.html              # Martin demo viewer (debug only)
│   ├── testtile.pbf            # Sample tile for testing
│   ├── tile_0_0_0.pbf          # Extra sample tiles (debug)
│   ├── tile_5_4_12.pbf
│   ├── tile_5_5_11.pbf
│   ├── tile_5_5_12.pbf
│   ├── package.json            # Backend dependencies & scripts
│   └── package-lock.json
│   # Generated at runtime:
│   # ├── node_modules/         # Installed backend dependencies
│   # └── pgdata/               # Postgres data directory
│
├── frontend/
│   ├── public/
│   │   ├── geojson/
│   │   │   ├── georef-canada-province-public.geojson # Canada provinces
│   │   │   └── us-states.json                        # US states
│   │   └── vite.svg
│   │
│   ├── src/
│   │   ├── maplibre/           # 2D map configuration
│   │   │   ├── baselayer.js    # Basemap style & source wiring
│   │   │   ├── config.js       # Map constants (ids, colors, bounds)
│   │   │   ├── layers.js       # Depth legend, boundary, helpers
│   │   │   └── viewer.js       # (Optional) older viewer helper
│   │   ├── resources/          # Logos and static assets
│   │   │   ├── Crescent_Logo.png
│   │   │   ├── favicon.ico
│   │   │   └── USNSF_Logo.png
│   │   ├── cesium3d.js         # Frontend Cesium 3D globe code
│   │   ├── counter.js          # Vite scaffold (not used in app)
│   │   ├── earthquake-filters-config.js  # Filter definitions (sliders, etc.)
│   │   ├── filter-builder.js   # Builds filter payloads for API
│   │   ├── filters.js          # 2D filter UI wiring
│   │   ├── javascript.svg
│   │   ├── resize.js           # Layout / resize helpers
│   │   └── style.css           # Global styling (2D + 3D)
│   │
│   ├── index.html              # 2D earthquake viewer shell
│   ├── viewer3d.html           # 3D earthquake viewer shell
│   ├── main.js                 # 2D app entry point (clustering + export)
│   ├── vite.config.js          # Vite dev/build config
│   ├── package.json            # Frontend dependencies & scripts
│   └── package-lock.json
│   # Generated at runtime:
│   # └── node_modules/         # Installed frontend dependencies
│
└── README.md


---

## API Endpoints

### GET `/api/earthquakes`

Fetch earthquake data with optional filters.

**Query Parameters:**
- `limit` (default: 10000) - Maximum number of events
- `minDepth` (default: 0) - Minimum depth in km
- `maxDepth` (default: 100) - Maximum depth in km
- `regions` (default: all) - Comma-separated region codes (W1,W2,W3,E1,E2,E3)
- `minStations` (default: 3) - Minimum number of recording stations
- `maxError` (default: 100) - Maximum location error in km
- `maxGap` (default: 360) - Maximum azimuthal gap in degrees

**Example:**
```bash
curl "http://localhost:3002/api/earthquakes?minDepth=20&maxDepth=40&regions=W1,W2&limit=5000"
```

**Response:**
```json
{
  "count": 5000,
  "earthquakes": [
    {
      "evid": "20181120205341",
      "latitude": 45.123,
      "longitude": -123.456,
      "depth": 25.3,
      "magnitude": 2.1,
      "origin_time": "2018-11-20T20:53:41.000Z",
      "region": "W1",
      "nsta": 12,
      "gap": 85.5,
      "max_err": 2.1
    }
  ]
}
```

---

## Database Schema

### `earthquake.events` Table

| Column | Type | Description |
|--------|------|-------------|
| evid | TEXT | Unique event identifier |
| latitude | FLOAT | Latitude (WGS84) |
| longitude | FLOAT | Longitude (WGS84) |
| depth | FLOAT | Depth in kilometers |
| magnitude | FLOAT | Event magnitude (optional) |
| origin_time | TIMESTAMP | Event time (UTC) |
| region | TEXT | Geographic region (W1-W3, E1-E3) |
| nsta | INTEGER | Number of recording stations |
| gap | FLOAT | Azimuthal gap (degrees) |
| max_err | FLOAT | Location error (km) |
| geom | GEOMETRY | PostGIS point geometry |

**Spatial Index:** GIST index on `geom` for fast spatial queries

---

## Development

### Frontend Development
```bash
cd frontend
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run preview      # Preview production build
```

### Backend Development
```bash
cd backend

# Docker services
docker-compose up -d           # Start PostgreSQL
docker-compose down            # Stop services
docker-compose logs -f         # View logs

# API server
npm start                      # Start Express server
npm run dev                    # Start with nodemon (auto-restart)

# Database access
docker exec -it postgis-eq psql -U postgres -d gis
```

### Environment Variables

**Frontend (`.env`):**
```env
VITE_CESIUM_TOKEN=your_cesium_token_here
```

**Backend (`.env`):**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gis
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3002
```

---

## Data Import

To import earthquake data:

```bash
cd backend
node scripts/import-earthquakes.js
```

Expected data format (CSV):
```
evid,latitude,longitude,depth,magnitude,origin_time,region,nsta,gap,max_err
20181120205341,45.123,-123.456,25.3,2.1,2018-11-20T20:53:41,W1,12,85.5,2.1
```

---

## Deployment

### Production Build

**Frontend:**
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

Deploy `dist/` folder to:
- AWS S3 + CloudFront

**Backend:**
```bash
cd backend
docker-compose -f docker-compose.prod.yml up -d
```

Deploy Express API to:
- AWS EC2 / ECS

---

## Troubleshooting

### Backend Issues

**PostgreSQL won't start:**
```bash
docker-compose down -v
docker-compose up -d
```

**API not responding:**
```bash
# Check if running
curl http://localhost:3002/api/earthquakes?limit=1

# Check logs
cd backend
npm start
```

**No earthquake data:**
```bash
# Import data
cd backend
node scripts/import-earthquakes.js
```

### Frontend Issues

**Map not loading:**
- Hard refresh: `Ctrl + Shift + R`
- Check browser console (F12) for errors
- Verify backend is running: `curl http://localhost:3002/api/earthquakes?limit=1`

**3D view blank:**
- Verify Cesium token in `.env` file
- Check browser supports WebGL: https://get.webgl.org/

**Clusters not showing:**
- Zoom out (clusters appear at zoom 0-14)
- Check if data loaded: Open browser console

---

## Performance

**Optimizations:**
- 2D clustering reduces rendering from 279K to ~50-100 visible elements
- 3D view limits to 10K points by default (adjustable via filters)
- Spatial indexing for sub-second database queries
- Gzip compression for API responses
- Cesium request render mode for better 3D performance

**Recommended limits:**
- 2D: No limit (clustering handles it)
- 3D: 10,000 points (default, can increase to 50,000 on powerful machines)

---

## Credits

**Developed by:** CRESCENT Dev Team (William, Loïc, Amanda) 
**Funded by:** U.S. National Science Foundation  
**Earthquake Data:** Pacific Northwest Seismic Network  
**Basemap:** Esri World Imagery  
**3D Engine:** Cesium  

---

## License

Copyright © 2025 Cascadia Region Earthquake Science Center (CRESCENT). All rights reserved.

---

## Support

For technical questions or issues:
- Open an issue on GitHub
- Contact: crescent cyber team

---

**Version:** v1.0 (demo)  
**Last Updated:** December 2025
