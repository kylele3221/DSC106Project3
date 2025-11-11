// Global variables
let data = [];
let currentYear = 2015;
let sliderPosition = 50;
let isDragging = false;
const years = [2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070, 2075, 2080, 2085, 2090, 2095, 2100];

// World map image variables
let worldMapImage = null;
let mapImageLoaded = false;

// DOM elements
let canvasLeft, canvasRight, mapContainer, sliderLine, rightMapContainer;
let yearSlider, yearDisplay, prevYearBtn, nextYearBtn, colorScale, lineCanvas;

// Derived data
let yearlyAverages = [];


// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
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
    lineCanvas = document.getElementById('lineCanvas');  // ← NEW
    
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
    worldMapImage.crossOrigin = "anonymous";
    worldMapImage.onload = function() {
        mapImageLoaded = true;
        console.log('World map image loaded');
        updateMaps();
    };
    // Using a public domain world map
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
        
        // Log sample data to verify
        console.log('Sample data point:', data[0]);
        console.log('Unique years:', [...new Set(data.map(d => d.year))]);
        console.log('Unique scenarios:', [...new Set(data.map(d => d.scenario))]);
        
        computeYearlyAverages();
        resizeChart();
        drawLineChart();
        updateMaps();
    } catch (error) {
        console.error('Error loading CSV:', error);
        
        // Show error message on canvas
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
    yearSlider.addEventListener('input', (e) => {
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
    mapContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateSliderPosition(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateSliderPosition(e);
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch events
    mapContainer.addEventListener('touchstart', (e) => {
        isDragging = true;
        updateSliderPosition(e.touches[0]);
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            updateSliderPosition(e.touches[0]);
            e.preventDefault();
        }
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });
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

function getColor(value) {
  const min = 0.1;
  const max = 1.5;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // low = gray (#808080), high = white (#FFFFFF)
  const low = { r: 128, g: 128, b: 128 };  // gray
  const high = { r: 255, g: 255, b: 255 }; // white

  const r = Math.round(low.r + (high.r - low.r) * t);
  const g = Math.round(low.g + (high.g - low.g) * t);
  const b = Math.round(low.b + (high.b - low.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}


function computeYearlyAverages() {
    const sums = {};
    const counts = {};

    data.forEach(d => {
        if (!sums[d.year]) {
            sums[d.year] = 0;
            counts[d.year] = 0;
        }
        sums[d.year] += d.pr_mm_day;
        counts[d.year] += 1;
    });

    yearlyAverages = years
        .filter(y => sums[y] !== undefined)
        .map(y => ({
            year: y,
            avg: sums[y] / counts[y]
        }));
}

function drawLineChart() {
    if (!lineCanvas || yearlyAverages.length === 0) return;

    const ctx = lineCanvas.getContext('2d');
    const width = lineCanvas.width;
    const height = lineCanvas.height;

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

    let minVal = Math.min(...yearlyAverages.map(d => d.avg));
    let maxVal = Math.max(...yearlyAverages.map(d => d.avg));

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
    ctx.lineTo(x1, y0); // x-axis
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1); // y-axis
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

    // X labels (each year)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9ca3af';
    yearlyAverages.forEach(d => {
        const x = xScale(d.year);
        ctx.fillText(d.year, x, y0 + 4);
    });

    // Line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    yearlyAverages.forEach((d, i) => {
        const x = xScale(d.year);
        const y = yScale(d.avg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    ctx.fillStyle = '#38bdf8';
    yearlyAverages.forEach(d => {
        const x = xScale(d.year);
        const y = yScale(d.avg);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });

    // Title
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Average precipitation (mm/day) by year', x0, paddingTop - 22);
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
    
    // Draw world map image if loaded
    if (mapImageLoaded && worldMapImage) {
        ctx.globalAlpha = 0.5; // Make the map semi-transparent
        ctx.drawImage(worldMapImage, 0, 0, width, height);
        ctx.globalAlpha = 1.0; // Reset alpha
    }
    
    // Filter data
    const filteredData = data.filter(d => d.year === currentYear && d.scenario === scenario);
    console.log(`Drawing ${scenario} for ${currentYear}:`, filteredData.length, 'points');
    
    if (filteredData.length === 0) {
        console.warn('No data to display for', scenario, currentYear);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`No data for ${scenario} ${currentYear}`, 20, 60);
        return;
    }
    
    // Draw data points with transparency
    // Draw data points with transparency
// Draw data points with transparency
filteredData.forEach(point => {
    let lon = point.lon;

    // If data uses 0–360 longitudes, convert to -180–180
    if (lon > 180) {
        lon -= 360;
    }

    const x = ((lon + 180) / 360) * width;      // -180 → 0, 0 → mid, +180 → width
    const y = ((90 - point.lat) / 180) * height; // +90 → top, -90 → bottom
    const size = Math.max(1, width / 288);

    const color = getColor(point.pr_mm_day);
    const transparentColor = color.replace('rgb', 'rgba').replace(')', ', 0.25)');

    ctx.fillStyle = transparentColor;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
});


    
    // Draw scenario label
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
    for (let i = 0; i < 50; i++) {
        const div = document.createElement('div');
        div.style.flex = '1';
        div.style.backgroundColor = getColor(0.1 + (i / 50) * 1.4);
        colorScale.appendChild(div);
    }
}

// Initialize year buttons
if (prevYearBtn && nextYearBtn) {
    updateYearButtons();
}
