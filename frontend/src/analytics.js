let timelineChart = null;
let magnitudeChart = null;
let depthChart = null;
let depthTimeChart = null;

export function initAnalytics() {
    const showBtn = document.getElementById('show-analytics');
    const closeBtn = document.getElementById('close-analytics');
    const panel = document.getElementById('analytics-panel');
    const overlay = document.getElementById('analytics-overlay');
    
    if (!showBtn || !closeBtn || !panel || !overlay) {
        console.warn('Analytics elements not found');
        return;
    }
    
    showBtn.addEventListener('click', () => {
        panel.classList.add('open');
        overlay.classList.add('active');
        showBtn.classList.add('hidden');
    });
    
    closeBtn.addEventListener('click', closeAnalytics);
    overlay.addEventListener('click', closeAnalytics);
    
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    function closeAnalytics() {
        panel.classList.remove('open');
        overlay.classList.remove('active');
        showBtn.classList.remove('hidden');
    }
}

export function updateAnalytics(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) return;
    
    updateTimelineChart(earthquakes);
    updateMagnitudeChart(earthquakes);
    updateDepthChart(earthquakes);
    updateDepthTimeChart(earthquakes);
}

function updateTimelineChart(earthquakes) {
    const yearCounts = {};
    
    earthquakes.forEach(eq => {
        const year = new Date(eq.properties.origin_time).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    const years = Object.keys(yearCounts).sort((a, b) => a - b);
    const counts = years.map(year => yearCounts[year]);
    
    const canvas = document.getElementById('chart-timeline');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (timelineChart) {
        timelineChart.destroy();
    }
    
    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Events per Year',
                data: counts,
                backgroundColor: 'rgba(14, 116, 144, 0.7)',
                borderColor: 'rgba(14, 116, 144, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Number of Events' }
                },
                x: {
                    type: 'category',
                    title: { display: true, text: 'Year' }
                }
            }
        }
    });
}

function updateMagnitudeChart(earthquakes) {
    const magnitudes = earthquakes
        .map(eq => eq.properties.mag)
        .filter(mag => mag !== null && mag !== undefined);
    
    const bins = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const counts = new Array(bins.length - 1).fill(0);
    
    magnitudes.forEach(mag => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (mag >= bins[i] && mag < bins[i + 1]) {
                counts[i]++;
                break;
            }
        }
    });
    
    const labels = bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i + 1]}`);
    
    const canvas = document.getElementById('chart-magnitude');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (magnitudeChart) {
        magnitudeChart.destroy();
    }
    
    magnitudeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Event Count',
                data: counts,
                backgroundColor: 'rgba(251, 191, 36, 0.7)',
                borderColor: 'rgba(251, 191, 36, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Number of Events' }
                },
                x: {
                    title: { display: true, text: 'Magnitude Range' }
                }
            }
        }
    });
}

function updateDepthChart(earthquakes) {
    const depths = earthquakes.map(eq => eq.properties.depth);
    
    const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const counts = new Array(bins.length - 1).fill(0);
    
    depths.forEach(depth => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (depth >= bins[i] && depth < bins[i + 1]) {
                counts[i]++;
                break;
            }
        }
    });
    
    const labels = bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i + 1]}`);
    
    const canvas = document.getElementById('chart-depth');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (depthChart) {
        depthChart.destroy();
    }
    
    depthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Event Count',
                data: counts,
                backgroundColor: 'rgba(220, 38, 38, 0.7)',
                borderColor: 'rgba(220, 38, 38, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Number of Events' }
                },
                x: {
                    title: { display: true, text: 'Depth Range (km)' }
                }
            }
        }
    });
}

function updateDepthTimeChart(earthquakes, options = {}) {
    const {
        catalogId = null,
        depthSplitKm = 2,
        reservoirDepthKm = null
    } = options;

    const shallow = [];
    const deep = [];

    earthquakes.forEach(eq => {
        const time = eq.properties?.origin_time;
        const depth = eq.properties?.depth;
        const catId = eq.properties?.catalog_id;

        if (!time || depth == null) return;
        if (catalogId !== null && catId !== catalogId) return;

        const point = {
            x: new Date(time),
            y: depth
        };

        if (depth <= depthSplitKm) {
            shallow.push(point);
        } else {
            deep.push(point);
        }
    });

    const canvas = document.getElementById('chart-depth-time');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (depthTimeChart) {
        depthTimeChart.destroy();
    }

    depthTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: `Shallow (≤ ${depthSplitKm} km BSL)`,
                    data: shallow,
                    backgroundColor: 'rgba(234, 88, 12, 0.35)',
                    pointRadius: 2
                },
                {
                    label: `Deep (> ${depthSplitKm} km BSL)`,
                    data: deep,
                    backgroundColor: 'rgba(37, 99, 235, 0.35)',
                    pointRadius: 2
                },
                ...(reservoirDepthKm !== null ? [{
                    label: 'Estimated magma reservoir top',
                    data: shallow.map(p => ({ x: p.x, y: reservoirDepthKm })),
                    type: 'line',
                    borderColor: 'rgba(220, 38, 38, 0.7)',
                    borderDash: [6, 4],
                    pointRadius: 0
                }] : [])
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const d = ctx.parsed;
                            return `Date: ${ctx.raw.x.toISOString().slice(0,10)}, Depth: ${d.y.toFixed(2)} km BSL`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'year',
                        tooltipFormat: 'yyyy-MM-dd'
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    reverse: true,
                    title: {
                        display: true,
                        text: 'Depth below sea level (km)'
                    }
                }
            }
        }
    });
}

window.updateAnalytics = updateAnalytics;