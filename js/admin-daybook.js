/* ════════════════════════════════════════════════════════════════
   admin-daybook.js
   DAY BOOK — day-by-day statement of receipts (contributions) and
   expenses with a running balance, for any date range.

   Read-only. Uses data already loaded in the admin page:
     data (contributions), expenses, users, types, expenseTypes, yearConfig.
   Entries are placed by PAYMENT DATE (when they were recorded).

   Opening balance  = the year's opening balance from the Year Summary
   settings (YEAR_CONFIG) + every earlier entry of that year — the same
   rule the Year Summary uses (opening = configured value, else carried
   forward). Amounts in PDF use APP.currencyText ("Rs.").
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var PAGE_ROWS = 60;
  var st = { rows: [], opening: 0, from: "", to: "", page: 1, view: [], totals: { in: 0, out: 0, nIn: 0, nOut: 0 } };
  var quickKey = "month";

  /* ── small helpers ── */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
  function cur() { return (window.APP && APP.currency) || "₹"; }
  function curTxt() { return (window.APP && APP.currencyText) || "Rs."; }
  function loc() { return (window.APP && APP.locale) || "en-IN"; }
  function num(n) { return Number(n || 0).toLocaleString(loc()); }
  function inr(n) { return (n < 0 ? "−" : "") + cur() + num(Math.abs(n)); }
  function pdfMoney(n) { return (n < 0 ? "-" : "") + curTxt() + " " + num(Math.abs(n)); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dmy(iso) { return iso ? iso.split("-").reverse().join("-") : "—"; }
  var MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function basis() { var el = $("db_basis"); return el ? el.value : "period"; }
  /* label for a row/day key: a date in "entry" mode, "March 2024" in "period" mode */
  function fday(iso) {
    if (basis() !== "period" || !iso) return dmy(iso);
    return MN[Number(iso.slice(5, 7)) - 1] + " " + iso.slice(0, 4);
  }
  /* period key: yyyy-mm-01 from the entry's Month + Year (falls back to the payment date) */
  function periodDay(year, month, fallback) {
    var y = parseInt(year, 10);
    if (isNaN(y) || y < 2000) return fallback;
    var mi = MN.findIndex(function (m) { return String(month || "").trim().toLowerCase().slice(0, 3) === m.toLowerCase().slice(0, 3); });
    return y + "-" + pad((mi === -1 ? 0 : mi) + 1) + "-01";
  }

  /* payment date (any format the app stores) -> { day: "yyyy-mm-dd", time: "HH:mm:ss" } */
  function stamp(raw) {
    var f = typeof formatPaymentDate === "function" ? String(formatPaymentDate(raw)) : String(raw || "");
    var m = f.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return { day: "", time: "00:00:00" };
    return { day: m[3] + "-" + m[2] + "-" + m[1], time: pad(m[4] || 0) + ":" + pad(m[5] || 0) + ":" + pad(m[6] || 0) };
  }

  function donorName(c) {
    if (String(c.UserId).indexOf("WALKIN_") === 0) {
      var m = String(c.Note || "").match(/(?:Counter Donor|Walk-in):\s*([^|]+)/);
      return { name: m ? m[1].trim() : "Counter Donor", walkin: true };
    }
    var u = (typeof users !== "undefined" ? users : []).find(function (x) { return String(x.UserId) === String(c.UserId); });
    return { name: u ? u.Name : "Unknown", walkin: false };
  }
  function displayReceipt(c) {
    var legacy = (window.APP && APP.legacyReceiptPrefix) || "TRX", pre = (window.APP && APP.receiptPrefix) || "REC";
    return String(c.ReceiptID || "").replace(new RegExp("^" + legacy + "-"), pre + "-");
  }

  /* all transactions, oldest -> newest, each with its own date stamp */
  function buildAll() {
    var out = [];
    var _types = typeof types !== "undefined" ? types : [];
    var _exTypes = typeof expenseTypes !== "undefined" ? expenseTypes : [];
    (typeof data !== "undefined" ? data : []).forEach(function (c, i) {
      var s = stamp(c.PaymentDate); if (!s.day) return;
      var pday = basis() === "period" ? periodDay(c.Year, c.ForMonth, s.day) : s.day;
      var d = donorName(c);
      var t = _types.find(function (x) { return String(x.TypeId) === String(c.TypeId); });
      out.push({
        kind: "in", day: pday, sk: s.day + s.time, time: s.time, seq: i, amount: Number(c.Amount || 0),
        who: d.name, walkin: d.walkin, ref: displayReceipt(c),
        type: (t ? t.TypeName : "Contribution") + (c.ForMonth ? " · " + c.ForMonth + " " + (c.Year || "") : ""),
        mode: c.PaymentMode || "—"
      });
    });
    (typeof expenses !== "undefined" ? expenses : []).forEach(function (e, i) {
      var s = stamp(e.PaymentDate); if (!s.day) return;
      var pday = basis() === "period" ? periodDay(e.Year, e.ForMonth, s.day) : s.day;
      var t = _exTypes.find(function (x) { return String(x.ExpenseTypeId) === String(e.ExpenseTypeId); });
      out.push({
        kind: "out", day: pday, sk: s.day + s.time, time: s.time, seq: 100000 + i, amount: Number(e.Amount || 0),
        who: e.Title || "Expense", walkin: false, ref: String(e.Id || ""),
        type: t ? t.Name : "Expense", mode: "—"
      });
    });
    out.sort(function (a, b) { return a.day.localeCompare(b.day) || a.sk.localeCompare(b.sk) || a.seq - b.seq; });
    return out;
  }

  /* balance at the START of `day`: configured opening of that year (or 0) + the year's earlier entries */
  function openingFor(all, day) {
    var yr = Number(day.slice(0, 4));
    var cfg = {};
    (typeof yearConfig !== "undefined" ? yearConfig : []).forEach(function (r) {
      var y = parseInt(r.Year || r.year, 10);
      var v = Number(r.OpeningBalance || r.Opening_Balance || r.opening_balance || r.Balance || r.balance || 0);
      if (!isNaN(y) && v > 0) cfg[y] = v;
    });
    var cfgYears = Object.keys(cfg).map(Number).filter(function (y) { return y <= yr; }).sort(function (a, b) { return b - a; });
    var base = 0, from = "0000-00-00";
    if (cfgYears.length) { base = cfg[cfgYears[0]]; from = cfgYears[0] + "-01-01"; }
    all.forEach(function (t) {
      if (t.day >= from && t.day < day) base += t.kind === "in" ? t.amount : -t.amount;
    });
    return base;
  }

  /* ── period handling ── */
  function setRange(from, to) { $("db_from").value = from; $("db_to").value = to; }
  function rangeFor(key) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    if (key === "today") return [ymd(now), ymd(now)];
    if (key === "week") { var d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return [ymd(d), ymd(now)]; }
    if (key === "month") return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
    if (key === "lastmonth") return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    if (key === "year") return [y + "-01-01", y + "-12-31"];
    return ["", ""]; // all time
  }
  window.dbQuick = function (key, btn) {
    quickKey = key;
    document.querySelectorAll("#db_quick .db-chip").forEach(function (b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    var r = rangeFor(key);
    setRange(r[0], r[1]);
    window.dbRender(true);
  };
  window.dbCustomDate = function () {
    quickKey = "custom";
    document.querySelectorAll("#db_quick .db-chip").forEach(function (b) { b.classList.remove("active"); });
    window.dbRender(true);
  };

  var _t = null;
  window.dbSearchDebounced = function () { clearTimeout(_t); _t = setTimeout(function () { window.dbRender(true); }, 250); };

  /* Clear All = back to the default view: this month, receipts & expenses, newest first, no search */
  window.dbClear = function () {
    $("db_kind").value = "all"; $("db_basis").value = "period"; $("db_order").value = "desc"; $("db_search").value = "";
    var chip = document.querySelector('#db_quick .db-chip[data-q="month"]');
    window.dbQuick("month", chip);
  };
  window.dbToggleMore = function () {
    var c = $("db_filterCard"); if (!c) return;
    var open = c.classList.toggle("db-open");
    var b = $("db_moreBtn"); if (b) { b.setAttribute("aria-expanded", open ? "true" : "false"); var t = b.querySelector(".db-more-t"); if (t) t.textContent = open ? "Fewer filters" : "More filters"; }
  };

  /* ── compute + draw ── */
  window.dbRender = function (resetPage) {
    if (!$("db_body")) return;
    if (resetPage) st.page = 1;
    var all = buildAll();
    var from = $("db_from").value || "", to = $("db_to").value || "";
    if (from && to && from > to) { var sw = from; from = to; to = sw; setRange(from, to); }
    var kind = $("db_kind").value, q = ($("db_search").value || "").trim().toLowerCase();

    var firstDay = all.length ? all[0].day : ymd(new Date());
    var startDay = from || firstDay;
    st.from = from; st.to = to;
    st.opening = openingFor(all, startDay);

    // chronological running balance across everything in range (search/kind only hide rows, not money)
    var bal = st.opening, inRange = [];
    all.forEach(function (t) {
      if (t.day < startDay || (to && t.day > to)) return;
      bal += t.kind === "in" ? t.amount : -t.amount;
      inRange.push(Object.assign({}, t, { bal: bal }));
    });
    var shown = inRange.filter(function (t) {
      if (kind !== "all" && t.kind !== kind) return false;
      if (q && (t.who + " " + t.ref + " " + t.type + " " + t.mode).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    var tin = 0, tout = 0, nin = 0, nout = 0;
    shown.forEach(function (t) { if (t.kind === "in") { tin += t.amount; nin++; } else { tout += t.amount; nout++; } });
    st.totals = { in: tin, out: tout, nIn: nin, nOut: nout };
    st.closing = inRange.length ? inRange[inRange.length - 1].bal : st.opening;
    st.rows = shown;
    st.filtered = !!(q || kind !== "all");

    // group by day (for the day sub-total rows), respecting the chosen order
    var days = [], map = {};
    shown.forEach(function (t) { if (!map[t.day]) { map[t.day] = { day: t.day, items: [], in: 0, out: 0 }; days.push(map[t.day]); } var g = map[t.day]; g.items.push(t); if (t.kind === "in") g.in += t.amount; else g.out += t.amount; });
    var desc = $("db_order").value === "desc";
    if (desc) { days.reverse(); days.forEach(function (g) { g.items.reverse(); }); }
    var flat = [];
    days.forEach(function (g) {
      // day-end balance = balance after the day's last (chronological) entry
      var last = desc ? g.items[0] : g.items[g.items.length - 1];
      flat.push({ day: g.day, head: true, in: g.in, out: g.out, close: last.bal });
      g.items.forEach(function (t) { flat.push(t); });
    });
    st.view = flat;
    paint();
  };

  function paint() {
    $("db_open").textContent = inr(st.opening);
    $("db_in").textContent = inr(st.totals.in);
    $("db_out").textContent = inr(st.totals.out);
    $("db_close").textContent = inr(st.closing);
    $("db_in_n").textContent = st.totals.nIn + " receipt" + (st.totals.nIn === 1 ? "" : "s");
    $("db_out_n").textContent = st.totals.nOut + " expense" + (st.totals.nOut === 1 ? "" : "s");
    $("db_period").textContent = "(" + (st.from ? dmy(st.from) : "start") + " to " + (st.to ? dmy(st.to) : "latest") + (st.filtered ? " · filtered" : "") + ")";

    var total = st.view.length, pages = Math.max(1, Math.ceil(total / PAGE_ROWS));
    st.page = Math.min(st.page, pages);
    var slice = st.view.slice((st.page - 1) * PAGE_ROWS, st.page * PAGE_ROWS);
    var body = $("db_body");
    if (!total) {
      body.innerHTML = '<tr><td colspan="8" class="db-empty">No entries for this period.</td></tr>';
      $("db_pagination").innerHTML = "";
      return;
    }
    body.innerHTML = slice.map(function (r) {
      if (r.head) {
        return '<tr class="db-day"><td colspan="5">' + esc(fday(r.day)) + '</td>' +
          '<td class="db-num">' + (r.in ? inr(r.in) : "") + '</td><td class="db-num">' + (r.out ? inr(r.out) : "") + '</td>' +
          '<td class="db-num">' + inr(r.close) + '</td></tr>';
      }
      return '<tr><td style="font-size:12px;color:#888;white-space:nowrap;">' + esc(fday(r.day)) + '</td>' +
        '<td><b>' + esc(r.who) + '</b>' + (r.walkin ? '<span class="db-badge">COUNTER</span>' : '') + '</td>' +
        '<td class="db-ref">' + esc(r.ref || "—") + '</td>' +
        '<td style="font-size:12px;">' + esc(r.type) + '</td>' +
        '<td style="font-size:12px;">' + esc(r.mode) + '</td>' +
        '<td class="db-in">' + (r.kind === "in" ? inr(r.amount) : "") + '</td>' +
        '<td class="db-out">' + (r.kind === "out" ? inr(r.amount) : "") + '</td>' +
        '<td class="db-bal' + (r.bal < 0 ? " neg" : "") + '">' + inr(r.bal) + '</td></tr>';
    }).join("");
    if (typeof _renderPagination === "function") _renderPagination("db_pagination", pages, st.page, function (p) { dbGoto(p); });
  }
  window.dbGoto = function (p) { st.page = p; paint(); };

  /* called when the page is opened */
  window.dayBookInit = function () {
    if (!$("db_from")) return;
    if (!$("db_from").value && !$("db_to").value && quickKey === "month") {
      var r = rangeFor("month"); setRange(r[0], r[1]);
    }
    window.dbRender(false);
  };

  /* ── exports (export exactly what is listed, all pages) ── */
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  window.dbExportCSV = function () {
    if (!st.view.length) { toast("No entries to export.", "warn"); return; }
    var lines = [["Date", "Particulars", "Ref", "Type", "Mode", "Receipt (In)", "Expense (Out)", "Balance"].map(csvCell).join(",")];
    lines.push(["", "Opening Balance", "", "", "", "", "", st.opening].map(csvCell).join(","));
    st.view.forEach(function (r) {
      if (r.head) return;
      lines.push([fday(r.day), r.who + (r.walkin ? " (Counter)" : ""), r.ref, r.type, r.mode, r.kind === "in" ? r.amount : "", r.kind === "out" ? r.amount : "", r.bal].map(csvCell).join(","));
    });
    lines.push("");
    lines.push(["", "Total", "", "", "", st.totals.in, st.totals.out, st.closing].map(csvCell).join(","));
    var tag = (st.from || "start") + "_to_" + (st.to || "latest");
    if (typeof _downloadCSV === "function") _downloadCSV(lines.join("\n"), "daybook_" + tag + ".csv");
    toast("✅ " + st.view.filter(function (r) { return !r.head; }).length + " entries exported.");
  };

  window.dbExportPDF = function () {
    if (!st.view.length) { toast("No entries to export.", "warn"); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF library not loaded.", "error"); return; }
    var doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    var W = doc.internal.pageSize.getWidth(), M = 12;
    doc.setFillColor(30, 41, 64); doc.rect(0, 0, W, 24, "F");
    doc.setTextColor(251, 191, 36); doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(((window.APP && APP.name) || "Mandir").toUpperCase(), W / 2, 10, { align: "center" });
    doc.setTextColor(148, 163, 184); doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text("Day Book  |  " + (st.from ? dmy(st.from) : "Start") + " to " + (st.to ? dmy(st.to) : "Latest") + (st.filtered ? "  (filtered)" : ""), W / 2, 17, { align: "center" });

    var rows = st.view.filter(function (r) { return !r.head; }).map(function (r) {
      return [fday(r.day), r.who + (r.walkin ? " (Counter)" : ""), r.ref || "-", r.type, r.mode,
        r.kind === "in" ? pdfMoney(r.amount) : "", r.kind === "out" ? pdfMoney(r.amount) : "", pdfMoney(r.bal)];
    });
    doc.autoTable({
      head: [["Date", "Particulars", "Ref", "Type", "Mode", "Receipt (In)", "Expense (Out)", "Balance"]],
      body: [["", "Opening Balance", "", "", "", "", "", pdfMoney(st.opening)]].concat(rows),
      foot: [["", "Total", "", "", "", pdfMoney(st.totals.in), pdfMoney(st.totals.out), pdfMoney(st.closing)]],
      startY: 28, margin: { left: M, right: M },
      headStyles: { fillColor: [30, 41, 64], textColor: [251, 191, 36], fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 64], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.6 }, alternateRowStyles: { fillColor: [250, 248, 243] },
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } }
    });
    var n = doc.internal.getNumberOfPages(), H = doc.internal.pageSize.getHeight();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text("Generated: " + new Date().toLocaleDateString(loc()) + " | System generated", M, H - 5);
      doc.text("Page " + i + " of " + n, W - M, H - 5, { align: "right" });
    }
    doc.save("DayBook_" + (st.from || "start") + "_to_" + (st.to || "latest") + ".pdf");
    toast("✅ Day Book PDF downloaded.");
  };
})();
