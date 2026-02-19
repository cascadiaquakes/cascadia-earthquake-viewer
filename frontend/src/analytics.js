// analytics.js (Chart.js v4)
// Clean compare mode (Primary bars + Overlay line for rate; distributions become lines when we comparing)
// CI/CD pipeline test

let timelineChart = null;
let magnitudeChart = null;
let depthChart = null;
let depthTimeChart = null;
let magnitudeTimeChart = null;

// ---------- helpers ----------
function shortLabel(name) {
    if (!name) return '';
    const m = name.match(/^(.+?)\s+et al\.\s*\((\d{4})\)/);
    if (m) return `${m[1]} ${m[2]}`;
    return name.split('—')[0].trim();
}

function setChartDefaultsOnce() {
    if (setChartDefaultsOnce._done) return;
    setChartDefaultsOnce._done = true;

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not found on window.Chart');
        return;
    }

    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.align = 'start';
}

// ---------- panel ----------
export function initAnalytics() {
    setChartDefaultsOnce();

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

    panel.addEventListener('click', (e) => e.stopPropagation());

    function closeAnalytics() {
        panel.classList.remove('open');
        overlay.classList.remove('active');
        showBtn.classList.remove('hidden');
    }
}

// ---------- update entry ----------
export function updateAnalytics(earthquakes, overlayCatalogs = []) {
    setChartDefaultsOnce();
    if (!earthquakes || earthquakes.length === 0) return;

    updateTimelineChart(earthquakes, overlayCatalogs);
    updateMagnitudeChart(earthquakes, overlayCatalogs);
    updateMagnitudeTimeChart(earthquakes, overlayCatalogs);
    updateDepthChart(earthquakes, overlayCatalogs);
    updateDepthTimeChart(earthquakes, overlayCatalogs);
}

function destroyIf(chart) {
    if (chart) chart.destroy();
    return null;
}

// ---------- CHART 1: EVENT RATE VS TIME ----------
function updateTimelineChart(earthquakes, overlayCatalogs = []) {
    const canvas = document.getElementById('chart-timeline');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    timelineChart = destroyIf(timelineChart);

    const isComparing = overlayCatalogs.length > 0;

    function getYearCounts(eqs) {
        const yearCounts = {};
        for (const eq of eqs) {
            const t = eq?.properties?.origin_time;
            if (!t) continue;
            const year = new Date(t).getFullYear();
            if (!Number.isFinite(year)) continue;
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
        return yearCounts;
    }

    const primaryCounts = getYearCounts(earthquakes);
    const primaryTotal = earthquakes.length;

    const allYears = new Set(Object.keys(primaryCounts).map(Number));
    const overlayData = overlayCatalogs.map(o => {
        const counts = getYearCounts(o.earthquakes || []);
        Object.keys(counts).forEach(y => allYears.add(Number(y)));
        return {
            name: o.name,
            short: shortLabel(o.name),
            counts,
            color: o.color,
            total: (o.earthquakes || []).length
        };
    });

    const years = Array.from(allYears).filter(Number.isFinite).sort((a, b) => a - b);

    // Primary as bars (muted) in compare mode; raw counts when not comparing.
    const datasets = [{
        type: 'bar',
        label: isComparing ? `Primary (${primaryTotal.toLocaleString()})` : '',
        data: years.map(y => {
            const c = primaryCounts[y] || 0;
            return isComparing ? (c / primaryTotal) * 100 : c;
        }),
        backgroundColor: isComparing ? 'rgba(14,116,144,0.18)' : 'rgba(14,116,144,0.7)',
        borderColor: 'rgba(14,116,144,1)',
        borderWidth: isComparing ? 2 : 1,
        order: 2
    }];

    // Overlays as lines
    for (const o of overlayData) {
        if (!o.total) continue;
        datasets.push({
            type: 'line',
            label: `${o.short} (${o.total.toLocaleString()})`,
            data: years.map(y => ((o.counts[y] || 0) / o.total) * 100),
            borderColor: o.color?.stroke || '#10b981',
            backgroundColor: o.color?.fill || 'rgba(16,185,129,0.25)',
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
            order: 1
        });
    }

    timelineChart = new Chart(ctx, {
        data: { labels: years, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: isComparing },
                title: {
                    display: isComparing,
                    text: 'Normalized: % of catalog per year',
                    font: { size: 11 },
                    color: '#64748b'
                },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const y = c.parsed?.y;
                            const label = c.dataset?.label ? `${c.dataset.label}: ` : '';
                            return `${label}${(y ?? 0).toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: isComparing ? '% of Catalog' : 'Number of Events' }
                },
                x: {
                    title: { display: true, text: 'Time' }
                }
            }
        }
    });
}

// ---------- CHART 2: MAGNITUDE DISTRIBUTION ----------
function updateMagnitudeChart(earthquakes, overlayCatalogs = []) {
    const canvas = document.getElementById('chart-magnitude');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    magnitudeChart = destroyIf(magnitudeChart);

    const isComparing = overlayCatalogs.length > 0;

    const bins = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const labels = bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i + 1]}`);

    function binMagnitudes(eqs) {
        const counts = new Array(bins.length - 1).fill(0);
        for (const eq of eqs) {
            const mag = eq?.properties?.mag;
            if (mag === null || mag === undefined || !Number.isFinite(mag)) continue;
            for (let i = 0; i < bins.length - 1; i++) {
                if (mag >= bins[i] && mag < bins[i + 1]) {
                    counts[i]++;
                    break;
                }
            }
        }
        return counts;
    }

    const primaryCounts = binMagnitudes(earthquakes);
    const primaryTotal = earthquakes.length;

    const datasets = [];

    if (isComparing) {
        // Lines in compare mode (cleaner)
        datasets.push({
            type: 'line',
            label: `Primary (${primaryTotal.toLocaleString()})`,
            data: primaryCounts.map(c => (c / primaryTotal) * 100),
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251,191,36,0.18)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5
        });

        for (const o of overlayCatalogs) {
            const total = (o.earthquakes || []).length;
            if (!total) continue;
            const counts = binMagnitudes(o.earthquakes);
            datasets.push({
                type: 'line',
                label: `${shortLabel(o.name)} (${total.toLocaleString()})`,
                data: counts.map(c => (c / total) * 100),
                borderColor: o.color?.stroke || '#10b981',
                backgroundColor: o.color?.fill || 'rgba(16,185,129,0.18)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5
            });
        }
    } else {
        // Bars when not comparing (simple)
        datasets.push({
            type: 'bar',
            label: '',
            data: primaryCounts,
            backgroundColor: 'rgba(251, 191, 36, 0.7)',
            borderColor: 'rgba(251, 191, 36, 1)',
            borderWidth: 1
        });
    }

    magnitudeChart = new Chart(ctx, {
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: isComparing },
                title: {
                    display: isComparing,
                    text: 'Normalized: % of catalog per magnitude bin',
                    font: { size: 11 },
                    color: '#64748b'
                },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const y = c.parsed?.y ?? c.raw;
                            const label = c.dataset?.label ? `${c.dataset.label}: ` : '';
                            return isComparing
                                ? `${label}${(y ?? 0).toFixed(2)}%`
                                : `${label}${y ?? 0}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: isComparing ? '% of Catalog' : 'Number of Events' }
                },
                x: {
                    title: { display: true, text: 'Magnitude Range' }
                }
            }
        }
    });
}

// ---------- CHART 3: MAGNITUDE VS TIME ----------
function updateMagnitudeTimeChart(earthquakes, overlayCatalogs = []) {
    const canvas = document.getElementById('chart-magnitude-time');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    magnitudeTimeChart = destroyIf(magnitudeTimeChart);

    const isComparing = overlayCatalogs.length > 0;

    function extractMagTimeData(eqs) {
        const out = [];
        for (const eq of eqs) {
            const t = eq?.properties?.origin_time;
            const m = eq?.properties?.mag;
            if (!t || m === null || m === undefined || !Number.isFinite(m)) continue;
            out.push({ x: new Date(t), y: m });
        }
        return out;
    }

    const primaryTotal = earthquakes.length;

    const datasets = [{
        label: isComparing ? `Primary (${primaryTotal.toLocaleString()})` : '',
        data: extractMagTimeData(earthquakes),
        backgroundColor: isComparing ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.4)',
        borderColor: isComparing ? 'rgba(251,191,36,0.25)' : 'rgba(251,191,36,0.7)',
        pointRadius: isComparing ? 1 : 2,
        pointHoverRadius: 4
    }];

    for (const o of overlayCatalogs) {
        const total = (o.earthquakes || []).length;
        if (!total) continue;
        datasets.push({
            label: `${shortLabel(o.name)} (${total.toLocaleString()})`,
            data: extractMagTimeData(o.earthquakes),
            backgroundColor: o.color?.fill || 'rgba(16,185,129,0.25)',
            borderColor: o.color?.stroke || '#10b981',
            pointRadius: 3,
            pointHoverRadius: 5
        });
    }

    magnitudeTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: isComparing },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const date = c.raw?.x ? new Date(c.raw.x).toISOString().slice(0, 10) : '';
                            const label = c.dataset?.label ? `${c.dataset.label.split('(')[0].trim()}: ` : '';
                            return `${label}${date}, Mag: ${Number(c.parsed.y).toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'year', tooltipFormat: 'yyyy-MM-dd' },
                    title: { display: true, text: 'Time' }
                },
                y: {
                    title: { display: true, text: 'Magnitude' }
                }
            }
        }
    });
}

// ---------- CHART 4: DEPTH DISTRIBUTION ----------
function updateDepthChart(earthquakes, overlayCatalogs = []) {
    const canvas = document.getElementById('chart-depth');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    depthChart = destroyIf(depthChart);

    const isComparing = overlayCatalogs.length > 0;

    const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const labels = bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i + 1]}`);

    function binDepths(eqs) {
        const counts = new Array(bins.length - 1).fill(0);
        for (const eq of eqs) {
            const d = eq?.properties?.depth;
            if (d === null || d === undefined || !Number.isFinite(d)) continue;
            for (let i = 0; i < bins.length - 1; i++) {
                if (d >= bins[i] && d < bins[i + 1]) {
                    counts[i]++;
                    break;
                }
            }
        }
        return counts;
    }

    const primaryCounts = binDepths(earthquakes);
    const primaryTotal = earthquakes.length;

    const datasets = [];

    if (isComparing) {
        datasets.push({
            type: 'line',
            label: `Primary (${primaryTotal.toLocaleString()})`,
            data: primaryCounts.map(c => (c / primaryTotal) * 100),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220,38,38,0.18)',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 5
        });

        for (const o of overlayCatalogs) {
            const total = (o.earthquakes || []).length;
            if (!total) continue;
            const counts = binDepths(o.earthquakes);
            datasets.push({
                type: 'line',
                label: `${shortLabel(o.name)} (${total.toLocaleString()})`,
                data: counts.map(c => (c / total) * 100),
                borderColor: o.color?.stroke || '#10b981',
                backgroundColor: o.color?.fill || 'rgba(16,185,129,0.18)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5
            });
        }
    } else {
        datasets.push({
            type: 'bar',
            label: '',
            data: primaryCounts,
            backgroundColor: 'rgba(220, 38, 38, 0.7)',
            borderColor: 'rgba(220, 38, 38, 1)',
            borderWidth: 1
        });
    }

    depthChart = new Chart(ctx, {
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: isComparing },
                title: {
                    display: isComparing,
                    text: 'Normalized: % of catalog per depth bin',
                    font: { size: 11 },
                    color: '#64748b'
                },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const y = c.parsed?.y ?? c.raw;
                            const label = c.dataset?.label ? `${c.dataset.label}: ` : '';
                            return isComparing
                                ? `${label}${(y ?? 0).toFixed(2)}%`
                                : `${label}${y ?? 0}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: isComparing ? '% of Catalog' : 'Number of Events' }
                },
                x: {
                    title: { display: true, text: 'Depth Range (km)' }
                }
            }
        }
    });
}

// ---------- CHART 5: DEPTH VS TIME ----------
function updateDepthTimeChart(earthquakes, overlayCatalogs = []) {
    const canvas = document.getElementById('chart-depth-time');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    depthTimeChart = destroyIf(depthTimeChart);

    const isComparing = overlayCatalogs.length > 0;

    function extractDepthTimeData(eqs) {
        const out = [];
        for (const eq of eqs) {
            const t = eq?.properties?.origin_time;
            const d = eq?.properties?.depth;
            if (!t || d === null || d === undefined || !Number.isFinite(d)) continue;
            out.push({ x: new Date(t), y: d });
        }
        return out;
    }

    const primaryTotal = earthquakes.length;

    const datasets = [{
        label: isComparing ? `Primary (${primaryTotal.toLocaleString()})` : '',
        data: extractDepthTimeData(earthquakes),
        backgroundColor: isComparing ? 'rgba(14,116,144,0.15)' : 'rgba(14,116,144,0.4)',
        borderColor: isComparing ? 'rgba(14,116,144,0.25)' : 'rgba(14,116,144,0.7)',
        pointRadius: isComparing ? 1 : 2,
        pointHoverRadius: 4
    }];

    for (const o of overlayCatalogs) {
        const total = (o.earthquakes || []).length;
        if (!total) continue;
        datasets.push({
            label: `${shortLabel(o.name)} (${total.toLocaleString()})`,
            data: extractDepthTimeData(o.earthquakes),
            backgroundColor: o.color?.fill || 'rgba(16,185,129,0.25)',
            borderColor: o.color?.stroke || '#10b981',
            pointRadius: 3,
            pointHoverRadius: 5
        });
    }

    depthTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: isComparing },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const date = c.raw?.x ? new Date(c.raw.x).toISOString().slice(0, 10) : '';
                            const label = c.dataset?.label ? `${c.dataset.label.split('(')[0].trim()}: ` : '';
                            return `${label}${date}, Depth: ${Number(c.parsed.y).toFixed(2)} km`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'year', tooltipFormat: 'yyyy-MM-dd' },
                    title: { display: true, text: 'Time' }
                },
                y: {
                    reverse: true,
                    title: { display: true, text: 'Depth (km)' }
                }
            }
        }
    });
}

window.updateAnalytics = updateAnalytics;
