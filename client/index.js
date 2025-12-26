/* Calendar Fetcher (CEP Panel) */
/* global CSInterface, cep */

(function () {
  "use strict";

  // -----------------------------
  // CSInterface
  // -----------------------------
  var cs = null;
  try {
    cs = new CSInterface();
  } catch (e) {
    // If this fails, you're not in CEP.
    console.warn("CSInterface not available:", e);
  }

  // -----------------------------
  // DOM
  // -----------------------------
  var $country = document.getElementById("country");
  var $year = document.getElementById("year");
  var $style = document.getElementById("style");
  var $status = document.getElementById("status");
  var $list = document.getElementById("list");

  var btnFetch = document.getElementById("btnFetch");
  var btnClear = document.getElementById("btnClear");
  var btnCopy = document.getElementById("btnCopy");
  var btnCSV = document.getElementById("btnCSV");
  var btnGenerate = document.getElementById("btnGenerate");

  // Optional holiday data (can be null)
  var lastData = null;

  init();

  // -----------------------------
  // INIT
  // -----------------------------
  function init() {
    setStatus("Loading countries… (optional)");

    // Countries are only needed if user wants Fetch.
    fetchJSON("https://date.nager.at/api/v3/AvailableCountries")
      .then(function (countries) {
        countries.sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });

        if ($country) {
          $country.innerHTML = "";
          countries.forEach(function (c) {
            var opt = document.createElement("option");
            opt.value = c.countryCode;
            opt.textContent = c.name + " (" + c.countryCode + ")";
            $country.appendChild(opt);
          });
          $country.value = "ID";
        }

        setStatus("Ready. (Fetch is optional)");
      })
      .catch(function (err) {
        console.error(err);
        setStatus("Countries failed to load. You can still Generate (no holidays).");
      });

    if (btnFetch) btnFetch.addEventListener("click", onFetch);
    if (btnClear) btnClear.addEventListener("click", clearUI);
    if (btnCopy) btnCopy.addEventListener("click", copyJSON);
    if (btnCSV) btnCSV.addEventListener("click", exportCSV);
    if (btnGenerate) btnGenerate.addEventListener("click", generateCalendar);
  }

  // -----------------------------
  // FETCH HOLIDAYS (optional)
  // -----------------------------
  function onFetch() {
    var year = String(($year && $year.value) || "").trim();
    if (!year || isNaN(Number(year))) return setStatus("Invalid year.");

    var cc = ($country && $country.value) ? $country.value : "";
    if (!cc) return setStatus("Pick a country (or just Generate without holidays).");

    setStatus("Fetching holidays for " + cc + " " + year + "…");
    if ($list) $list.innerHTML = "";
    lastData = null;

    var url =
      "https://date.nager.at/api/v3/PublicHolidays/" +
      encodeURIComponent(year) +
      "/" +
      encodeURIComponent(cc);

    fetchJSON(url)
      .then(function (holidays) {
        lastData = holidays || [];
        renderList(lastData);
        setStatus("Found " + lastData.length + " holidays.");
      })
      .catch(function (err) {
        console.error(err);
        lastData = null;
        setStatus("Holiday fetch failed. You can still Generate without holidays.");
      });
  }

  // -----------------------------
  // GENERATE (works with or without holidays)
  // -----------------------------
  function generateCalendar() {
    if (!cs) return setStatus("CSInterface unavailable (not running in CEP?).");

    var year = Number(String(($year && $year.value) || "").trim());
    if (!year || isNaN(year)) return setStatus("Invalid year.");

    var style = ($style && $style.value) ? $style.value : "grid"; // "grid" | "nogrid"

    // Holidays optional
    var holidays = (lastData && lastData.length) ? lastData : [];

    // Keep payload predictable + small
    var payload = holidays.map(function (h) {
      return {
        date: h.date,
        localName: h.localName,
        name: h.name
      };
    });

    // Settings (you can tweak later)
    var settings = {
      renderStyle: style,  // "grid" | "nogrid"
      weekStartsOn: 0,     // 0=Sun, 1=Mon

      // Layout
      startX: 60,
      startY: 780,
      cellW: 75,
      cellH: 55,
      headerH: 40,
      legendH: 60,

      monthCols: 2,
      monthGapX: 50,
      monthGapY: 70,

      // Typography
      fontName: "ArialMT",
      fontSizeHeader: 28,
      fontSizeWeekday: 14,
      fontSizeDay: 16,
      fontSizeLegend: 12,

      // Colors
      colorHoliday: [220, 20, 60],
      colorNormal: [20, 20, 20],
      colorGrid: [70, 70, 70]
    };

    // IMPORTANT: pass as escaped strings (stable in CEP)
    var payloadStr = safeJSONStringify(payload);
    var settingsStr = safeJSONStringify(settings);

    setStatus("Generating 12 months…");

    cs.evalScript(
      "CalendarFetcher_generateYear(" + year + ", '" + payloadStr + "', '" + settingsStr + "')",
      function (res) {
        setStatus(res || "Done.");
      }
    );
  }

  function safeJSONStringify(obj) {
    // Escape for single-quoted JSX call
    return JSON.stringify(obj)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'");
  }

  // -----------------------------
  // UI helpers
  // -----------------------------
  function renderList(items) {
    if (!$list) return;
    $list.innerHTML = "";
    items.forEach(function (h) {
      var div = document.createElement("div");
      div.className = "item";
      div.innerHTML =
        '<div class="date">' + escapeHTML(h.date) + "</div>" +
        "<div>" + escapeHTML(h.localName) +
        ' <span class="meta">(' + escapeHTML(h.name) + ")</span></div>";
      $list.appendChild(div);
    });
  }

  function clearUI() {
    if ($list) $list.innerHTML = "";
    lastData = null;
    setStatus("Cleared. (Generate works without holidays)");
  }

  function copyJSON() {
    if (!lastData) return setStatus("Nothing to copy.");
    var text = JSON.stringify(lastData, null, 2);
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    setStatus("Copied JSON.");
  }

  function exportCSV() {
    if (!lastData) return setStatus("Nothing to export.");
    if (typeof cep === "undefined" || !cep.fs) return setStatus("CEP filesystem not available.");

    var header = ["date", "localName", "name", "countryCode"];
    var rows = [header];

    lastData.forEach(function (h) {
      rows.push([h.date, h.localName, h.name, h.countryCode || ""]);
    });

    var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");

    var out = cep.fs.showSaveDialogEx("Save holidays CSV", "", ["csv"], "holidays.csv");
    if (out.err || !out.data) return setStatus("Save cancelled.");

    var res = cep.fs.writeFile(out.data, csv, cep.encoding.UTF8);
    if (res.err) return setStatus("Save failed.");

    setStatus("CSV exported.");
  }

  // -----------------------------
  // Network (XHR for CEP)
  // -----------------------------
  function fetchJSON(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { reject(e); }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };

      xhr.onerror = function () { reject(new Error("Network error")); };
      xhr.send(null);
    });
  }

  function setStatus(msg) {
    if ($status) $status.textContent = msg;
  }

  function csvCell(s) {
    var v = String(s == null ? "" : s);
    if (/[,"\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
    });
  }
})();
