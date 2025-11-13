(async function () {
  // ----- CONFIG -----
  const CSV = "precip_5yr_cesm2waccm_ncar.csv";
  const WORLD_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
  const COLS = { year:"year", lat:"lat", lon:"lon", value:"pr_mm_day", scenario:"scenario" };
  const usePerYearColorScale = false;

  // ----- ELEMENTS / SIZE -----
  const vis = d3.select("#vis");
  const baseSvg = d3.select("#basemap");
  const W = 1000, H = 560, PAD = 8;

  const divider = document.getElementById("divider");
  const handle  = document.getElementById("handle");
  const tooltip = d3.select("#tooltip");

  // canvases
  const canvasA = vis.append("canvas").classed("layer layerA", true)
    .attr("width", W).attr("height", H).style("width", W+"px").style("height", H+"px").node();
  const canvasB = vis.append("canvas").classed("layer layerB", true)
    .attr("width", W).attr("height", H).style("width", W+"px").style("height", H+"px").node();
  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  const selA = d3.select("#selA");
  const selB = d3.select("#selB");
  const labelA = d3.select("#labelA");
  const labelB = d3.select("#labelB");

  // ----- PROJECTION -----
  const projection = d3.geoNaturalEarth1()
    .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type:"Sphere" });
  const geoPath = d3.geoPath(projection);

  // ----- LOAD -----
  const [worldTopo, rowsRaw] = await Promise.all([
    d3.json(WORLD_URL),
    d3.csv(CSV, d => ({
      year:+d[COLS.year],
      lat:+d[COLS.lat],
      lon:+d[COLS.lon],
      value:+d[COLS.value],
      scenario:d[COLS.scenario]
    }))
  ]);

  const rows = rowsRaw.filter(r =>
    Number.isFinite(r.year) && Number.isFinite(r.lat) &&
    Number.isFinite(r.lon) && Number.isFinite(r.value) && r.scenario
  );

  // basemap
  const countries = topojson.feature(worldTopo, worldTopo.objects.countries);
  baseSvg.append("path").attr("d", geoPath({type:"Sphere"})).attr("fill","#ffffff");
  baseSvg.append("g").selectAll("path")
    .data(countries.features).join("path")
    .attr("d", geoPath).attr("fill","#f7f9fc")
    .attr("stroke","#d8dde6").attr("stroke-width",0.5).attr("vector-effect","non-scaling-stroke");

  // years & scenarios
  const years = Array.from(new Set(rows.map(d => d.year))).sort((a,b)=>a-b);
  const scenarios = Array.from(new Set(rows.map(d => d.scenario))).sort();
  const byScenarioYear = d3.group(rows, d => d.scenario, d => d.year);

  // populate selects
  selA.selectAll("option").data(scenarios).join("option").attr("value", d=>d).text(d=>d);
  selB.selectAll("option").data(scenarios).join("option").attr("value", d=>d).text(d=>d);
  selA.property("value", scenarios[0] ?? "");
  selB.property("value", scenarios[1] ?? scenarios[0] ?? "");
  labelA.text(selA.property("value") || "Left");
  labelB.text(selB.property("value") || "Right");

  // color scale
  const globalExtent = d3.extent(rows, d => d.value);
  const color = d3.scaleSequential().domain(globalExtent).interpolator(d3.interpolateTurbo);

  // legend (bottom-right of map)
  // legend (separate SVG above the map)
  const legendSvg = d3.select("#legendSvg");
  const legendG   = legendSvg.append("g").attr("transform","translate(10,20)");

  drawLegend(globalExtent);

  function drawLegend(domain) {
    // clear previous contents (including old gradients)
    legendSvg.selectAll("defs").remove();
    legendG.selectAll("*").remove();

    const defs = legendSvg.append("defs");
    const id = "grad" + Math.random().toString(36).slice(2);
    const grad = defs.append("linearGradient")
      .attr("id", id)
      .attr("x1","0%").attr("x2","100%");

    d3.range(0,1.0001,0.1).forEach(t => {
      grad.append("stop")
        .attr("offset", `${t*100}%`)
        .attr("stop-color", d3.interpolateTurbo(t));
    });

    legendG.append("rect")
      .attr("width",180).attr("height",12)
      .attr("fill",`url(#${id})`)
      .attr("stroke","#cfd6df");

    const s = d3.scaleLinear().domain(domain).range([0,180]);

    legendG.append("g")
      .attr("transform","translate(0,12)")
      .attr("class","axis")
      .call(d3.axisBottom(s).ticks(5).tickSize(4))
      .selectAll("text").attr("fill","#5a6473");

    legendG.append("text")
      .attr("x",0).attr("y",-6)
      .attr("fill","#5a6473")
      .text("pr (mm/day)");
  }

  // ----- UI -----
  const slider = d3.select("#yearSlider").attr("min",0).attr("max",Math.max(0,years.length-1)).attr("value",0);
  const yearLabel = d3.select("#yearLabel");
  const ptSize = d3.select("#ptSize");
  const ptAlpha = d3.select("#ptAlpha");
  const playBtn = d3.select("#play");

  let playing=false, timer=null, frameDelay=900;

  selA.on("change", () => { labelA.text(selA.property("value")); renderTS(); drawBoth(currentYear()); });
  selB.on("change", () => { labelB.text(selB.property("value")); renderTS(); drawBoth(currentYear()); });
  slider.on("input", updateYear);
  ptSize.on("input", () => drawBoth(currentYear()));
  ptAlpha.on("input", () => drawBoth(currentYear()));
  playBtn.on("click", () => {
    playing = !playing;
    playBtn.text(playing ? "⏸ Pause" : "▶ Play");
    if (playing) loop(); else clearTimeout(timer);
  });

  function currentYear(){ return years[+slider.node().value]; }
  function setYearIndex(i){ slider.node().value = Math.max(0, Math.min(years.length-1, i)); updateYear(); }
  function loop(){ setYearIndex((+slider.node().value + 1) % years.length); timer=setTimeout(loop, frameDelay); }

  // swipe
  const visNode = document.getElementById("vis");
  const bounds = () => visNode.getBoundingClientRect();
  let splitX = Math.round(W/2);

  function setSplit(px){
    splitX = Math.max(0, Math.min(W, px));
    canvasB.style.clipPath = `inset(0 0 0 ${splitX}px)`;
    divider.style.left = splitX + "px";
    handle.style.left  = splitX + "px";
  }
  setSplit(Math.round(W/2));

  vis.on("pointerdown", (ev)=> { move(ev); vis.on("pointermove", move); });
  d3.select(window).on("pointerup", ()=> vis.on("pointermove", null));
  function move(ev){
    const r = bounds();
    setSplit(Math.round((ev.clientX - r.left) * (W / r.width)));
  }

  // hover tooltip (map)
  visNode.addEventListener("mousemove",(ev)=>{
    const r = bounds();
    const mx = (ev.clientX - r.left) * (W / r.width);
    const my = (ev.clientY - r.top)  * (H / r.height);
    const yr = currentYear();
    const sideA = mx <= splitX;
    const scen = sideA ? selA.property("value") : selB.property("value");
    const sample = (byScenarioYear.get(scen)?.get(yr)) || [];
    const radius = +ptSize.node().value * 4;
    let best=null, bestD2=radius*radius;
    for (const d of sample){
      const xy = projection([d.lon, d.lat]); if (!xy) continue;
      const dx = xy[0]-mx, dy=xy[1]-my, d2 = dx*dx+dy*dy;
      if (d2 < bestD2){ bestD2=d2; best={x:xy[0], y:xy[1], d}; }
    }
    if (best){
      tooltip.style("left", best.x+"px").style("top", best.y+"px").style("opacity",1)
        .html(`<div><strong>${yr}</strong> — ${scen}</div>
               <div>Lat: ${best.d.lat.toFixed(2)}, Lon: ${best.d.lon.toFixed(2)}</div>
               <div>pr: <strong>${best.d.value.toFixed(3)}</strong> mm/day</div>`);
    } else tooltip.style("opacity",0);
  });
  visNode.addEventListener("mouseleave", ()=> tooltip.style("opacity",0));

  // drawing
  function drawPoints(ctx, data){
    ctx.clearRect(0,0,W,H);
    const r = +ptSize.node().value;
    const a = +ptAlpha.node().value;
    ctx.globalAlpha = a;
    for (const d of data){
      const xy = projection([d.lon, d.lat]); if (!xy) continue;
      ctx.beginPath();
      ctx.fillStyle = color(d.value);
      ctx.arc(xy[0], xy[1], r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawBoth(yr){
    const scenA = selA.property("value");
    const scenB = selB.property("value");
    const A = (byScenarioYear.get(scenA)?.get(yr)) || [];
    const B = (byScenarioYear.get(scenB)?.get(yr)) || [];

    if (usePerYearColorScale){
      const ext = d3.extent(A.concat(B), d=>d.value);
      color.domain(ext[0]===undefined ? globalExtent : ext);
      drawLegend(color.domain());
    } else {
      color.domain(globalExtent);
      drawLegend(globalExtent);
    }
    drawPoints(ctxA, A);
    drawPoints(ctxB, B);
  }

  function updateYear(){
    const yr = currentYear();
    d3.select("#yearLabel").text(yr);
    placeTsMarker(yr);
    drawBoth(yr);
  }

  // ===== Timeseries (global mean pr for two selected scenarios) =====
  const meanByScenarioYear = d3.rollup(
    rows,
    v => d3.mean(v, d => d.value),
    d => d.scenario,
    d => d.year
  );
  const seriesByScenario = new Map(
    Array.from(meanByScenarioYear, ([scen, yearMap]) => [
      scen,
      Array.from(yearMap, ([yr, mean]) => ({ year:+yr, mean:+mean }))
        .sort((a,b)=>a.year-b.year)
    ])
  );
  const allMeans = Array.from(seriesByScenario.values()).flat().map(d => d.mean);
  const yExtentGlobal = d3.extent(allMeans);

  const tsSvg = d3.select("#ts");
  const TS_W = 1000, TS_H = 280, M = {t:14, r:20, b:36, l:48};
  const tsInnerW = TS_W - M.l - M.r;
  const tsInnerH = TS_H - M.t - M.b;
  const tsG = tsSvg.append("g").attr("transform", `translate(${M.l},${M.t})`);

  const xTS = d3.scaleLinear().domain(d3.extent(years)).range([0, tsInnerW]);
  const yTS = d3.scaleLinear().domain(yExtentGlobal).nice().range([tsInnerH, 0]);

  tsG.append("g").attr("class","ts-grid")
    .call(d3.axisLeft(yTS).ticks(5).tickSize(-tsInnerW).tickFormat(""))
    .selectAll("line").attr("stroke-dasharray","2,3");

  tsG.append("g").attr("class","axis").attr("transform", `translate(0,${tsInnerH})`)
    .call(d3.axisBottom(xTS).ticks(6).tickFormat(d3.format("d")));
  tsG.append("g").attr("class","axis")
    .call(d3.axisLeft(yTS).ticks(5));

  const lineGen = d3.line()
    .x(d => xTS(d.year))
    .y(d => yTS(d.mean))
    .defined(d => Number.isFinite(d.mean));

  const pathA = tsG.append("path").attr("fill","none").attr("stroke","#2f6bff").attr("stroke-width",2);
  const pathB = tsG.append("path").attr("fill","none").attr("stroke","#ffb52f").attr("stroke-width",2);
  const dotsA = tsG.append("g");
  const dotsB = tsG.append("g");

  const marker = tsG.append("line").attr("class","ts-marker")
    .attr("y1", 0).attr("y2", tsInnerH).style("pointer-events","none");

  const tsTip = d3.select("#tsTip");

  function renderTS() {
    const scenA = selA.property("value");
    const scenB = selB.property("value");
    const sA = seriesByScenario.get(scenA) || [];
    const sB = seriesByScenario.get(scenB) || [];

    pathA.attr("d", lineGen(sA));
    pathB.attr("d", lineGen(sB));

    dotsA.selectAll("circle").data(sA, d => d.year).join(
      enter => enter.append("circle")
        .attr("class","ts-dot").attr("fill","#2f6bff")
        .attr("r",3.5).attr("cx", d=>xTS(d.year)).attr("cy", d=>yTS(d.mean))
        .on("mouseenter", (ev,d)=> showTsTip(ev, d, scenA))
        .on("mousemove",  (ev,d)=> showTsTip(ev, d, scenA))
        .on("mouseleave", hideTsTip),
      update => update.attr("cx", d=>xTS(d.year)).attr("cy", d=>yTS(d.mean)),
      exit   => exit.remove()
    );

    dotsB.selectAll("circle").data(sB, d => d.year).join(
      enter => enter.append("circle")
        .attr("class","ts-dot").attr("fill","#ffb52f")
        .attr("r",3.5).attr("cx", d=>xTS(d.year)).attr("cy", d=>yTS(d.mean))
        .on("mouseenter", (ev,d)=> showTsTip(ev, d, scenB))
        .on("mousemove",  (ev,d)=> showTsTip(ev, d, scenB))
        .on("mouseleave", hideTsTip),
      update => update.attr("cx", d=>xTS(d.year)).attr("cy", d=>yTS(d.mean)),
      exit   => exit.remove()
    );

    placeTsMarker(currentYear());
  }

  function showTsTip(ev, d, scen) {
    const wrap = document.getElementById("tsWrap").getBoundingClientRect();
    const boxX = ev.clientX - wrap.left + 10;
    const boxY = ev.clientY - wrap.top  - 10;
    tsTip
      .style("left", boxX + "px")
      .style("top",  boxY + "px")
      .style("opacity", 1)
      .html(`<div><strong>${d.year}</strong> — ${scen}</div>
             <div>Mean pr: <strong>${d.mean.toFixed(3)}</strong> mm/day</div>`);
  }
  function hideTsTip(){ tsTip.style("opacity", 0); }
  function placeTsMarker(yr){ marker.attr("x1", xTS(yr)).attr("x2", xTS(yr)); }

  // keep chart in sync with existing UI
  d3.select("#yearSlider").on("input.ts", () => placeTsMarker(currentYear()));
  d3.select("#ts").on("mousemove", (ev) => {
    const pt = d3.pointer(ev, tsG.node());
    const yr = Math.round(xTS.invert(pt[0]));
    if (years.includes(yr)) {
      document.getElementById("yearSlider").value = years.indexOf(yr);
      placeTsMarker(yr);
    }
  });

  // init
  renderTS();
  placeTsMarker(currentYear());
  updateYear();
})();
