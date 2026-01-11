let timelineChart = null;
let magnitudeChart = null;
let depthChart = null;
let depthTimeChart = null;
let magnitudeTimeChart = null;

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
    updateMagnitudeTimeChart(earthquakes);
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
                borderWidth: 1,
                barPercentage: 0.8,  // Makes bars narrower when few years
                categoryPercentage: 0.9
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
                    title: { display: true, text: 'Time' }  // CHANGED from "Year"
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

function updateMagnitudeTimeChart(earthquakes) {
    // Filter events with valid magnitude and time
    const data = earthquakes
        .filter(eq => eq.properties.mag !== null && eq.properties.mag !== undefined && eq.properties.origin_time)
        .map(eq => ({
            x: new Date(eq.properties.origin_time),
            y: eq.properties.mag
        }));

    const canvas = document.getElementById('chart-magnitude-time');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (magnitudeTimeChart) {
        magnitudeTimeChart.destroy();
    }

    magnitudeTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: data,
                backgroundColor: 'rgba(251, 191, 36, 0.4)',
                borderColor: 'rgba(251, 191, 36, 0.6)',
                pointRadius: 2,
                pointHoverRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const date = ctx.raw.x.toISOString().slice(0, 10);
                            return `Date: ${date}, Magnitude: ${ctx.parsed.y.toFixed(2)}`;
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
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
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

function updateDepthTimeChart(earthquakes) {
    // Single dataset, no shallow/deep split
    const data = earthquakes
        .filter(eq => eq.properties.origin_time && eq.properties.depth)
        .map(eq => ({
            x: new Date(eq.properties.origin_time),
            y: eq.properties.depth
        }));

    const canvas = document.getElementById('chart-depth-time');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (depthTimeChart) {
        depthTimeChart.destroy();
    }

    depthTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: data,
                backgroundColor: 'rgba(14, 116, 144, 0.4)',
                borderColor: 'rgba(14, 116, 144, 0.6)',
                pointRadius: 2,
                pointHoverRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },  // REMOVED shallow/deep legend
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const date = ctx.raw.x.toISOString().slice(0,10);
                            return `Date: ${date}, Depth: ${ctx.parsed.y.toFixed(2)} km`;
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
                        text: 'Depth (km)'  // CHANGED from "Depth below sea level"
                    }
                }
            }
        }
    });
}

window.updateAnalytics = updateAnalytics;