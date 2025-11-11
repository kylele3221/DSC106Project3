// Global variables
let data = [];
let currentYear = 2015;
let sliderPosition = 50;
let isDragging = false;
const years = [2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070, 2075, 2080, 2085, 2090, 2095, 2100];

// DOM elements
const canvasLeft = document.getElementById('canvasLeft');
const canvasRight = document.getElementById('canvasRight');
const mapContainer = document.getElementById('mapContainer');
const sliderLine = document.getElementById('sliderLine');
const rightMapContainer = document.getElementById('rightMapContainer');
const yearSlider = document.getElementById('yearSlider');
const yearDisplay = document.getElementById('yearDisplay');
const prevYearBtn = document.getElementById('prevYear');
const nextYearBtn = document.getElementById('nextYear');
const colorScale = document.getElementById('colorScale');

// Initialize
init();

function init() {
    generateSampleData();
    setupEventListeners();
    drawColorScale();
    updateMaps();
}

// Generate sample data (replace this with your CSV loading logic)
function generateSampleData() {
    const scenarios = ['ssp126', 'ssp245'];
    
    years.forEach(year => {
        scenarios.forEach(scenario => {
            for (let lat = -90; lat <= 90; lat += 10) {
                for (let lon = 0; lon < 360; lon += 10) {
                    const baseValue = 0.17 + (Math.sin(lat * Math.PI / 180) + 1) * 0.5;
                    const yearFactor = scenario === 'ssp245' ? (year - 2015) / 850 : (year - 2015) / 1700;
                    const value = baseValue + yearFactor + Math.random() * 0.05;
                    data.push({ year, lat, lon, pr_mm_day: value, scenario });
                }
            }
        });
    });
}

// To load your actual CSV file, use this function instead:
/*
async function loadCSV(filePath) {
    const response = await fetch(filePath);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    
    data = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            year: parseInt(values[0]),
            lat: parseFloat(values[1]),
            lon: parseFloat(values[2]),
            pr_mm_day: parseFloat(values[3]),
            scenario: values[4].trim()
        };
    });
    
    updateMaps();
}
// Call it like: loadCSV('your-data-file.csv');
*/

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
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            updateSliderPosition(e.touches[0]);
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
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    const r = Math.floor(normalized * 255);
    const b = Math.floor((1 - normalized) * 255);
    const g = Math.floor(128 * (1 - Math.abs(normalized - 0.5) * 2));
    
    return `rgb(${r}, ${g}, ${b})`;
}

function drawMap(canvas, scenario) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Filter data
    const filteredData = data.filter(d => d.year === currentYear && d.scenario === scenario);
    
    // Draw data points
    filteredData.forEach(point => {
        const x = ((point.lon + 180) / 360) * width;
        const y = ((90 - point.lat) / 180) * height;
        const size = width / 36;
        
        ctx.fillStyle = getColor(point.pr_mm_day);
        ctx.fillRect(x - size/2, y - size/2, size, size);
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

updateYearButtons();
