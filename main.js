// Global variables
let data = [];
let currentYear = 2015;
let sliderPosition = 50;
let isDragging = false;
const years = [2015, 2020, 2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070, 2075, 2080, 2085, 2090, 2095, 2100];

// DOM elements
let canvasLeft, canvasRight, mapContainer, sliderLine, rightMapContainer;
let yearSlider, yearDisplay, prevYearBtn, nextYearBtn, colorScale;

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
    
    // Initialize
    init();
});

function init() {
    console.log('Initializing application...');
    
    // Set canvas sizes
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Setup event listeners
    setupEventListeners();
    
    // Draw color scale
    drawColorScale();
    
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

  updateYear();
  // === BRUSH SELECTION + LINE CHART ===

  const brushLayer = baseSvg.append("g").attr("class", "brush-layer");

  const brush = d3.brush()
    .extent([[0, 0], [W, H]])
    .on("end", brushed);

  brushLayer.call(brush);

  function brushed(event) {
    const s = event.selection;
    if (!s) return;

    const [[x0, y0], [x1, y1]] = s;

    const selected = rows.filter(d => {
      const xy = projection([d.lon, d.lat]);
      if (!xy) return false;
      const [x, y] = xy;
      return x0 <= x && x <= x1 && y0 <= y && y <= y1;
    });

    if (!selected.length) return;

    const grouped = d3.rollups(
      selected,
      v => d3.mean(v, d => d.value),
      d => d.scenario,
      d => d.year
    );

    renderLineChart(grouped);
  }

  function renderLineChart(grouped) {
    d3.select("#linechart").remove();

    const margin = { top: 30, right: 30, bottom: 35, left: 45 };
    const width = 500, height = 260;

    const svg = d3.select("body")
      .append("svg")
      .attr("id", "linechart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style("display", "block")
      .style("margin", "20px auto")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const allYears = Array.from(new Set(rows.map(d => d.year))).sort(d3.ascending);
    const allVals = grouped.flatMap(([_, arr]) => arr.map(([_, v]) => v));
    const yScale = d3.scaleLinear().domain(d3.extent(allVals)).nice().range([height, 0]);
    const xScale = d3.scaleLinear().domain(d3.extent(allYears)).range([0, width]);
    const color = d3.scaleOrdinal(d3.schemeSet2);

    const line = d3.line()
      .x(([year]) => xScale(year))
      .y(([, val]) => yScale(val));

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(allYears.length).tickFormat(d3.format("d")));

    svg.append("g").call(d3.axisLeft(yScale));

    grouped.forEach(([scenario, arr]) => {
      svg.append("path")
        .datum(arr.sort((a,b)=>a[0]-b[0]))
        .attr("fill", "none")
        .attr("stroke", color(scenario))
        .attr("stroke-width", 2)
        .attr("d", line);

      svg.append("text")
        .attr("x", width - 40)
        .attr("y", yScale(arr[arr.length - 1][1]))
        .attr("fill", color(scenario))
        .attr("dy", "0.35em")
        .text(scenario);
    });

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ab")
      .text("Average Precipitation (mm/day) in Selected Area");
  }

})();
    nextYearBtn.addEventListener('click', () => {
        const idx = years.indexOf(currentYear);
        if (idx < years.length - 1) {
            currentYear = years[idx + 1];
            yearSlider.value = idx +
