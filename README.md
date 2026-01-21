# Cascadia Earthquake Catalog Viewer

Interactive, web-based visualization tool for exploring curated earthquake catalogs across the Cascadia region.

This viewer is part of the **CRESCENT Earthquake Catalog ecosystem** and is designed to provide fast, interactive access to multiple published and curated seismic catalogs for research, exploration, and outreach.

---

## 📚 Official Catalog Documentation (JupyterBook)

**Note that authoritative documentation for all earthquake catalogs lives here:**

🔗 **https://cascadiaquakes.github.io/earthquake_catalog_repository/**

The JupyterBook contains:
- Detailed catalog descriptions and provenance  
- Detection, association, and location methodologies  
- Velocity models and processing workflows  
- Reproducible notebooks and figures  
- Guidance for extending and updating catalogs  

> **If you are looking for scientific details or catalog construction methods, please start with the JupyterBook above.**

---

##  Catalogs Available in the Viewer

The viewer currently supports **10 curated earthquake catalogs**, totaling **~1.9 million events**, including:

1. **Bostock et al. 2015 — LFEs (Southern Vancouver Island)** - 269K events
2. **Plourde et al. 2015 — Southern Cascadia** - 6K events
3. **Stone et al. 2018 — Offshore Cascadia** - 237 events
4. **Wech 2021 — Cascadia Tremor** - 740K events
5. **Merrill et al. 2022 — Nootka Fault Zone** - 92K events
6. **Ducellier & Creager 2022 — Southern Cascadia** - 478K events
7. **Morton et al. 2023 — Cascadia Subduction Zone** - 5K events
8. **Littel et al. 2023 — Queen Charlotte Triple Junction** - 18K events
9. **Shelly et al. 2025 — Southern Cascadia LFEs** - 61K events
10. **Hirao et al. 2025 — Mount St. Helens** - 31K events

All catalogs include peer-reviewed publication DOI links accessible via the web interface.

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


## Analytics & Compare Mode 
### Sampling Strategy
- **Random sampling** via `ORDER BY RANDOM()` (~900ms for 10k events)
- Avoids temporal bias (no "newest-only" skew)
- Overlay catalogs: 10k event cap
- Primary catalog: 50k event cap

### Normalization
- Histograms show **% of catalog**, not raw counts
- Enables fair comparison between catalogs of different sizes
- Y-axis: "% of Catalog" when comparing

### What We Show
✅ Distribution shapes (magnitude, depth, time)  
✅ Temporal coverage differences  
✅ Structural patterns  

### What We Don't Claim
❌ Absolute event rates  
❌ Statistical significance  
❌ Completeness analysis  
❌ Catalog quality comparison  




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

**View the live application here:**
 https://d1a5q8bsxutjyg.cloudfront.net/index.html

---

## Project Structure

```text
cascadia-earthquake-viewer/
├── backend/
│   ├── src/
│   │   ├── cesium3d.js         # Backend logic for 3D tiles
│   │   └── main.js             # API entry point
│   ├── api.js                  # Express API handlers
│   ├── config.yaml             # Martin Tile Server configuration
│   ├── eq-style.json           # Vector tile style definition
│   ├── Dockerfile              # Backend container definition
│   ├── docker-compose.yml      # Local development stack (DB + Backend)
│   ├── package.json            # Node dependencies
│   └── *.pbf                   # Local map tile cache/test files
│
├── frontend/
│   ├── public/
│   │   ├── geojson/            # Static data (US States, Canada provinces)
│   │   └── vite.svg
│   ├── src/
│   │   ├── maplibre/           # 2D MapLibre logic folder
│   │   │   ├── baselayer.js    # Base map configurations
│   │   │   ├── config.js       # Map constants and settings
│   │   │   ├── layers.js       # Layer management
│   │   │   └── viewer.js       # Viewer initialization
│   │   ├── analytics.js        # Insights on analytics
│   │   ├── cesium3d.js         # Frontend Cesium 3D logic
│   │   ├── config.js           # Frontend global config
│   │   ├── earthquake-filters-config.js # Filter UI settings
│   │   ├── filter-builder.js   # Logic to construct API queries
│   │   ├── filters.js          # Filter event listeners
│   │   ├── resize.js           # Window resize handlers
│   │   └── style.css           # Global application styles
│   ├── index.html              # Main entry point (2D Viewer)
│   ├── viewer3d.html           # Entry point for 3D Viewer
│   ├── main.js                 # Frontend application bootstrap
│   └── vite.config.js          # Vite build configuration
│
├── eq-infra/                   # AWS CDK Infrastructure as Code
│   ├── eq_infra/
│   │   ├── earthquake_stack.py # Defines AWS resources (EC2, RDS, VPC)
│   │   └── eq_infra_stack.py   # Infrastructure stack definition
│   ├── app.py                  # CDK Application entry point
│   ├── cdk.json                # CDK Context and settings
│   └── requirements.txt        # Python dependencies for CDK
│
├── docker-compose.yml          # Root orchestration
└── README.md                   # Project documentation


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


---

## Acknowledgments

This project is supported by the National Science Foundation through the Cascadia Region Earthquake Science Center (CRESCENT). We thank the many researchers who have contributed earthquake catalogs and methodological advances that make this repository possible.  

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
