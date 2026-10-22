/* ════════════════════════════════════════════════════════════════
   admin-event-report.js
   EVENT-WISE REPORT (PDF)

   • exportEventReportPDF(eventId) — one event: budget vs actual spend,
     expense list, spend by type and (when the event has start + end
     dates) the contributions received during those dates.
   • exportAllEventsReportPDF()    — one-page summary of the events shown
     on the Events page (respects the Status / Category filters).

   Read-only: uses the data already loaded on the page (_events,
   _eventExpenses, data, expenseTypes). Nothing is written anywhere.
   Amounts use APP.currencyText ("Rs.") because the PDF font cannot draw ₹.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  function cur() { return (window.APP && APP.currencyText) || "Rs."; }
  function loc() { return (window.APP && APP.locale) || "en-IN"; }
  function money(n) { return cur() + " " + Number(n || 0).toLocaleString(loc()); }
  function nameOf() { return (window.APP && APP.name) || "Mandir"; }

  function pdfReady() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF library not loaded.", "error"); return null; }
    return new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  }

  /* "2026-10-20", "2026-10-20T00:00:00.000Z", "20-10-2026" … -> "yyyy-mm-dd" or "" */
  function isoDay(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    var d = new Date(s);
    if (!isNaN(d)) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return "";
  }
  function showDay(v) {
    var d = isoDay(v);
    return d ? d.split("-").reverse().join("-") : "—";
  }
  function payDay(v) {   // contribution/expense PaymentDate "dd-MM-yyyy HH:mm:ss" -> "yyyy-mm-dd"
    return isoDay(String(v || "").split(" ")[0]);
  }
  function typeName(id) {
    var t = (typeof expenseTypes !== "undefined" ? expenseTypes : []).find(function (x) { return String(x.ExpenseTypeId) === String(id); });
    return t ? t.Name : "Other";
  }
  function expensesOf(eventId) {
    return (typeof _eventExpenses !== "undefined" ? _eventExpenses : []).filter(function (x) { return String(x.EventId) === String(eventId); });
  }
  function sum(list) { return list.reduce(function (s, x) { return s + Number(x.Amount || 0); }, 0); }

  function header(doc, title, sub) {
    var W = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 41, 64); doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(15, 118, 110); doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(nameOf().toUpperCase(), W / 2, 12, { align: "center" });
    doc.setTextColor(148, 163, 184); doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text(title, W / 2, 20, { align: "center" });
    if (sub) { doc.setFontSize(8); doc.text(sub, W / 2, 25, { align: "center" }); }
    doc.setTextColor(30, 41, 64);
  }
  function footers(doc) {
    var n = doc.internal.getNumberOfPages();
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var gen = new Date().toLocaleDateString(loc());
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text("Generated: " + gen + " | " + nameOf() + " | System generated", 14, H - 6);
      doc.text("Page " + i + " of " + n, W - 14, H - 6, { align: "right" });
    }
  }
  function slug(s) { return String(s || "event").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "event"; }

  /* ── one event ── */
  window.exportEventReportPDF = function (eventId) {
    var ev = (typeof _events !== "undefined" ? _events : []).find(function (x) { return String(x.EventId) === String(eventId); });
    if (!ev) { toast("Event not found.", "error"); return; }
    var doc = pdfReady(); if (!doc) return;
    var W = doc.internal.pageSize.getWidth(), M = 14;

    var exps = expensesOf(eventId).slice().sort(function (a, b) { return payDay(a.PaymentDate).localeCompare(payDay(b.PaymentDate)); });
    var spent = sum(exps), budget = Number(ev.Budget || 0);
    var remaining = budget - spent;
    var pct = budget > 0 ? Math.round(spent / budget * 100) : null;

    header(doc, "Event Report", ev.EventName || "");
    var Y = 38;
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(String(ev.EventName || "Untitled"), M, Y); Y += 6;
    doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(100, 116, 139);
    doc.text([ev.Category || "—", ev.Status || "—", showDay(ev.StartDate) + "  to  " + showDay(ev.EndDate)].join("   |   "), M, Y); Y += 5;
    if (ev.Description) { var dl = doc.splitTextToSize(String(ev.Description), W - 2 * M); doc.text(dl, M, Y); Y += dl.length * 4.2 + 1; }
    doc.setTextColor(30, 41, 64); Y += 2;

    // summary
    var summary = [
      ["Budget", budget > 0 ? money(budget) : "No budget set"],
      ["Total spent (" + exps.length + " items)", money(spent)],
      [budget > 0 ? (remaining < 0 ? "Over budget by" : "Remaining") : "Remaining", budget > 0 ? money(Math.abs(remaining)) : "—"]
    ];
    if (pct !== null) summary.push(["Budget used", pct + "%"]);

    // contributions received during the event dates (contributions are not linked to events,
    // so this is matched by payment date and labelled as such)
    var from = isoDay(ev.StartDate), to = isoDay(ev.EndDate), coll = null;
    if (from && to && typeof data !== "undefined") {
      var inRange = data.filter(function (c) { var d = payDay(c.PaymentDate); return d && d >= from && d <= to; });
      coll = { total: sum(inRange), count: inRange.length };
      summary.push(["Contributions received during event dates", money(coll.total) + "  (" + coll.count + " receipts)"]);
      summary.push(["Collected minus spent", (coll.total - spent < 0 ? "-" : "") + money(Math.abs(coll.total - spent))]);
    }
    doc.autoTable({
      body: summary, startY: Y, theme: "grid", margin: { left: M, right: M },
      styles: { fontSize: 9.5, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [241, 245, 249], cellWidth: 80 }, 1: { halign: "right" } }
    });
    Y = doc.lastAutoTable.finalY + 4;
    if (coll) {
      doc.setFontSize(7.5); doc.setTextColor(120, 130, 145);
      var note = doc.splitTextToSize("Contributions are not linked to events in the system. This line adds every contribution whose payment date falls between the event's start and end dates.", W - 2 * M);
      doc.text(note, M, Y); Y += note.length * 3.4 + 4; doc.setTextColor(30, 41, 64);
    }

    // spend by type
    var byType = {};
    exps.forEach(function (x) { var t = typeName(x.ExpenseTypeId); byType[t] = (byType[t] || 0) + Number(x.Amount || 0); });
    var typeRows = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; })
      .map(function (t) { return [t, money(byType[t]), spent > 0 ? Math.round(byType[t] / spent * 100) + "%" : "—"]; });
    if (typeRows.length) {
      doc.setFontSize(11); doc.setFont(undefined, "bold"); doc.text("Spend by type", M, Y); Y += 2;
      doc.autoTable({
        head: [["Type", "Amount", "Share"]], body: typeRows, startY: Y + 1, margin: { left: M, right: M },
        headStyles: { fillColor: [30, 41, 64], textColor: [15, 118, 110], fontSize: 9 }, styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } }
      });
      Y = doc.lastAutoTable.finalY + 8;
    }

    // expense list
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    if (Y > 255) { doc.addPage(); Y = 20; }
    doc.text("Expense details", M, Y); Y += 2;
    var rows = exps.map(function (x, i) {
      return [i + 1, showDay(payDay(x.PaymentDate)), String(x.Title || "—"), typeName(x.ExpenseTypeId), String(x.ForMonth || "—"), money(x.Amount)];
    });
    doc.autoTable({
      head: [["#", "Date", "Title", "Type", "Month", "Amount"]], body: rows.length ? rows : [["", "", "No expenses recorded", "", "", ""]],
      foot: rows.length ? [["", "", "Total", "", "", money(spent)]] : undefined,
      startY: Y + 1, margin: { left: M, right: M },
      headStyles: { fillColor: [30, 41, 64], textColor: [15, 118, 110], fontSize: 9 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 64], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8.5 }, alternateRowStyles: { fillColor: [250, 248, 243] },
      columnStyles: { 0: { cellWidth: 9 }, 5: { halign: "right" } }
    });

    footers(doc);
    doc.save("EventReport_" + slug(ev.EventName) + "_" + new Date().toISOString().slice(0, 10) + ".pdf");
    toast("✅ Event report downloaded.");
  };

  /* ── all events (as filtered on the page) ── */
  window.exportAllEventsReportPDF = function () {
    var all = typeof _events !== "undefined" ? _events : [];
    var fs = (document.getElementById("ev_filter_status") || {}).value || "";
    var fc = (document.getElementById("ev_filter_cat") || {}).value || "";
    var list = all.filter(function (e) { return (!fs || e.Status === fs) && (!fc || e.Category === fc); });
    if (!list.length) { toast("No events to report.", "warn"); return; }
    var doc = pdfReady(); if (!doc) return;
    var M = 14;
    var order = { Active: 0, Upcoming: 1, Completed: 2 };
    list = list.slice().sort(function (a, b) { return (order[a.Status] == null ? 3 : order[a.Status]) - (order[b.Status] == null ? 3 : order[b.Status]); });

    var tb = 0, ts = 0;
    var rows = list.map(function (e) {
      var spent = sum(expensesOf(e.EventId)), budget = Number(e.Budget || 0);
      tb += budget; ts += spent;
      var rem = budget > 0 ? budget - spent : null;
      return [
        String(e.EventName || "Untitled"), String(e.Category || "—"), String(e.Status || "—"),
        showDay(e.StartDate) + " to " + showDay(e.EndDate),
        budget > 0 ? money(budget) : "—", money(spent),
        rem === null ? "—" : (rem < 0 ? "-" : "") + money(Math.abs(rem)),
        budget > 0 ? Math.round(spent / budget * 100) + "%" : "—"
      ];
    });
    header(doc, "Events Summary Report", (fs || "All status") + "  |  " + (fc || "All categories"));
    doc.autoTable({
      head: [["Event", "Category", "Status", "Dates", "Budget", "Spent", "Remaining", "Used"]],
      body: rows,
      foot: [["Total", "", "", "", tb > 0 ? money(tb) : "—", money(ts), "", ""]],
      startY: 34, margin: { left: M, right: M },
      headStyles: { fillColor: [30, 41, 64], textColor: [15, 118, 110], fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 64], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.8 }, alternateRowStyles: { fillColor: [250, 248, 243] },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } }
    });
    footers(doc);
    doc.save("EventsSummary_" + new Date().toISOString().slice(0, 10) + ".pdf");
    toast("✅ Events summary downloaded.");
  };
})();
