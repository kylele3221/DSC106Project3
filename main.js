const width = 900;
const height = 500;

const canvasBottom = document.getElementById('map-bottom');
const canvasTop = document.getElementById('map-top');
canvasBottom.width = width;
canvasBottom.height = height;
canvasTop.width = width;
canvasTop.height = height;

const ctxBottom = canvasBottom.getContext('2d');
const ctxTop = canvasTop.getContext('2d');

const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });

const scenarioASelect = document.getElementById('scenarioA');
const scenarioBSelect = document.getElementById('scenarioB');
const yearSlider = document.getElementById('yearSlider');
const yearLabel = document.getElementById('yearLabel');
const swipe = document.getElementById('swipe');
const handle = document.getElementById('swipe-handle');
const playBtn = document.getElementById('play');
const statusEl = document.getElementById('status');

let dataByScenarioYear;
let years;
let playId = null;

function updateSwipe() {
  const p = +swipe.value;
  canvasTop.style.clipPath = 'inset(0 ' + (100 - p) + '% 0 0)';
  handle.style.left = p + '%';
}

function drawScenario(ctx, scenario, year) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, width, height);

  const spherePath = d3.geoPath(projection, ctx);
  ctx.beginPath();
  spherePath({ type: 'Sphere' });
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const m1 = dataByScenarioYear.get(scenario);
  if (!m1) return;
  const arr = m1.get(year);
  if (!arr) return;

  const maxVal = d3.max(arr, d => d.pr_mm_day) || 1;
  const color = d3.scaleLinear().domain([0, maxVal]).range(['#f7fbff', '#08306b']);

  arr.forEach(d => {
    const p = projection([d.lon, d.lat]);
    if (!p) return;
    ctx.fillStyle = color(d.pr_mm_day);
    ctx.fillRect(p[0], p[1], 2, 2);
  });
}

function redraw() {
  const year = +yearSlider.value;
  const scenarioA = scenarioASelect.value;
  const scenarioB = scenarioBSelect.value;
  yearLabel.textContent = year;
  drawScenario(ctxBottom, scenarioA, year);
  drawScenario(ctxTop, scenarioB, year);
}

function togglePlay() {
  if (playId) {
    clearInterval(playId);
    playId = null;
    playBtn.textContent = 'Play';
    return;
  }
  playBtn.textContent = 'Pause';
  playId = setInterval(() => {
    const y = +yearSlider.value;
    const idx = years.indexOf(y);
    const next = years[(idx + 1) % years.length];
    yearSlider.value = next;
    redraw();
  }, 800);
}

swipe.addEventListener('input', updateSwipe);
scenarioASelect.addEventListener('change', redraw);
scenarioBSelect.addEventListener('change', redraw);
yearSlider.addEventListener('input', redraw);
playBtn.addEventListener('click', togglePlay);

updateSwipe();

statusEl.textContent = 'Loading full dataset...';

d3.csv('precip_5yr_cesm2waccm_ncar.csv').then(raw => {
  raw.forEach(d => {
    d.year = +d.year;
    d.lat = +d.lat;
    d.lon = +d.lon;
    d.pr_mm_day = +d.pr_mm_day;
  });

  dataByScenarioYear = d3.group(raw, d => d.scenario, d => d.year);

  years = Array.from(new Set(raw.map(d => d.year))).sort((a, b) => a - b);

  yearSlider.min = years[0];
  yearSlider.max = years[years.length - 1];
  yearSlider.step = years[1] - years[0];
  yearSlider.value = years[0];
  yearLabel.textContent = years[0];

  statusEl.textContent = '';

  redraw();
}).catch(err => {
  statusEl.textContent = 'Error loading data';
  console.error(err);
});
