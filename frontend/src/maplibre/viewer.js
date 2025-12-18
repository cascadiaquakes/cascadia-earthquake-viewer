import { getApiUrl } from '../config.js';
import { MAPLIBRE_CONFIG, EQ_LAYER_ID } from './config.js';
import { addEarthquakeLayer, addCascadiaBoundary } from './layers.js';

/**
 * Initialize MapLibre map with clustering support
 */
export function initMap(maplibregl) {
    const map = new maplibregl.Map({
        container: MAPLIBRE_CONFIG.container,
        style: MAPLIBRE_CONFIG.style,
        center: MAPLIBRE_CONFIG.center,
        zoom: MAPLIBRE_CONFIG.zoom,
        attributionControl: true
    });

    map.on('load', async () => {
        console.log('🗺️ Map loaded (clustered viewer.js)');

        // Cascadia outline
        addCascadiaBoundary(map);

        // ---- Fetch earthquake data and build GeoJSON ----
        try {
            console.log('🔄 Fetching earthquake data...');
            const response = await fetch(getApiUrl('/api/earthquakes?limit=50000'));
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
                        depth_km: eq.depth,
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

            // ---- Add clustered source + layers (from layers.js) ----
            addEarthquakeLayer(map, geojson);

            // ========== INTERACTION ==========
            // Cluster click → zoom in
            map.on('click', 'eq-clusters', (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['eq-clusters']
                });
                if (!features.length) return;

                const clusterId = features[0].properties.cluster_id;
                map.getSource('earthquakes').getClusterExpansionZoom(
                    clusterId,
                    (err, zoom) => {
                        if (err) return;
                        map.easeTo({
                            center: features[0].geometry.coordinates,
                            zoom: zoom + 0.3
                        });
                    }
                );
            });

            // Individual point click → update "Selected Event" + popup
            map.on('click', EQ_LAYER_ID, (e) => {
                const feature = e.features[0];
                const props = feature.properties;
                const coords = feature.geometry.coordinates.slice();

                // Selected event side panel
                const content = document.getElementById('selected-content');
                const empty = document.getElementById('selected-empty');

                if (content && empty) {
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
                                        ${Number(props.depth).toFixed(1)} <span style="font-size:10px;">km</span>
                                    </div>
                                </div>
                                <div style="background:#f8f9fa; padding:6px; border-radius:4px;">
                                    <div style="font-size:9px; color:#777; font-weight:600;">MAGNITUDE</div>
                                    <div style="font-size:14px; font-weight:700; color:#333;">
                                        ${props.mag ? Number(props.mag).toFixed(1) : 'N/A'}
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
                }

                // Small popup on the map
                new maplibregl.Popup({ closeButton: false })
                    .setLngLat(coords)
                    .setHTML(`
                        <strong>${Number(props.depth).toFixed(1)} km</strong><br>
                        <span style="opacity:0.7">${props.time.split(',')[0]}</span>
                    `)
                    .addTo(map);
            });

            // Cursor styling
            map.on('mouseenter', 'eq-clusters', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'eq-clusters', () => {
                map.getCanvas().style.cursor = '';
            });
            map.on('mouseenter', EQ_LAYER_ID, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', EQ_LAYER_ID, () => {
                map.getCanvas().style.cursor = '';
            });

            console.log(`✅ Loaded ${data.count} earthquakes with clustering`);

        } catch (error) {
            console.error('❌ Error loading earthquake data:', error);
        }
    });

    return map;
}