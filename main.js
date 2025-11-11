(async function() {
  const CSV = "precip_5yr_cesm2waccm_ncar.csv";
  const WORLD_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
  const COLS = { year:"year", lat:"lat", lon:"lon", value:"pr_mm_day", scenario:"scenario" };
  const usePerYearColorScale = false;

  const vis = d3.select("#vis");
  const baseSvg = d3.select("#basemap");
  const W = 1000, H = 560, PAD = 8;

  const divider = document.getElementById("divider");
  const handle  = document.getElementById("handle");
  const tooltip = d3.select("#tooltip");

  const canvasA = vis.append("canvas")
    .classed("layer layerA", true)
    .attr("width", W).attr("height", H)
    .style("width", W + "px").style("height", H + "px")
    .node();

  const canvasB = vis.append("canvas")
    .classed("layer layerB", true)
    .attr("width", W).attr("height", H)
    .style("width", W + "px").style("height", H + "px")
    .node();

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  const selA   = d3.select("#selA");
  const selB   = d3.select("#selB");
  const labelA = d3.select("#labelA");
  const labelB = d3.select("#labelB");

  const projection = d3.geoNaturalEarth1()
    .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], {type:"Sphere"});

  const geoPath = d3.geoPath(projection);

  const [worldTopo, rowsRaw] = await Promise.all([
    d3.json(WORLD_URL),
    d3.csv(CSV, d => ({
      year: +d[COLS.year],
      lat: +d[COLS.lat],
      lon: +d[COLS.lon],
      value: +d[COLS.value],
      scenario: d[COLS.scenario]
    }))
  ]);

  const rows = rowsRaw.filter(r =>
    Number.isFinite(r.year) &&
    Number.isFinite(r.lat) &&
    Number.isFinite(r.lon) &&
    Number.isFinite(r.value) &&
    r.scenario
  );

  const countries = topojson.feature(worldTopo, worldTopo.objects.countries);

  baseSvg.append("path")
    .attr("d", geoPath({type:"Sphere"}))
    .attr("fill", "#0c152a");

  baseSvg.append("g")
    .selectAll("path")
    .data(countries.features)
    .join("path")
    .attr("d", geoPath)
    .attr("fill", "#0e1d3b")
    .attr("stroke", "#243861")
    .attr("stroke-width", 0.5)
    .attr("vector-effect", "non-scaling-stroke");

  const years = Array.from(new Set(rows.map(d => d.year))).sort((a, b) => a - b);
  const scenarios = Array.from(new Set(rows.map(d => d.scenario))).sort();
  const byScenarioYear = d3.group(rows, d => d.scenario, d => d.year);

  selA.selectAll("option")
    .data(scenarios)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  selB.selectAll("option")
    .data(scenarios)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  selA.property("value", scenarios[0] ?? "");
  selB.property("value", scenarios[1] ?? scenarios[0] ?? "");

  labelA.text(selA.property("value") || "Left");
  labelB.text(selB.property("value") || "Right");

  const allVals = rows.map(d => d.value);
  const globalExtent = d3.extent(allVals);

  const color = d3.scaleSequential()
    .domain(globalExtent)
    .interpolator(d3.interpolateTurbo);

  const legend = baseSvg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${W - 260}, ${H - 60})`);

  function drawLegend(domain) {
    legend.selectAll("*").remove();

    const defs = baseSvg.append("defs");
    const id = "grad" + Math.random().toString(36).slice(2);

    const grad = defs.append("linearGradient")
      .attr("id", id)
      .attr("x1", "0%")
      .attr("x2", "100%");

    d3.range(0, 1.0001, 0.1).forEach(t => {
      grad.append("stop")
        .attr("offset", (t * 100) + "%")
        .attr("stop-color", d3.interpolateTurbo(t));
    });

    legend.append("rect")
      .attr("width", 200)
      .attr("height", 12)
      .attr("fill", `url(#${id})`)
      .attr("stroke", "#243861");

    const s = d3.scaleLinear()
      .domain(domain)
      .range([0, 200]);

    legend.append("g")
      .attr("transform", "translate(0, 12)")
      .call(d3.axisBottom(s).ticks(5).tickSize(4))
      .selectAll("text")
      .attr("fill", "#9ab");

    legend.append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("fill", "#9ab")
      .text("pr (mm/day)");
  }

  drawLegend(globalExtent);

  const slider    = d3.select("#yearSlider")
    .attr("min", 0)
    .attr("max", Math.max(0, years.length - 1))
    .attr("value", 0);

  const yearLabel = d3.select("#yearLabel");
  const ptSize    = d3.select("#ptSize");
  const ptAlpha   = d3.select("#ptAlpha");
  const playBtn   = d3.select("#play");

  let playing    = false;
  let timer      = null;
  const frameDelay = 900;

  function currentYear() {
    return years[+slider.node().value];
  }

  function setYearIndex(i) {
    slider.node().value = Math.max(0, Math.min(years.length - 1, i));
    updateYear();
  }

  function loop() {
    setYearIndex((+slider.node().value + 1) % years.length);
    timer = setTimeout(loop, frameDelay);
  }

  selA.on("change", () => {
    labelA.text(selA.property("value"));
    drawBoth(currentYear());
  });

  selB.on("change", () => {
    labelB.text(selB.property("value"));
    drawBoth(currentYear());
  });

  slider.on("input", updateYear);
  ptSize.on("input", () => drawBoth(currentYear()));
  ptAlpha.on("input", () => drawBoth(currentYear()));

  playBtn.on("click", () => {
    playing = !playing;
    playBtn.text(playing ? "⏸ Pause" : "▶ Play");
    if (playing) loop();
    else clearTimeout(timer);
  });

  const visNode = document.getElementById("vis");

  function bounds() {
    return visNode.getBoundingClientRect();
  }

  let splitX = Math.round(W / 2);

  function setSplit(px) {
    splitX = Math.max(0, Math.min(W, px));
    canvasB.style.clipPath = `inset(0 0 0 ${splitX}px)`;
    divider.style.left = splitX + "px";
    handle.style.left  = splitX + "px";
  }

  setSplit(Math.round(W / 2));

  vis.on("pointerdown", ev => {
    move(ev);
    vis.on("pointermove", move);
  });

  d3.select(window).on("pointerup", () => {
    vis.on("pointermove", null);
  });

  function move(ev) {
    const r = bounds();
    const mx = (ev.clientX - r.left) * (W / r.width);
    setSplit(Math.round(mx));
  }

  visNode.addEventListener("mousemove", ev => {
    const r = bounds();
    const mx = (ev.clientX - r.left) * (W / r.width);
    const my = (ev.clientY - r.top)  * (H / r.height);

    const yr = currentYear();
    const sideA = mx <= splitX;
    const scen = sideA ? selA.property("value") : selB.property("value");
    const rowsSide = (byScenarioYear.get(scen)?.get(yr)) || [];

    const radius = +ptSize.node().value * 4;
    let best = null;
    let bestD2 = radius * radius;

    for (const d of rowsSide) {
      const xy = projection([d.lon, d.lat]);
      if (!xy) continue;
      const dx = xy[0] - mx;
      const dy = xy[1] - my;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { x: xy[0], y: xy[1], d };
      }
    }

    if (best) {
      tooltip
        .style("left", best.x + "px")
        .style("top", best.y + "px")
        .style("opacity", 1)
        .html(
          `<div><strong>${yr}</strong> — ${scen}</div>
           <div>Lat: ${best.d.lat.toFixed(2)}, Lon: ${best.d.lon.toFixed(2)}</div>
           <div>pr: <strong>${best.d.value.toFixed(3)}</strong> mm/day</div>`
        );
    } else {
      tooltip.style("opacity", 0);
    }
  });

  visNode.addEventListener("mouseleave", () => {
    tooltip.style("opacity", 0);
  });

  function drawPoints(ctx, data) {
    ctx.clearRect(0, 0, W, H);
    const r = +ptSize.node().value;
    const a = +ptAlpha.node().value;
    ctx.globalAlpha = a;

    for (const d of data) {
      const xy = projection([d.lon, d.lat]);
      if (!xy) continue;
      ctx.beginPath();
      ctx.fillStyle = color(d.value);
      ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBoth(yr) {
    const scenA = selA.property("value");
    const scenB = selB.property("value");

    const A = (byScenarioYear.get(scenA)?.get(yr)) || [];
    const B = (byScenarioYear.get(scenB)?.get(yr)) || [];

    if (usePerYearColorScale) {
      const ext = d3.extent(A.concat(B), d => d.value);
      color.domain(ext[0] === undefined ? globalExtent : ext);
      drawLegend(color.domain());
    } else {
      color.domain(globalExtent);
      drawLegend(globalExtent);
    }

    drawPoints(ctxA, A);
    drawPoints(ctxB, B);
  }

  function updateYear() {
    const yr = currentYear();
    yearLabel.text(yr);
    drawBoth(yr);
  }

  updateYear();
})();
