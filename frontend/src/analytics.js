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
    
    // CRITICAL: Stop clicks inside panel from closing it
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
    
    const years = Object.keys(yearCounts).sort();
    const counts = years.map(year => yearCounts[year]);
    
    const canvas = document.getElementById('chart-timeline');
    if (!canvas) {
        console.warn('Timeline chart canvas not found');
        return;
    }
    
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
                    title: { display: true, text: 'Year' },
                    ticks: {
                        callback: function(value) {
                            return Math.floor(value); // Remove decimals and commas
                        }
                    }
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
    if (!canvas) {
        console.warn('Magnitude chart canvas not found');
        return;
    }
    
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
    if (!canvas) {
        console.warn('Depth chart canvas not found');
        return;
    }
    
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
    // Time on X-axis, Depth on Y-axis
    const data = earthquakes
        .filter(eq => eq.properties.origin_time && eq.properties.depth)
        .map(eq => ({
            x: new Date(eq.properties.origin_time).getFullYear(),
            y: eq.properties.depth
        }));
    
    const canvas = document.getElementById('chart-depth-time');
    if (!canvas) {
        console.warn('Depth-time chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (depthTimeChart) {
        depthTimeChart.destroy();
    }
    
    depthTimeChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Earthquake Depth',
                data: data,
                backgroundColor: 'rgba(14, 116, 144, 0.5)',
                borderColor: 'rgba(14, 116, 144, 1)',
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Year: ${context.parsed.x}, Depth: ${context.parsed.y.toFixed(1)} km`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'logarithmic',  // Logarithmic scale for better differentiation
                    beginAtZero: false,
                    min: 0.1,  // Start slightly above 0 for log scale
                    title: { 
                        display: true, 
                        text: 'Depth (km) - Log Scale' 
                    },
                    ticks: {
                        callback: function(value) {
                            // Show clean numbers: 0.1, 1, 10, 100
                            if (value === 0.1 || value === 1 || value === 10 || value === 100) {
                                return value;
                            }
                            return null;
                        }
                    }
                },
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Year' },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return Math.floor(value);  // Integer years only, no commas
                        }
                    }
                }
            }
        }
    });
}

// Make updateAnalytics available globally
window.updateAnalytics = updateAnalytics;