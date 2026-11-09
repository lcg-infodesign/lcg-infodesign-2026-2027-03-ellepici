let data;
let rivers = [];

// Valori massimi
let maxLength = 0;
let maxArea = 0;
let maxDischarge = 0;
let hovered = -1;

// Palette
let black = "#121212";
let white = "#FFFFFF";
let chartBg = "#FAF9F6";
let yellow = "#F6EF3F";
let lilac = "#B98CFF";
let green = "#34F08B";
let grey = "#8C8A86";
let rule = "#E2E0DA";

// Font
let font = "Inter";

// Impaginazione
let gutter = 8;
let titlePanel, lengthPanel, dischargePanel, chartPanel;
let legendPanels = [];
let axisX, riverTop, riverBottom, spacing;
let groups = [];

// Ordine e nomi italiani dei continenti presenti nel CSV
let continentOrder = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
let continentNames = {
  "Africa": "Africa",
  "Asia": "Asia",
  "Europe": "Europa",
  "North America": "Nord America",
  "South America": "Sud America",
  "Oceania": "Oceania",
};

// Scala di colore per la temperatura media
let tempStops = [
  { t: -10, c: "#2E3BF2" },
  { t: 2, c: "#7A5CFF" },
  { t: 10, c: "#C27CFF" },
  { t: 17, c: "#FF5CAD" },
  { t: 24, c: "#FF8A1F" },
  { t: 30, c: "#FF3A1A" },
];

// Categorie di foce
let outflowLabels = {
  "mare": "mare / oceano",
  "interno": "mare interno / lago",
  "fiume": "altro fiume",
};

async function setup() {
  createCanvas(max(windowWidth, 1100), max(windowHeight, 780));

  await document.fonts.load("400 16px Inter");
  await document.fonts.load("700 16px Inter");

  data = await loadTable("assets/rivers_world.csv", ",", "header");

  // Trasfroma ogni riga in un oggetto "fiume" più comodo da usare
  let seenNames = [];
  for (let rowNumber = 0; rowNumber < data.getRowCount(); rowNumber++) {
    let name = data.getString(rowNumber, "name");

    // Il CSV contiene alcune righe ripetute identiche, le tengo una volta sola
    if (seenNames.includes(name)) {
      continue;
    }
    seenNames.push(name);

    // Australia e Oceania indicano la stessa area
    let continent = data.getString(rowNumber, "continent");
    if (continent == "Australia") {
      continent = "Oceania";
    }

    let outflow = data.getString(rowNumber, "outflow");

    let river = {
      name: name,
      countries: data.getString(rowNumber, "countries"),
      length: data.getNum(rowNumber, "length"),
      area: data.getNum(rowNumber, "area"),
      discharge: data.getNum(rowNumber, "discharge"),
      outflow: outflow,
      outflowType: classifyOutflow(outflow),
      continent: continent,
      tributaries: data.getNum(rowNumber, "tributaries"),
      minTemp: data.getNum(rowNumber, "min_temp"),
      maxTemp: data.getNum(rowNumber, "max_temp"),
      avgTemp: data.getNum(rowNumber, "avg_temp"),
    };
    rivers.push(river);

    maxLength = max(maxLength, river.length);
    maxArea = max(maxArea, river.area);
    maxDischarge = max(maxDischarge, river.discharge);
  }

  // Ordina prima per continente, poi dal fiume più lungo al più corto
  rivers.sort(function (a, b) {
    let byContinent = continentOrder.indexOf(a.continent) - continentOrder.indexOf(b.continent);
    if (byContinent != 0) {
      return byContinent;
    }
    return b.length - a.length;
  });

  buildLayout();
}

// Divido la foce in tre categorie
function classifyOutflow(outflow) {
  let inlandWaters = ["Caspian Sea", "Aral Sea", "Lake Winnipeg", "Curonian Lagoon"];
  let otherRivers = ["Shatt al-Arab", "Rio de la Plata"];

  if (outflow.includes("River") || otherRivers.includes(outflow)) {
    return "fiume";
  }
  if (inlandWaters.includes(outflow)) {
    return "interno";
  }
  return "mare";
}

// -----------------------------------------------------------------------------
// LAYOUT: posizione dei pannelli e forma di ogni glifo
// -----------------------------------------------------------------------------
function buildLayout() {
  let g = gutter;

  // Riga 1
  let row1H = 210;
  let row1W = width - 4 * g;
  titlePanel = { x: g, y: g, w: row1W * 0.42, h: row1H };
  lengthPanel = { x: titlePanel.x + titlePanel.w + g, y: g, w: row1W * 0.29, h: row1H };
  dischargePanel = { x: lengthPanel.x + lengthPanel.w + g, y: g, w: row1W * 0.29, h: row1H };

  // Riga 2
  let row2Y = g + row1H + g;
  let row2H = 132;
  let tileW = (width - 7 * g) / 6;
  legendPanels = [];
  for (let i = 0; i < 6; i++) {
    legendPanels.push({ x: g + i * (tileW + g), y: row2Y, w: tileW, h: row2H });
  }

  // Riga 3
  let chartY = row2Y + row2H + g;
  chartPanel = { x: g, y: chartY, w: width - 2 * g, h: height - chartY - g };

  axisX = chartPanel.x + 66;
  riverTop = chartPanel.y + 66;
  riverBottom = chartPanel.y + chartPanel.h - 28;

  // Tra un continente e l'altro lascio uno spazio
  let left = axisX + 22;
  let right = chartPanel.x + chartPanel.w - 24;
  let gapUnits = 2.5; // 2.5 fiumi
  let slots = rivers.length + (continentOrder.length - 1) * gapUnits;
  spacing = (right - left) / slots;

  groups = [];
  let x = left + spacing / 2;

  for (let i = 0; i < rivers.length; i++) {
    let river = rivers[i];

    // Nuovo continente
    if (i == 0 || river.continent != rivers[i - 1].continent) {
      if (i > 0) {
        x += spacing * gapUnits;
      }
      groups.push({ continent: river.continent, x1: x, x2: x, count: 0 });
    }
    let group = groups[groups.length - 1];
    group.x2 = x;
    group.count++;

    // map() traduce ogni valore in una dimensione visiva
    river.x = x;
    river.yEnd = map(river.length, 0, maxLength, riverTop, riverBottom);
    river.weight = dischargeToWeight(river.discharge);
    river.amp = areaToAmplitude(river.area);
    river.col = tempColor(river.avgTemp);
    river.points = meanderPoints(river.x, riverTop, river.yEnd, river.amp, i * 7.31);
    river.branches = tributariesToBranches(river.tributaries, river.yEnd - riverTop);

    x += spacing;
  }
}

// Portata -> spessore
// Uso la radice quadrata perché l'Amazzonia è molto più grande di tutti gli altri e schiaccerebbe la scala
function dischargeToWeight(discharge) {
  return map(sqrt(discharge), 0, sqrt(maxDischarge), 1.2, 9);
}

// Bacino idrografico -> ampiezza dei meandri
function areaToAmplitude(area) {
  return map(sqrt(area), 0, sqrt(maxArea), 0.5, spacing * 1.6);
}

// Affluenti -> rami laterali,
// Calcolati in scala logaritmica: 10 = 3 rami, 100 = 6, 1000 = 9
function tributariesToBranches(tributaries, stemLength) {
  let branches = round(Math.log10(tributaries) * 3);
  branches = max(1, branches);
  return min(branches, max(1, floor(stemLength / 6)));
}

// Temperatura -> colore
function tempColor(t) {
  for (let s = 0; s < tempStops.length - 1; s++) {
    let a = tempStops[s];
    let b = tempStops[s + 1];
    if (t <= b.t) {
      let amount = constrain(map(t, a.t, b.t, 0, 1), 0, 1);
      return lerpColor(color(a.c), color(b.c), amount);
    }
  }
  return color(tempStops[tempStops.length - 1].c);
}

function meanderPoints(x, y1, y2, amp, seed) { // "seed" cambia la fase, così ogni fiume ha un andamento diverso
  let points = [];
  let steps = max(1, floor((y2 - y1) / 2)); // un punto ogni 2 px circa
  for (let s = 0; s <= steps; s++) {
    let y = map(s, 0, steps, y1, y2);
    let t = y - y1;
    // Vicino alla sorgente l'ampiezza parte da zero, così tutti i fiumi nascono sulla stessa linea.
    let ramp = constrain(t / 20, 0, 1);
    let wave = 0.7 * sin(t * 0.11 + seed) + 0.3 * (noise(seed, t * 0.015) * 2 - 1);
    points.push({ x: x + amp * ramp * wave, y: y });
  }
  return points;
}

// -----------------------------------------------------------------------------
// DRAW
// -----------------------------------------------------------------------------
function draw() {
  background(black);

  if (rivers.length == 0) {
    return;
  }

  hovered = findHoveredRiver();
  let active = hovered;

  if (hovered != -1) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }

  drawTitlePanel();
  drawLengthPanel(active);
  drawDischargePanel(active);
  drawLegend();

  // Pannello del grafico
  noStroke();
  fill(chartBg);
  rect(chartPanel.x, chartPanel.y, chartPanel.w, chartPanel.h);
  drawAxis();
  drawContinentLabels(active);

  // Tutti i fiumi
  // Se ce n'è uno attivo gli altri vengono attenuati
  for (let i = 0; i < rivers.length; i++) {
    if (active != -1 && i != active) {
      drawingContext.globalAlpha = 0.14;
    }
    drawRiver(rivers[i]);
    drawingContext.globalAlpha = 1;
  }

  // Il fiume attivo viene ridisegnato sopra, con guida sull'asse e scheda informativa
  if (active != -1) {
    let river = rivers[active];
    drawLengthGuide(river);
    drawRiver(river);
    drawInfoCard(river);
  }
}

// Disegna un fiume del dataset usando la funzione generica del glifo
function drawRiver(river) {
  drawGlyph(river.points, river.weight, river.col, river.branches, river.outflowType);
}

function drawGlyph(points, weight, col, branches, outflowType) {
  noFill();
  stroke(col);
  strokeJoin(ROUND);
  strokeCap(ROUND);

  // Linea principale
  strokeWeight(weight);
  beginShape();
  for (let p of points) {
    vertex(p.x, p.y);
  }
  endShape();

  // Rami laterali, distribuiti lungo il corso e alternati a destra e a sinistra
  strokeWeight(max(1, weight * 0.4));
  for (let k = 1; k <= branches; k++) {
    let index = floor((points.length - 1) * k / (branches + 1));
    let p = points[index];
    let side = 1;
    if (k % 2 == 1) {
      side = -1;
    }
    let len = 4 + weight * 0.6;
    line(p.x, p.y, p.x + side * len, p.y - len);
  }

  // Foce
  let mouth = points[points.length - 1];
  drawMouth(mouth.x, mouth.y, outflowType, col, weight);
}

function drawMouth(x, y, type, col, weight) {
  if (type == "mare") {
    // Mare o oceano --> cerchio pieno
    noStroke();
    fill(col);
    circle(x, y, weight + 6);
  } else if (type == "interno") {
    // Mare interno o lago --> cerchio vuoto
    noFill();
    stroke(col);
    strokeWeight(2);
    circle(x, y, weight + 7);
  } else if (type == "fiume") {
    // Sfocia in un altro fiume --> trattino orizzontale
    stroke(col);
    strokeWeight(2.4);
    line(x - 6, y, x + 6, y);
  }
}

// -----------------------------------------------------------------------------
// INTERAZIONE
// -----------------------------------------------------------------------------

// Trova il fiume più vicino al mouse entro una piccola soglia
function findHoveredRiver() {
  let threshold = max(7, spacing * 0.6);
  let best = -1;
  let bestDistance = threshold;

  for (let i = 0; i < rivers.length; i++) {
    let river = rivers[i];

    // Se il mouse è lontano dal rettagolo del fiume passa oltre
    if (abs(mouseX - river.x) > river.amp + threshold) continue;
    if (mouseY < riverTop - threshold || mouseY > river.yEnd + threshold) continue;

    // Distanza dal punto più vicino della linea
    for (let p of river.points) {
      let d = dist(mouseX, mouseY, p.x, p.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
  }
  return best;
}

// -----------------------------------------------------------------------------
// PANNELLI IN ALTO: titolo e numeri grandi
// -----------------------------------------------------------------------------
function drawTitlePanel() {
  let p = titlePanel;
  let pad = 22;

  noStroke();
  fill(yellow);
  rect(p.x, p.y, p.w, p.h);

  // Etichette in alto
  let tagX = p.x + pad;
  drawTag("ESERCITAZIONE 3", tagX, p.y + pad, true);

  // Titolo grande e stretto, su una riga
  fill(black);
  textFont(font);
  textStyle(BOLD);
  textAlign(LEFT, BASELINE);
  let title = "Fiumi nel mondo";
  let size = 80;
  textSize(size);
  setTracking(-0.05 * size);
  let maxW = p.w - 2 * pad;
  if (textWidth(title) > maxW) {
    size = size * maxW / textWidth(title);
    textSize(size);
    setTracking(-0.05 * size);
  }
  text(title, p.x + pad - size * 0.04, p.y + pad + 32 + size * 0.78);
  setTracking(0);

  // Indicazione per il rollover in basso
  textStyle(BOLD);
  textSize(12);
  text("--> passa sopra un fiume per leggerlo", p.x + pad, p.y + p.h - pad);
  textStyle(NORMAL);
}

// Numero grande lilla --> quanti fiumi oppure la lunghezza del fiume attivo
function drawLengthPanel(active) {
  if (active == -1) {
    drawBigNumber(lengthPanel, lilac, "FIUMI NEL DATASET", String(rivers.length), "",
        "in 6 continenti, ordinati dal più lungo al più corto");
  } else {
    let r = rivers[active];
    drawBigNumber(lengthPanel, lilac, "LUNGHEZZA", formatNumber(r.length), "km", r.name);
  }
}

// Numero grande verde --> la portata più alta oppure la portata del fiume attivo
function drawDischargePanel(active) {
  if (active == -1) {
    let biggest = rivers[0];
    for (let r of rivers) {
      if (r.discharge > biggest.discharge) biggest = r;
    }
    drawBigNumber(dischargePanel, green, "PORTATA PIÙ ALTA", formatNumber(biggest.discharge), "m³/s",
        "Rio delle Amazzoni");
  } else {
    let r = rivers[active];
    drawBigNumber(dischargePanel, green, "PORTATA", formatNumber(r.discharge), "m³/s",
        "bacino di " + formatNumber(r.area) + " km²");
  }
}

// Pannello generico: etichetta in alto, numero enorme, unità accanto, nota in basso.
function drawBigNumber(p, bg, label, number, unit, note) {
  let pad = 22;

  noStroke();
  fill(bg);
  rect(p.x, p.y, p.w, p.h);

  drawTag(label, p.x + pad, p.y + pad, false);

  // Il numero si rimpicciolisce se non ci sta nel pannello.
  fill(black);
  textFont(font);
  textStyle(BOLD);
  textAlign(LEFT, BASELINE);
  let unitSize = 22;
  textSize(unitSize);
  let unitW = 0;
  if (unit != "") {
    unitW = textWidth(" " + unit);
  }
  let size = 96;
  textSize(size);
  setTracking(-0.05 * size);
  let maxW = p.w - 2 * pad - unitW;
  if (textWidth(number) > maxW) {
    size = size * maxW / textWidth(number);
    textSize(size);
    setTracking(-0.05 * size);
  }
  let baseY = p.y + pad + 32 + size * 0.78;
  text(number, p.x + pad - size * 0.04, baseY);
  let numberW = textWidth(number);
  setTracking(0);

  if (unit != "") {
    textSize(unitSize);
    text(unit, p.x + pad + numberW + 4, baseY);
  }

  // Nota in basso (va a capo se serve, massimo due righe)
  textStyle(NORMAL);
  textSize(13);
  let lines = wrapText(note, p.w - 2 * pad);
  if (lines.length > 2) {
    lines = [lines[0], lines[1] + "…"];
  }
  let y = p.y + p.h - pad - (lines.length - 1) * 17;
  for (let l of lines) {
    text(l, p.x + pad, y);
    y += 17;
  }
}

// -----------------------------------------------------------------------------
// LEGENDA
// -----------------------------------------------------------------------------
function drawLegend() {
  let titles = ["LUNGHEZZA", "PORTATA", "BACINO", "TEMPERATURA MEDIA", "AFFLUENTI", "FOCE"];
  let captions = [
    "quanto scende la linea",
    "spessore · m³/s",
    "ampiezza dei meandri · km²",
    "colore della linea · °C",
    "rami laterali · scala log",
    "segno alla fine della linea",
  ];

  for (let i = 0; i < 6; i++) {
    let p = legendPanels[i];
    noStroke();
    fill(white);
    rect(p.x, p.y, p.w, p.h);

    fill(black);
    textFont(font);
    textStyle(BOLD);
    textSize(10);
    textAlign(LEFT, BASELINE);
    text(titles[i], p.x + 14, p.y + 22);

    fill(grey);
    textStyle(NORMAL);
    textSize(10);
    text(captions[i], p.x + 14, p.y + p.h - 14);
  }

  let sampleColor = color(black);
  let top = legendPanels[0].y + 36;
  let bottom = legendPanels[0].y + 84;
  let labelY = legendPanels[0].y + 100;

  textFont(font);
  textSize(10);
  textStyle(BOLD);

  // 1. Lunghezza
  let lx = legendPanels[0].x + 34;
  stroke(rule);
  strokeWeight(1);
  line(lx - 16, top, lx + 16, top);
  drawGlyph(meanderPoints(lx, top, labelY - 4, 3, 1), 2.5, sampleColor, 0, "mare");
  noStroke();
  fill(black);
  textAlign(LEFT, CENTER);
  text("sorgente", lx + 22, top);
  text("foce", lx + 22, labelY - 4);

  // 2. Portata
  let dischargeSamples = [1000, 10000, 100000]; // tre spessori
  for (let k = 0; k < 3; k++) {
    let x = legendX(1, k);
    stroke(sampleColor);
    strokeWeight(dischargeToWeight(dischargeSamples[k]));
    strokeCap(ROUND);
    line(x, top, x, bottom);
    noStroke();
    fill(black);
    textAlign(CENTER, BASELINE);
    text(formatShort(dischargeSamples[k]), x, labelY);
  }

  // Bacino
  let areaSamples = [100000, 1000000, 5000000]; // tre ampiezze dei meandri
  for (let k = 0; k < 3; k++) {
    let x = legendX(2, k);
    let pts = meanderPoints(x, top, bottom, areaToAmplitude(areaSamples[k]), 2);
    noFill();
    stroke(sampleColor);
    strokeWeight(2);
    beginShape();
    for (let p of pts) vertex(p.x, p.y);
    endShape();
    noStroke();
    fill(black);
    textAlign(CENTER, BASELINE);
    text(formatShort(areaSamples[k]), x, labelY);
  }

  // Temperatura
  let tp = legendPanels[3];
  let barX = tp.x + 14;
  let barW = tp.w - 28;
  let barY = top + 4;
  let barH = 30;
  strokeWeight(1);
  for (let i = 0; i <= barW; i++) {
    stroke(tempColor(map(i, 0, barW, -10, 30)));
    line(barX + i, barY, barX + i, barY + barH);
  }
  for (let t = -10; t <= 30; t += 10) {
    let x = map(t, -10, 30, barX, barX + barW);
    stroke(black);
    line(x, barY + barH, x, barY + barH + 5);
    noStroke();
    fill(black);
    textAlign(CENTER, BASELINE);
    text(t, constrain(x, barX + 8, barX + barW - 8), labelY);
  }

  // 5. Affluenti
  let tributarySamples = [10, 100, 1000]; // 3, 6, 9 rami
  for (let k = 0; k < 3; k++) {
    let x = legendX(4, k);
    let pts = meanderPoints(x, top, bottom, 0, 0);
    drawGlyph(pts, 2, sampleColor, tributariesToBranches(tributarySamples[k], 100), "none");
    noStroke();
    fill(black);
    textAlign(CENTER, BASELINE);
    text(formatShort(tributarySamples[k]), x, labelY);
  }

  // 6. Foce
  let types = ["mare", "interno", "fiume"];
  for (let k = 0; k < 3; k++) {
    let x = legendPanels[5].x + 24;
    let y = top + 6 + k * 24;
    stroke(sampleColor);
    strokeWeight(2.5);
    line(x, y - 12, x, y);
    drawMouth(x, y, types[k], sampleColor, 2.5);
    noStroke();
    fill(black);
    textAlign(LEFT, CENTER);
    text(outflowLabels[types[k]], x + 16, y);
  }

  textStyle(NORMAL);
  textAlign(LEFT, BASELINE);
}

// -----------------------------------------------------------------------------
// GRAFICO
// -----------------------------------------------------------------------------

// Asse verticale delle lunghezze con linee guida leggere su tutto il grafico
function drawAxis() {
  textFont(font);
  textSize(10);
  textStyle(NORMAL);
  textAlign(RIGHT, CENTER);

  for (let km = 0; km <= maxLength; km += 1000) {
    let y = map(km, 0, maxLength, riverTop, riverBottom);

    // Linea guida orizzontale
    stroke(rule);
    strokeWeight(1);
    drawingContext.setLineDash([2, 4]);
    line(axisX, y, chartPanel.x + chartPanel.w - 16, y);
    drawingContext.setLineDash([]);

    noStroke();
    fill(grey);
    if (km == 0) {
      fill(black);
      textStyle(BOLD);
      text("Sorgente", axisX - 8, y);
      textStyle(NORMAL);
    } else {
      text(formatNumber(km) + " km", axisX - 8, y);
    }
  }

  stroke(black);
  strokeWeight(1.5);
  line(axisX, riverTop, axisX, riverBottom);
  textAlign(LEFT, BASELINE);
}

// Nome di ogni continente sopra il proprio gruppo di fiumi
function drawContinentLabels(active) {
  let activeContinent = "";
  if (active != -1) {
    activeContinent = rivers[active].continent;
  }

  for (let group of groups) {
    let x1 = group.x1 - spacing / 2;
    let x2 = group.x2 + spacing / 2;
    let filled = activeContinent == group.continent;

    // Linea che abbraccia tutti i fiumi del continnete
    stroke(black);
    strokeWeight(1.5);
    line(x1, riverTop - 14, x2, riverTop - 14);

    // Tag con nome e numero di fiumi, se non ci sta solo il nome
    let label = continentNames[group.continent].toUpperCase() + " " + group.count;
    textFont(font);
    textStyle(BOLD);
    textSize(10);
    if (textWidth(label) + 14 > x2 - x1) {
      label = continentNames[group.continent].toUpperCase();
    }
    // L'ultimo gruppo è vicino al bordo, il tag non deve uscire dal pannello
    let tagX = min(x1, chartPanel.x + chartPanel.w - 12 - (textWidth(label) + 14));
    drawTag(label, tagX, chartPanel.y + 18, filled);
  }
}

// Linea tratteggiata dalla foce all'asse
function drawLengthGuide(river) {
  let mouth = river.points[river.points.length - 1];

  stroke(black);
  strokeWeight(1);
  drawingContext.setLineDash([3, 3]);
  line(axisX, mouth.y, mouth.x, mouth.y);
  drawingContext.setLineDash([]);

  // Etichetta nera sopra l'asse
  let label = formatNumber(river.length) + " km";
  textFont(font);
  textStyle(BOLD);
  textSize(10);
  let w = textWidth(label) + 12;
  noStroke();
  fill(black);
  rect(axisX - w - 2, mouth.y - 9, w, 18);
  fill(white);
  textAlign(CENTER, CENTER);
  text(label, axisX - w / 2 - 2, mouth.y);
  textAlign(LEFT, BASELINE);
  textStyle(NORMAL);
}

// Scheda con tutti i dati del fiume attivo, posizionata accanto alla foce
function drawInfoCard(river) {
  let cardW = 290;
  let pad = 16;
  let innerW = cardW - pad * 2;

  // Prima preparo i testi (per sapere quanto deve essere alta la scheda)
  textFont(font);
  textStyle(BOLD);
  textSize(22);
  setTracking(-0.6);
  let nameLines = wrapText(river.name, innerW);
  setTracking(0);

  textStyle(NORMAL);
  textSize(11);
  let countryLines = wrapText(river.countries, innerW);

  let rows = [
    ["Lungheza", formatNumber(river.length) + " km"],
    ["Portata", formatNumber(river.discharge) + " m³/s"],
    ["Bacino", formatNumber(river.area) + " km²"],
    ["Affluenti", formatNumber(river.tributaries)],
    ["Temperatura media", formatDecimal(river.avgTemp) + " °C"],
    ["min / max", formatDecimal(river.minTemp) + " / " + formatDecimal(river.maxTemp) + " °C"],
    ["Foce", river.outflow + " (" + outflowLabels[river.outflowType] + ")"],
  ];

  let headH = pad + 18 + nameLines.length * 24 + 6;
  let cardH = headH + 12 + countryLines.length * 15 + 8 + rows.length * 19 + pad;

  // Poi decido se metterla a destra della foce o a sinistra se non c'è spazio
  let mouth = river.points[river.points.length - 1];
  let x = mouth.x + 26;
  if (x + cardW > chartPanel.x + chartPanel.w - 10) {
    x = mouth.x - 26 - cardW;
  }
  let y = constrain(mouth.y - cardH / 2, riverTop, chartPanel.y + chartPanel.h - cardH - 10);

  // Corpo bianco e testata del colore del fiume
  fill(white);
  stroke(black);
  strokeWeight(1.5);
  rect(x, y, cardW, cardH);
  noStroke();
  fill(river.col);
  rect(x + 0.75, y + 0.75, cardW - 1.5, headH);

  // Su un colore scuro il testo diventa bianco
  let headText = black;
  if (river.avgTemp < 4) {
    headText = white;
  }

  let cy = y + pad + 8;
  fill(headText);
  textStyle(BOLD);
  textSize(10);
  text(continentNames[river.continent].toUpperCase(), x + pad, cy);

  cy += 26;
  textSize(22);
  setTracking(-0.6);
  for (let l of nameLines) {
    text(l, x + pad, cy);
    cy += 24;
  }
  setTracking(0);

  cy = y + headH + 22;
  fill(grey);
  textStyle(NORMAL);
  textSize(11);
  for (let l of countryLines) {
    text(l, x + pad, cy);
    cy += 15;
  }

  cy += 2;
  for (let r of rows) {
    stroke(rule);
    strokeWeight(1);
    line(x + pad, cy - 3, x + cardW - pad, cy - 3);
    noStroke();
    cy += 16;
    fill(grey);
    textStyle(NORMAL);
    textAlign(LEFT, BASELINE);
    text(r[0], x + pad, cy);
    fill(black);
    textStyle(BOLD);
    textAlign(RIGHT, BASELINE);
    // La foce può essere lunga se non ci sta mostro solo il nome
    let value = r[1];
    if (textWidth(value) > innerW - 90) {
      value = river.outflow;
    }
    text(value, x + cardW - pad, cy);
    cy += 3;
  }
  textStyle(NORMAL);
  textAlign(LEFT, BASELINE);
}

// -----------------------------------------------------------------------------
// FUNZIONI DI SUPPORTO
// -----------------------------------------------------------------------------

// Tre posizioni orizzontali per i campioni dentro un riquadro
function legendX(i, k) {
  let p = legendPanels[i];
  return p.x + 28 + k * (p.w - 56) / 2;
}

// Piccola etichetta rettangolare (piena o solo bordo)
function drawTag(label, x, y, filled) {
  textFont(font);
  textStyle(BOLD);
  textSize(10);
  let w = textWidth(label) + 14;
  let h = 20;

  stroke(black);
  strokeWeight(1.2);
  if (filled) {
    fill(black);
  } else {
    noFill();
  }
  rect(x, y, w, h);

  noStroke();
  if (filled) {
    fill(white);
  } else {
    fill(black);
  }
  textAlign(LEFT, CENTER);
  text(label, x + 7, y + h / 2 + 0.5);
  textAlign(LEFT, BASELINE);
  textStyle(NORMAL);
  return w;
}

// Spaziatura tra le lettere (in pixel)
function setTracking(px) {
  drawingContext.letterSpacing = px + "px";
}

// Va a capo quando il testo supera maxWidth
function wrapText(str, maxWidth) {
  let lines = [];
  let line = "";
  let word = "";
  for (let i = 0; i < str.length; i++) {
    word += str[i];
    // posso andare a capo dopo uno spazio, una virgola o un trattino (es. Nile–White Nile)
    if (str[i] == " " || str[i] == "," || str[i] == "–" || i == str.length - 1) {
      if (line != "" && textWidth(line + word) > maxWidth) {
        lines.push(line.trim());
        line = word;
      } else {
        line += word;
      }
      word = "";
    }
  }
  if (line != "") {
    lines.push(line.trim());
  }
  return lines;
}

// 6650 -_> 6.650
function formatNumber(n) {
  let digits = String(n);
  let result = "";
  for (let i = 0; i < digits.length; i++) {
    // metto il punto ogni tre cifre contando da destra
    if (i > 0 && (digits.length - i) % 3 == 0) {
      result += ".";
    }
    result += digits[i];
  }
  return result;
}

// 27.5 -_> 27,5
function formatDecimal(n) {
  return String(n).replace(".", ",");
}

// 1000 --> 1k
// 1000000 -_> 1M
function formatShort(n) {
  if (n >= 1000000) return n / 1000000 + "M";
  if (n >= 1000) return n / 1000 + "k";
  return String(n);
}
