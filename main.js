// Global variables
let data = [];
let currentYear = 2015;
let sliderPosition = 50;
let isDragging = false;
const years = [2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070, 2075, 2080, 2085, 2090, 2095, 2100];

// Precipitation range for color scale (mm/day)
const PRECIP_MIN = 0.1;
const PRECIP_MAX = 1.5;

// World map image variables
let worldMapImage = null;
let mapImageLoaded = false;

// DOM elements
let canvasLeft, canvasRight, mapContainer, sliderLine, rightMapContainer;
let yearSlider, yearDisplay, prevYearBtn, nextYearBtn, colorScale, lineCanvas;

// Derived data
let yearlyAverages = [];

// Line chart hover data
let linePoints = [];
let hoverPoint = null;
let tooltip = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing...');

    // Get DOM elements
    canvasLeft = document.getElementById('canvasLeft');
    canvasRight = document.getElementById('canvasRight');
    mapContainer = document.getElementById('mapContainer');
    sliderLine = document.getElementById('sliderLine');
    rightMapContainer = document.getElementById('rightMapContainer');
    yearSlider = document.getElementById('yearSlider');
    yearDisplay = document.getElementById('yearDisplay');
    prevYearBtn = document.getElementById('prevYear');
    nextYearBtn = document.getElementById('nextYear');
    colorScale = document.getElementById('colorScale');
    lineCanvas = document.getElementById('lineCanvas');

    // Create tooltip div
    tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Initialize
    init();
});

function init() {
    console.log('Initializing application...');

    // Set canvas sizes
    resizeCanvas();
    resizeChart();
    window.addEventListener('resize', () => {
        resizeCanvas();
        resizeChart();
    });

    // Setup event listeners
    setupEventListeners();

    // Draw color scale
    drawColorScale();

    // Load world map image
    loadWorldMapImage();

    // Load the actual CSV file
    loadCSV('precip_5yr_cesm2waccm_ncar.csv');

    console.log('Initialization started, loading data...');
}

function resizeCanvas() {
    const container = mapContainer;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Set canvas resolution
    canvasLeft.width = width;
    canvasLeft.height = height;
    canvasRight.width = width;
    canvasRight.height = height;

    console.log('Canvas resized to:', width, 'x', height);

    // Redraw if data exists
    if (data.length > 0) {
        updateMaps();
    }
}

function resizeChart() {
    if (!lineCanvas) return;
    const width = lineCanvas.clientWidth;
    const height = lineCanvas.clientHeight;
    lineCanvas.width = width;
    lineCanvas.height = height;

    if (yearlyAverages.length > 0) {
        drawLineChart();
    }
}

// Load world map image
function loadWorldMapImage() {
    worldMapImage = new Image();
    worldMapImage.crossOrigin = 'anonymous';
    worldMapImage.onload = function () {
        mapImageLoaded = true;
        console.log('World map image loaded');
        updateMaps();
    };
    worldMapImage.src = 'worldImage.png';
}

// Load CSV file
async function loadCSV(filePath) {
    try {
        console.log('Loading CSV from:', filePath);

        // Show loading message
        const ctxLeft = canvasLeft.getContext('2d');
        const ctxRight = canvasRight.getContext('2d');

        ctxLeft.fillStyle = '#1a1a2e';
        ctxLeft.fillRect(0, 0, canvasLeft.width, canvasLeft.height);
        ctxLeft.fillStyle = 'white';
        ctxLeft.font = '20px Arial';
        ctxLeft.fillText('Loading data...', 20, 40);

        ctxRight.fillStyle = '#1a1a2e';
        ctxRight.fillRect(0, 0, canvasRight.width, canvasRight.height);
        ctxRight.fillStyle = 'white';
        ctxRight.font = '20px Arial';
        ctxRight.fillText('Loading data...', 20, 40);

        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        const lines = csvText.trim().split('\n');

        console.log('CSV loaded, parsing', lines.length, 'lines...');

        data = [];
        // Skip header line (index 0)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',');
            if (values.length >= 5) {
                data.push({
                    year: parseInt(values[0]),
                    lat: parseFloat(values[1]),
                    lon: parseFloat(values[2]),
                    pr_mm_day: parseFloat(values[3]),
                    scenario: values[4].trim()
                });
            }
        }

        console.log('CSV parsed successfully:', data.length, 'data points');
        console.log('Sample data point:', data[0]);
        console.log('Unique years:', [...new Set(data.map(d => d.year))]);
        console.log('Unique scenarios:', [...new Set(data.map(d => d.scenario))]);

        computeYearlyAverages();
        resizeChart();
        drawLineChart();
        updateMaps();
    } catch (error) {
        console.error('Error loading CSV:', error);

        const ctxLeft = canvasLeft.getContext('2d');
        const ctxRight = canvasRight.getContext('2d');

        ctxLeft.fillStyle = '#1a1a2e';
        ctxLeft.fillRect(0, 0, canvasLeft.width, canvasLeft.height);
        ctxLeft.fillStyle = 'red';
        ctxLeft.font = '16px Arial';
        ctxLeft.fillText('Error loading data file!', 20, 40);
        ctxLeft.fillText('Check console for details', 20, 65);

        ctxRight.fillStyle = '#1a1a2e';
        ctxRight.fillRect(0, 0, canvasRight.width, canvasRight.height);
        ctxRight.fillStyle = 'red';
        ctxRight.font = '16px Arial';
        ctxRight.fillText('Error loading data file!', 20, 40);
        ctxRight.fillText('Check console for details', 20, 65);
    }
}

function setupEventListeners() {
    // Year controls
    yearSlider.addEventListener('input', e => {
        currentYear = years[parseInt(e.target.value)];
        yearDisplay.textContent = currentYear;
        updateMaps();
        updateYearButtons();
    });

    prevYearBtn.addEventListener('click', () => {
        const idx = years.indexOf(currentYear);
        if (idx > 0) {
            currentYear = years[idx - 1];
            yearSlider.value = idx - 1;
            yearDisplay.textContent = currentYear;
            updateMaps();
            updateYearButtons();
        }
    });

    nextYearBtn.addEventListener('click', () => {
        const idx = years.indexOf(currentYear);
        if (idx < years.length - 1) {
            currentYear = years[idx + 1];
            yearSlider.value = idx + 1;
            yearDisplay.textContent = currentYear;
            updateMaps();
            updateYearButtons();
        }
    });

    // Map slider
    mapContainer.addEventListener('mousedown', e => {
        isDragging = true;
        updateSliderPosition(e);
    });

    document.addEventListener('mousemove', e => {
        if (isDragging) {
            updateSliderPosition(e);
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch events
    mapContainer.addEventListener('touchstart', e => {
        isDragging = true;
        updateSliderPosition(e.touches[0]);
        e.preventDefault();
    });

    document.addEventListener('touchmove', e => {
        if (isDragging) {
            updateSliderPosition(e.touches[0]);
            e.preventDefault();
        }
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Line chart hover events
    if (lineCanvas) {
        lineCanvas.addEventListener('mousemove', handleLineHover);
        lineCanvas.addEventListener('mouseleave', () => {
            hoverPoint = null;
            hideTooltip();
            drawLineChart();
        });
    }
}

function updateSliderPosition(e) {
    const rect = mapContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    sliderPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));

    sliderLine.style.left = `${sliderPosition}%`;
    rightMapContainer.style.clipPath = `inset(0 0 0 ${sliderPosition}%)`;
}

function updateYearButtons() {
    const idx = years.indexOf(currentYear);
    prevYearBtn.disabled = idx === 0;
    nextYearBtn.disabled = idx === years.length - 1;
}

// Blue sequential precipitation colormap (light → dark blue)
function getColor(value) {
    const min = PRECIP_MIN;
    const max = PRECIP_MAX;
    const tRaw = (value - min) / (max - min);
    const t = Math.max(0, Math.min(1, tRaw));

    const colors = [
        { r: 247, g: 251, b: 255 }, // very light blue / near white (low)
        { r: 107, g: 174, b: 214 }, // medium blue
        { r: 8,   g: 81,  b: 156 }  // dark blue (high)
    ];

    const idx = t * (colors.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(colors.length - 1, i0 + 1);
    const f = idx - i0;

    const r = Math.round(colors[i0].r + (colors[i1].r - colors[i0].r) * f);
    const g = Math.round(colors[i0].g + (colors[i1].g - colors[i0].g) * f);
    const b = Math.round(colors[i0].b + (colors[i1].b - colors[i0].b) * f);

    return `rgb(${r}, ${g}, ${b})`;
}

// compute averages per year per scenario (ssp126, ssp245)
function computeYearlyAverages() {
    const sums = { ssp126: {}, ssp245: {} };
    const counts = { ssp126: {}, ssp245: {} };

    data.forEach(d => {
        const scen = (d.scenario || '').toLowerCase();
        let key = null;
        if (scen.includes('126')) key = 'ssp126';
        else if (scen.includes('245')) key = 'ssp245';
        if (!key) return;

        const y = d.year;
        if (!sums[key][y]) {
            sums[key][y] = 0;
            counts[key][y] = 0;
        }
        sums[key][y] += d.pr_mm_day;
        counts[key][y] += 1;
    });

    yearlyAverages = years
        .map(y => ({
            year: y,
            ssp126: sums.ssp126[y] !== undefined ? sums.ssp126[y] / counts.ssp126[y] : null,
            ssp245: sums.ssp245[y] !== undefined ? sums.ssp245[y] / counts.ssp245[y] : null
        }))
        .filter(d => d.ssp126 !== null || d.ssp245 !== null);
}

function drawLineChart() {
    if (!lineCanvas || yearlyAverages.length === 0) return;

    const ctx = lineCanvas.getContext('2d');
    const width = lineCanvas.width;
    const height = lineCanvas.height;

    // reset stored points for hit detection
    linePoints = [];

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 30;

    const x0 = paddingLeft;
    const y0 = height - paddingBottom;
    const x1 = width - paddingRight;
    const y1 = paddingTop;

    const minYear = yearlyAverages[0].year;
    const maxYear = yearlyAverages[yearlyAverages.length - 1].year;

    const allVals = [];
    yearlyAverages.forEach(d => {
        if (d.ssp126 !== null) allVals.push(d.ssp126);
        if (d.ssp245 !== null) allVals.push(d.ssp245);
    });
    if (allVals.length === 0) return;

    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);
    if (minVal === maxVal) {
        minVal *= 0.9;
        maxVal *= 1.1;
    }

    const xScale = year =>
        x0 + ((year - minYear) / (maxYear - minYear || 1)) * (x1 - x0);

    const yScale = val =>
        y0 - ((val - minVal) / (maxVal - minVal || 1)) * (y0 - y1);

    // Axes
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();

    // Y ticks
    const yTicks = 3;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= yTicks; i++) {
        const t = i / yTicks;
        const val = minVal + t * (maxVal - minVal);
        const y = yScale(val);

        ctx.fillText(val.toFixed(2), x0 - 8, y);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9ca3af';
    yearlyAverages.forEach(d => {
        const x = xScale(d.year);
        ctx.fillText(d.year, x, y0 + 4);
    });

    function drawScenarioLine(prop, color, scenarioLabel) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;

        yearlyAverages.forEach(d => {
            const val = d[prop];
            if (val === null) return;
            const x = xScale(d.year);
            const y = yScale(val);

            // add this point to the hit-test list
            linePoints.push({
                x,
                y,
                year: d.year,
                scenario: scenarioLabel,
                value: val
            });

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        if (started) ctx.stroke();

        ctx.fillStyle = color;
        yearlyAverages.forEach(d => {
            const val = d[prop];
            if (val === null) return;
            const x = xScale(d.year);
            const y = yScale(val);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    // Draw both scenarios
    drawScenarioLine('ssp126', '#38bdf8', 'SSP126'); // blue/cyan
    drawScenarioLine('ssp245', '#f97316', 'SSP245'); // orange

    // Title
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Average precipitation (mm/day) by year', x0, paddingTop - 22);

    // Legend
    const legendX = x1 - 140;
    const legendY = y1 - 20;

    ctx.font = '12px Arial';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(legendX, legendY, 20, 3);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('SSP126', legendX + 30, legendY + 1);

    ctx.fillStyle = '#f97316';
    ctx.fillRect(legendX, legendY + 18, 20, 3);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText('SSP245', legendX + 30, legendY + 19);

    // Highlight hovered point, if any
    if (hoverPoint) {
        ctx.save();
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hoverPoint.x, hoverPoint.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function drawMap(canvas, scenario) {
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Figure out where the map image will be drawn (preserve aspect ratio)
    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (mapImageLoaded && worldMapImage) {
        const imgW = worldMapImage.width;
        const imgH = worldMapImage.height;
        const imgAspect = imgW / imgH;
        const canvasAspect = width / height;

        if (canvasAspect > imgAspect) {
            // Canvas is wider than image → fit height, letterbox left/right
            drawHeight = height;
            drawWidth = height * imgAspect;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
        } else {
            // Canvas is taller than image → fit width, letterbox top/bottom
            drawWidth = width;
            drawHeight = width / imgAspect;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
        }

        // Draw world map image with correct proportions
        ctx.globalAlpha = 0.6;
        ctx.drawImage(worldMapImage, offsetX, offsetY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;
    }

    // Filter data for current year + scenario
    const filteredData = data.filter(d => d.year === currentYear && d.scenario === scenario);
    console.log(`Drawing ${scenario} for ${currentYear}:`, filteredData.length, 'points');
    
    if (filteredData.length === 0) {
        console.warn('No data to display for', scenario, currentYear);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`No data for ${scenario} ${currentYear}`, 20, 60);
        return;
    }

    // Scale dot size + opacity based on map size
    const minMapDim = Math.min(drawWidth, drawHeight);
    const scale = minMapDim / 800;

    const baseSize = 3;
    const size = baseSize * Math.max(0.5, Math.min(1.5, scale));

    const baseAlpha = 0.28;
    const alpha = baseAlpha * Math.max(0.4, Math.min(1.0, scale));

    // Draw data points with small, faint circles so the map shows through
    filteredData.forEach(point => {
        let lon = point.lon;
        if (lon > 180) lon -= 360;

        const x = offsetX + ((lon + 180) / 360) * drawWidth;
        const y = offsetY + ((90 - point.lat) / 180) * drawHeight;

        const color = getColor(point.pr_mm_day);
        const transparentColor = color
            .replace('rgb', 'rgba')
            .replace(')', `, ${alpha})`);

        ctx.fillStyle = transparentColor;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Scenario label
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(scenario.toUpperCase(), 20, 40);
    ctx.shadowBlur = 0;
}

function updateMaps() {
    console.log('Updating maps for year:', currentYear);
    drawMap(canvasLeft, 'ssp126');
    drawMap(canvasRight, 'ssp245');
}

function drawColorScale() {
    if (!colorScale) return;
    colorScale.innerHTML = '';

    const steps = 50;
    for (let i = 0; i < steps; i++) {
        const v = PRECIP_MIN + (i / (steps - 1)) * (PRECIP_MAX - PRECIP_MIN);
        const div = document.createElement('div');
        div.style.flex = '1';
        div.style.backgroundColor = getColor(v);
        colorScale.appendChild(div);
    }
}

if (prevYearBtn && nextYearBtn) {
    updateYearButtons();
}

// ==== Tooltip + hover helpers ====

function handleLineHover(e) {
    if (!lineCanvas || linePoints.length === 0) return;

    const rect = lineCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let nearest = null;
    let minDist = Infinity;
    const maxRadius = 12; // hover radius in pixels

    linePoints.forEach(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            nearest = p;
        }
    });

    if (nearest && minDist <= maxRadius) {
        hoverPoint = nearest;
        showTooltip(
            nearest,
            e.clientX + 10,
            e.clientY + 10
        );
    } else {
        hoverPoint = null;
        hideTooltip();
    }

    drawLineChart();
}

function showTooltip(p, pageX, pageY) {
    if (!tooltip) return;
    tooltip.style.display = 'block';
    tooltip.style.left = pageX + 'px';
    tooltip.style.top = pageY + 'px';
    tooltip.innerHTML = `
        <div><strong>Year:</strong> ${p.year}</div>
        <div><strong>Scenario:</strong> ${p.scenario}</div>
        <div><strong>Precip:</strong> ${p.value.toFixed(3)} mm/day</div>
    `;
}

function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.display = 'none';
}
