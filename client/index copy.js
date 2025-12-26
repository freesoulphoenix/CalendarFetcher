/* Calendar Fetcher */
/* global CSInterface, cep */

(function () {
  "use strict";

  // -------------------------------------------------
  // JS EXECUTION PROOF
  // -------------------------------------------------
  function markJSRunning() {
    try {
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<div style="color:#0ff;padding:10px;font-size:14px;">JS RUNNING ✅</div>'
      );
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markJSRunning);
  } else {
    markJSRunning();
  }

  // -------------------------------------------------
  // CEP INTERFACE
  // -------------------------------------------------
  var cs = null;
  try {
    cs = new CSInterface();
  } catch (e) {
    console.warn("CSInterface not available");
  }

  // -------------------------------------------------
  // DOM REFERENCES
  // -------------------------------------------------
  var $country = document.getElementById("country");
  var $year = document.getElementById("year");
  var $status = document.getElementById("status");
  var $list = document.getElementById("list");

  var btnFetch = document.getElementById("btnFetch");
  var btnClear = document.getElementById("btnClear");
  var btnCopy = document.getElementById("btnCopy");
  var btnCSV = document.getElementById("btnCSV");
  var btnGenerate = document.getElementById("btnGenerate");

  var lastData = null;

  // -------------------------------------------------
  // INIT
  // -------------------------------------------------
  init();

  function init() {
    if (!$country) return; // safety

    setStatus("Loading countries…");

    fetchJSON("https://date.nager.at/api/v3/AvailableCountries")
      .then(function (countries) {
        countries.sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });

        $country.innerHTML = "";
        countries.forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c.countryCode;
          opt.textContent = c.name + " (" + c.countryCode + ")";
          $country.appendChild(opt);
        });

        $country.value = "ID";
        setStatus("Ready.");
      })
      .catch(function (err) {
        console.error(err);
        setStatus("Failed to load countries.");
      });

    btnFetch && btnFetch.addEventListener("click", onFetch);
    btnClear && btnClear.addEventListener("click", clearUI);
    btnCopy && btnCopy.addEventListener("click", copyJSON);
    btnCSV && btnCSV.addEventListener("click", exportCSV);
    btnGenerate && btnGenerate.addEventListener("click", generateCalendar);
  }

  // -------------------------------------------------
  // FETCH HOLIDAYS
  // -------------------------------------------------
  function onFetch() {
    var year = String($year.value || "").trim();
    var cc = $country.value;

    if (!year || isNaN(Number(year))) {
      setStatus("Invalid year.");
      return;
    }

    setStatus("Fetching " + cc + " " + year + "…");
    $list.innerHTML = "";
    lastData = null;

    var url =
      "https://date.nager.at/api/v3/PublicHolidays/" +
      encodeURIComponent(year) +
      "/" +
      encodeURIComponent(cc);

    fetchJSON(url)
      .then(function (holidays) {
        lastData = holidays;
        renderList(lastData);
        setStatus("Found " + holidays.length + " holidays.");
      })
      .catch(function (err) {
        console.error(err);
        setStatus("Fetch failed.");
      });
  }

  // -------------------------------------------------
  // RENDER
  // -------------------------------------------------
  function renderList(items) {
    $list.innerHTML = "";

    items.forEach(function (h) {
      var div = document.createElement("div");
      div.className = "item";
      div.innerHTML =
        '<div class="date">' + escapeHTML(h.date) + "</div>" +
        "<div>" +
        escapeHTML(h.localName) +
        ' <span class="meta">(' +
        escapeHTML(h.name) +
        ")</span></div>" +
        '<div class="meta">' +
        escapeHTML((h.types || []).join(", ")) +
        (h.global ? " • Global" : "") +
        "</div>";
      $list.appendChild(div);
    });
  }

  // -------------------------------------------------
  // UI ACTIONS
  // -------------------------------------------------
  function clearUI() {
    $list.innerHTML = "";
    lastData = null;
    setStatus("Cleared.");
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

    if (typeof cep === "undefined" || !cep.fs) {
      setStatus("CEP filesystem not available.");
      return;
    }

    var header = ["date","localName","name","countryCode","types","global","counties"];
    var rows = [header];

    lastData.forEach(function (h) {
      rows.push([
        h.date,
        h.localName,
        h.name,
        h.countryCode,
        (h.types || []).join("|"),
        h.global ? "true" : "false",
        (h.counties || []).join("|")
      ]);
    });

    var csv = rows.map(function (r) {
      return r.map(csvCell).join(",");
    }).join("\n");

    var out = cep.fs.showSaveDialogEx("Save holidays CSV", "", ["csv"], "holidays.csv");
    if (out.err || !out.data) return setStatus("Save cancelled.");

    var res = cep.fs.writeFile(out.data, csv, cep.encoding.UTF8);
    if (res.err) return setStatus("Save failed.");

    setStatus("CSV exported.");
  }

  // -------------------------------------------------
  // CEP-SAFE NETWORK (XHR)
  // -------------------------------------------------
  function fetchJSON(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status));
        }
      };

      xhr.onerror = function () {
        reject(new Error("Network error"));
      };

      xhr.send(null);
    });
  }

  // -------------------------------------------------
  // CEP → JSX BRIDGE (NO toSource)
  // -------------------------------------------------
  function generateCalendar() {
    if (!lastData) return setStatus("Fetch holidays first.");
    if (!cs) return setStatus("CSInterface unavailable.");

    var year = Number(String($year.value || "").trim());
    if (!year || isNaN(year)) return setStatus("Invalid year.");

    // Lightweight payload
    var payload = lastData.map(function (h) {
      return {
        date: h.date,
        localName: h.localName,
        name: h.name,
        global: !!h.global,
        counties: h.counties || [],
        types: h.types || []
      };
    });

    var settings = {
      startX: 60,
      startY: 780,
      cellW: 75,
      cellH: 55,
      headerH: 40,
      weekStartsOn: 0,
      fontName: "ArialMT",
      fontSizeDay: 16,
      fontSizeHeader: 20,
      fontSizeLegend: 12,
      colorHoliday: [220, 20, 60],
      colorNormal: [20, 20, 20],
      colorGrid: [70, 70, 70]
    };

    // Pass as strings, then JSX will eval safely
    var payloadStr = JSON.stringify(payload).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    var settingsStr = JSON.stringify(settings).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    setStatus("Generating 12 layers…");

    cs.evalScript(
      "CalendarFetcher_generateYear(" + year + ", '" + payloadStr + "', '" + settingsStr + "')",
      function (res) {
        setStatus(res || "Done.");
      }
    );
  }

  // -------------------------------------------------
  // HELPERS
  // -------------------------------------------------
  function setStatus(msg) {
    if ($status) $status.textContent = msg;
  }

  function csvCell(s) {
    var v = String(s == null ? "" : s);
    if (/[,\"\\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m];
    });
  }
})();
