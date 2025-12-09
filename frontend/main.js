import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initFilters } from './src/filters.js';

/* Map initialization */
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri'
            }
        },
        layers: [
            {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                paint: { 'raster-opacity': 1 }
            }
        ]
    },
    center: [-124.5, 46.5],
    zoom: 5.2,
    attributionControl: true
});

/* Map controls */
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(
    new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
    'bottom-left'
);

/* Zoom level display */
function updateZoomDisplay() {
    const zoomBox = document.getElementById('zoom-level-display');
    if (zoomBox) {
        zoomBox.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
    }
}

map.on('load', async () => {
    updateZoomDisplay();
    map.on('move', updateZoomDisplay);

    /* Cascadia study region boundary */
    map.addSource('cascadia-boundary', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-130.0, 39.0],
                    [-116.0, 39.0],
                    [-116.0, 52.0],
                    [-130.0, 52.0],
                    [-130.0, 39.0]
                ]]
            }
        }
    });

    map.addLayer({
        id: 'cascadia-line',
        type: 'line',
        source: 'cascadia-boundary',
        paint: {
            'line-color': '#00FFFF',
            'line-width': 1.5,
            'line-opacity': 0.8
        }
    });

    /* Earthquake data load with clustering */
    try {
        console.log('🔄 Fetching earthquake data...');
        const response = await fetch('/geojson/earthquakes.json');
        const data = await response.json();

        const geojson = {
            type: 'FeatureCollection',
            features: data.earthquakes.map(eq => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [eq.longitude, eq.latitude]
                },
                properties: {
                    depth: eq.depth,
                    mag: eq.magnitude,
                    id: eq.evid,
                    region: eq.region,
                    time: new Date(eq.origin_time).toLocaleString(),
                    nsta: eq.nsta,
                    gap: eq.gap,
                    max_err: eq.max_err,
                    origin_time: eq.origin_time
                }
            }))
        };

        /* Add source with clustering enabled */
        map.addSource('earthquakes', {
            type: 'geojson',
            data: geojson,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        /* Cluster circles - LOCI style */
        map.addLayer({
            id: 'eq-clusters',
            type: 'circle',
            source: 'earthquakes',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    100,
                    '#3b9fc4',
                    750,
                    '#2a7db3'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100,
                    30,
                    750,
                    40
                ],
                'circle-opacity': 0.85,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        /* Cluster count labels */
        map.addLayer({
            id: 'eq-cluster-count',
            type: 'symbol',
            source: 'earthquakes',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                'text-size': 12
            },
            paint: {
                'text-color': '#ffffff'
            }
        });

        /* Individual earthquake points */
        map.addLayer({
            id: 'eq-points',
            type: 'circle',
            source: 'earthquakes',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'depth'],
                    '#fbbf24', 20,
                    '#f97316', 40,
                    '#dc2626'
                ],
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    4, 2.5,
                    10, 6
                ],
                'circle-opacity': 0.7,
                'circle-stroke-width': 0
            }
        });

        /* Click cluster to zoom in */
        map.on('click', 'eq-clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['eq-clusters']
            });
            const clusterId = features[0].properties.cluster_id;
            
            map.getSource('earthquakes').getClusterExpansionZoom(
                clusterId,
                (err, zoom) => {
                    if (err) return;
                    map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom
                    });
                }
            );
        });

        /* Click individual point - update panel */
        map.on('click', 'eq-points', e => {
            const props = e.features[0].properties;

            const content = document.getElementById('selected-content');
            const empty = document.getElementById('selected-empty');

            content.innerHTML = `
                <div style="padding-bottom: 4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:11px; font-weight:700; color:#0b4a53; background:#e0f2fe; padding:2px 6px; border-radius:4px;">
                            REGION ${props.region}
                        </span>
                        <span style="font-size:10px; color:#999;">${props.id}</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <div style="background:#f8f9fa; padding:6px; border-radius:4px;">
                            <div style="font-size:9px; color:#777; font-weight:600;">DEPTH</div>
                            <div style="font-size:14px; font-weight:700; color:#333;">
                                ${props.depth.toFixed(1)} <span style="font-size:10px;">km</span>
                            </div>
                        </div>
                        <div style="background:#f8f9fa; padding:6px; border-radius:4px;">
                            <div style="font-size:9px; color:#777; font-weight:600;">MAGNITUDE</div>
                            <div style="font-size:14px; font-weight:700; color:#333;">
                                ${props.mag ? props.mag.toFixed(1) : 'N/A'}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:8px; font-size:10px; color:#666;">
                        ${props.time}
                    </div>
                </div>
            `;
            content.classList.remove('d-none');
            empty.classList.add('d-none');
        });

        /* Cursor styling */
        map.on('mouseenter', 'eq-clusters', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'eq-clusters', () => {
            map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', 'eq-points', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'eq-points', () => {
            map.getCanvas().style.cursor = '';
        });

        console.log(`✅ Loaded ${data.count} earthquakes with clustering`);

    } catch (error) {
        console.error('❌ Error loading map data:', error);
    }

    initFilters(map);
});

/* Export of filtered earthquakes */
window.downloadFilteredData = function (format) {
    const features = map.queryRenderedFeatures({ layers: ['eq-points'] });

    if (features.length === 0) {
        alert('No earthquakes visible in current view. Adjust filters or zoom out.');
        return;
    }

    if (format === 'geojson') {
        downloadAsGeoJSON(features);
    } else if (format === 'csv') {
        downloadAsCSV(features);
    }
};

/* GeoJSON export */
function downloadAsGeoJSON(features) {
    const geojson = {
        type: 'FeatureCollection',
        features: features.map(f => ({
            type: 'Feature',
            geometry: f.geometry,
            properties: f.properties
        }))
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascadia-earthquakes-${new Date()
        .toISOString()
        .split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`✅ Downloaded ${features.length} earthquakes as GeoJSON`);
}

/* CSV export */
function downloadAsCSV(features) {
    const headers = [
        'evid',
        'latitude',
        'longitude',
        'depth_km',
        'magnitude',
        'origin_time',
        'region',
        'nsta',
        'gap',
        'max_err'
    ];

    let csv = headers.join(',') + '\n';

    features.forEach(f => {
        const p = f.properties;
        const coords = f.geometry.coordinates;
        const row = [
            p.id || '',
            coords[1].toFixed(4),
            coords[0].toFixed(4),
            p.depth ? p.depth.toFixed(2) : '',
            p.mag ? p.mag.toFixed(1) : '',
            p.origin_time || '',
            `"${p.region || ''}"`,
            p.nsta || '',
            p.gap ? p.gap.toFixed(1) : '',
            p.max_err ? p.max_err.toFixed(2) : ''
        ].join(',');
        csv += row + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascadia-earthquakes-${new Date()
        .toISOString()
        .split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`✅ Downloaded ${features.length} earthquakes as CSV`);
}