/* Calendar Fetcher - Host (Illustrator ExtendScript)
   Receives:
     CalendarFetcher_generateYear(year, holidaysStr, settingsStr)

   holidaysStr/settingsStr are JSON strings (CEP side JSON.stringify + escaping).
   Styles:
     "grid"   => rectangles + top-left-ish date numbers
     "nogrid" => no rectangles + weekday headers centered + date numbers centered

   Coloring rule (per your latest requirement):
     - Sundays are RED
     - Holidays are RED
     - Nothing else is forced red

   Layers:
     Creates 12 TOP-LEVEL layers (one per month). No root parent layer.
*/

function CalendarFetcher_generateYear(year, holidaysStr, settingsStr) {
  try {
    // CEP bridge: eval is still the most reliable in ExtendScript-land
    var holidays = (holidaysStr && holidaysStr.length) ? eval("(" + holidaysStr + ")") : [];
    var s = (settingsStr && settingsStr.length) ? eval("(" + settingsStr + ")") : {};

    // -----------------------------
    // Coercion helpers
    // -----------------------------
    function num(v, fallback) {
      var n = Number(v);
      return isFinite(n) ? n : fallback;
    }
    function numRGB(arr, fallbackArr) {
      arr = arr || fallbackArr;
      return [num(arr[0], fallbackArr[0]), num(arr[1], fallbackArr[1]), num(arr[2], fallbackArr[2])];
    }

    // -----------------------------
    // Normalize settings
    // -----------------------------
    s.renderStyle  = s.renderStyle || "grid"; // "grid" | "nogrid"
    s.weekStartsOn = num(s.weekStartsOn, 0);  // 0=Sun, 1=Mon

    s.startX  = num(s.startX, 60);
    s.startY  = num(s.startY, 780);

    s.cellW   = num(s.cellW, 75);
    s.cellH   = num(s.cellH, 55);

    s.headerH = num(s.headerH, 40);
    s.legendH = num(s.legendH, 60);

    s.monthCols = num(s.monthCols, 2);
    s.monthGapX = num(s.monthGapX, 50);
    s.monthGapY = num(s.monthGapY, 70);

    s.fontName        = s.fontName || "ArialMT";
    s.fontSizeHeader  = num(s.fontSizeHeader, 28);
    s.fontSizeWeekday = num(s.fontSizeWeekday, 14);
    s.fontSizeDay     = num(s.fontSizeDay, 16);
    s.fontSizeLegend  = num(s.fontSizeLegend, 12);

    // User’s palette
    s.colorHoliday = numRGB(s.colorHoliday, [220, 20, 60]); // red
    s.colorNormal  = numRGB(s.colorNormal,  [20, 20, 20]);  // black-ish
    s.colorGrid    = numRGB(s.colorGrid,    [70, 70, 70]);  // gray

    // Month block size (2x6 layout)
    s.blockW = s.cellW * 7;
    s.blockH = (s.headerH + 18) + (s.cellH * 6) + 18 + s.legendH + 10;

    // -----------------------------
    // Document check
    // -----------------------------
    if (!app.documents.length) return "No document open.";
    var doc = app.activeDocument;

    // -----------------------------
    // Holiday map YYYY-MM-DD -> [label...]
    // -----------------------------
    var holMap = {};
    for (var i = 0; i < holidays.length; i++) {
      var h = holidays[i];
      if (!h || !h.date) continue;

      holMap[h.date] = holMap[h.date] || [];
      var label = (h.localName || "");
      if (h.name) label += " (" + h.name + ")";
      holMap[h.date].push(label);
    }

    // -----------------------------
    // Create 12 TOP-LEVEL layers (one per month)
    // -----------------------------
    for (var m = 0; m < 12; m++) {
      var col = m % s.monthCols;
      var row = Math.floor(m / s.monthCols);

      var x0 = s.startX + col * (s.blockW + s.monthGapX);
      var y0 = s.startY - row * (s.blockH + s.monthGapY);

      var monthLayer = doc.layers.add();
      monthLayer.name = pad2(m + 1) + " " + monthNames()[m] + " " + year;

      generateMonth(doc, monthLayer, year, m, holMap, s, x0, y0);
    }

    return "Generated " + year + " (" + s.renderStyle + ", holidays=" + holidays.length + ").";

  } catch (e) {
    return "Generate failed: " + e.toString();
  }
}

// -----------------------------
// Month renderer
// -----------------------------
function generateMonth(doc, layer, year, monthIndex, holMap, s, x0, y0) {
  doc.activeLayer = layer;

  var drawGrid = (s.renderStyle === "grid");
  var mName = monthNames()[monthIndex];

  // Sunday column index depends on week start
  // weekStartsOn=0 => Sunday is col 0
  // weekStartsOn=1 => Monday is col 0, Sunday becomes col 6
  var sundayCol = (s.weekStartsOn === 1) ? 6 : 0;

  // Title
  var title = addPointText(doc, mName + " " + year, x0, y0);
  setTextStyle(title, s.fontName, s.fontSizeHeader, rgb(s.colorNormal), Justification.LEFT);

  // Weekdays
  var weekdaysSun = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var weekdaysMon = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var week = (s.weekStartsOn === 1) ? weekdaysMon : weekdaysSun;

  var weekTop = y0 - s.headerH;

  for (var c = 0; c < 7; c++) {
    var isSundayHeader = (c === sundayCol);
    var wdColor = isSundayHeader ? rgb(s.colorHoliday) : rgb(s.colorNormal);

    if (drawGrid) {
      var wdL = addPointText(doc, week[c], x0 + c * s.cellW + 6, weekTop);
      setTextStyle(wdL, s.fontName, s.fontSizeWeekday, wdColor, Justification.LEFT);
    } else {
      // Nogrid: truly center header on column center
      var centerX = x0 + c * s.cellW + (s.cellW / 2);
      var wdC = addPointText(doc, week[c], 0, weekTop); // temp left
      setTextStyle(wdC, s.fontName, s.fontSizeWeekday, wdColor, Justification.CENTER);
      centerPointTextOnX(wdC, centerX);
    }
  }

  // Calendar top
  var gridTop = weekTop - 18;

  // Grid rectangles only in grid style
  if (drawGrid) {
    for (var r = 0; r < 6; r++) {
      for (var cc = 0; cc < 7; cc++) {
        var rect = layer.pathItems.rectangle(
          gridTop - (r * s.cellH),
          x0 + (cc * s.cellW),
          s.cellW,
          s.cellH
        );
        rect.stroked = true;
        rect.strokeWidth = 1;
        rect.strokeColor = rgb(s.colorGrid);
        rect.filled = false;
      }
    }
  }

  // Dates placement
  var firstDow = dayOfWeek(year, monthIndex, 1); // 0=Sun..6=Sat
  if (s.weekStartsOn === 1) firstDow = (firstDow + 6) % 7; // Monday=0..Sunday=6

  var dim = daysInMonth(year, monthIndex);
  var legendItems = [];

  for (var d = 1; d <= dim; d++) {
    var pos = firstDow + (d - 1);
    var rr = Math.floor(pos / 7);
    var cc2 = pos % 7;

    var dateStr = formatDate(year, monthIndex + 1, d);
    var isHoliday = !!holMap[dateStr];
    var isSundayCell = (cc2 === sundayCol);

    // ✅ Only Sunday or holiday are red
    var dayColor = (isHoliday || isSundayCell) ? rgb(s.colorHoliday) : rgb(s.colorNormal);

    if (drawGrid) {
      // top-left-ish
      var dayTf = addPointText(
        doc,
        "" + d,
        x0 + cc2 * s.cellW + 6,
        gridTop - rr * s.cellH - 6
      );
      setTextStyle(dayTf, s.fontName, s.fontSizeDay, dayColor, Justification.LEFT);
    } else {
      // nogrid: truly center number under the weekday column center
      var centerX2 = x0 + cc2 * s.cellW + (s.cellW / 2);
      var centerY2 = (gridTop - rr * s.cellH) - (s.cellH / 2);

      var t = addPointText(doc, "" + d, 0, centerY2 + (s.fontSizeDay / 2)); // temp left
      setTextStyle(t, s.fontName, s.fontSizeDay, dayColor, Justification.CENTER);
      centerPointTextOnX(t, centerX2);
    }

    // Legend: holidays only (NOT Sundays unless they are holidays)
    if (isHoliday) {
      var names = holMap[dateStr].join(" / ");
      legendItems.push(formatLegendShort(dateStr, names));
    }
  }

  // Legend (wrapped, red)
  var legendTop = gridTop - (6 * s.cellH) - 18;
  var legendLeft = x0;

  var legendText = legendItems.length ? legendItems.join("; ") : "";
  var maxChars = Math.max(30, Math.floor((s.blockW / 8)));
  var wrapped = wrapLegend(legendText, maxChars);

  if (wrapped) {
    var legend = addPointText(doc, wrapped, legendLeft, legendTop);
    setTextStyle(legend, s.fontName, s.fontSizeLegend, rgb(s.colorHoliday), Justification.LEFT);
  }
}

// -----------------------------
// Text helpers
// -----------------------------
function addPointText(doc, contents, left, top) {
  var tf = doc.textFrames.add();
  tf.contents = contents;
  tf.left = left;
  tf.top = top;
  return tf;
}

// Center point text by moving its left so its visual center matches centerX.
// IMPORTANT: Call this AFTER setTextStyle, because width depends on font size + font.
function centerPointTextOnX(tf, centerX) {
  try {
    tf.left = centerX - (tf.width / 2);
  } catch (e) {}
}

function setTextStyle(tf, fontName, fontSize, color, justification) {
  try { tf.textRange.characterAttributes.textFont = app.textFonts.getByName(fontName); } catch (e) {}
  tf.textRange.characterAttributes.size = fontSize;
  tf.textRange.characterAttributes.fillColor = color;

  try {
    tf.textRange.paragraphAttributes.justification = (justification || Justification.LEFT);
  } catch (e2) {}
}

function wrapLegend(text, maxChars) {
  if (!text) return "";

  var parts = text.split("; ");
  var lines = [];
  var line = "";

  for (var i = 0; i < parts.length; i++) {
    var chunk = parts[i];
    if (!line) { line = chunk; continue; }

    var candidate = line + "; " + chunk;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      lines.push(line);
      line = chunk;
    }
  }
  if (line) lines.push(line);

  return lines.join("\r"); // Illustrator newline
}

// -----------------------------
// Color + date helpers
// -----------------------------
function rgb(arr) {
  var c = new RGBColor();
  c.red = Number(arr[0]);
  c.green = Number(arr[1]);
  c.blue = Number(arr[2]);
  return c;
}

function monthNames() {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"];
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

function dayOfWeek(y, m, d) { return new Date(y, m, d).getDay(); }

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

function formatDate(y, mm, dd) {
  var m2 = (mm < 10 ? "0" : "") + mm;
  var d2 = (dd < 10 ? "0" : "") + dd;
  return y + "-" + m2 + "-" + d2;
}

// "YYYY-MM-DD" + name -> "Apr 3 - Name"
function formatLegendShort(dateStr, names) {
  var parts = dateStr.split("-");
  var m = Number(parts[1]);
  var d = Number(parts[2]);
  var mShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return mShort[m - 1] + " " + d + " - " + names;
}
