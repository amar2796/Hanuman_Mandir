/* ════════════════════════════════════════════════════════════════
   admin-select-mode.js
   SELECT MODE for the Contribution, Expense and Users lists

   • The tick-box column is hidden by default. Press "Select" to turn it on
     (the button becomes "Done"); "Done" clears the ticks and hides it again.
   • Once ≥1 row is ticked a bar appears with the count and EXPORT SELECTED.
     Bulk delete / approve were removed on purpose — export only.
   • After the list is redrawn (page change, filter, refresh) the bar is
     re-counted so it never shows a stale "N selected".
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  try {
    var st = document.createElement("style");
    st.textContent = [
      ".table-v2-wrap:not(.sel-mode) .row-check{display:none;}",
      ".sel-row{display:flex;justify-content:flex-end;margin:0 0 8px;}",
      ".sel-toggle{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;border:1.5px solid #cbd5e1;background:#fff;color:#475569;font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:none;transform:none;}",
      ".sel-toggle:hover{border-color:#334155;color:#334155;}",
      ".sel-toggle.on{background:#334155;border-color:#334155;color:#fff;}",
      "body.dark-mode .sel-toggle{background:#111827;border-color:#2d3f58;color:#94a3b8;}",
      "body.dark-mode .sel-toggle.on{background:#C1440E;border-color:#C1440E;color:#fff;}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function wrapOf(tbodyId) {
    var tb = document.getElementById(tbodyId);
    return tb ? tb.closest(".table-v2-wrap") : null;
  }

  window._selModeToggle = function (btn, tbodyId, barId, countId) {
    var wrap = wrapOf(tbodyId);
    if (!wrap) return;
    var on = !wrap.classList.contains("sel-mode");
    wrap.classList.toggle("sel-mode", on);
    btn.classList.toggle("on", on);
    var label = btn.querySelector("span");
    if (label) label.textContent = on ? "Done" : "Select";
    if (!on) {
      // leaving select mode: untick everything (incl. the header "select all") and hide the bar
      wrap.querySelectorAll(".cr2-row-check, thead input[type=checkbox]").forEach(function (cb) { cb.checked = false; });
      if (typeof window._bulkOnRowCheck === "function") window._bulkOnRowCheck(tbodyId, barId, countId);
    }
    watch(tbodyId, barId, countId);
  };

  // keep the count in step when the table body is redrawn
  function watch(tbodyId, barId, countId) {
    var tb = document.getElementById(tbodyId);
    if (!tb || tb._selWatched) return;   // flag lives on the element, so a re-loaded page gets a fresh observer
    tb._selWatched = true;
    new MutationObserver(function () {
      if (typeof window._bulkOnRowCheck === "function") window._bulkOnRowCheck(tbodyId, barId, countId);
      var head = tb.closest("table") && tb.closest("table").querySelector("thead input[type=checkbox]");
      if (head) head.checked = false;
    }).observe(tb, { childList: true });
  }

  function ids(tbodyId) {
    return Array.prototype.slice.call(document.querySelectorAll("#" + tbodyId + " .cr2-row-check:checked"))
      .map(function (cb) { return cb.getAttribute("data-id"); }).filter(Boolean);
  }

  window.exportSelectedExpenseCSV = function () {
    var sel = ids("expenseRecordsBody");
    if (!sel.length) { toast("No rows selected.", "warn"); return; }
    exportExpenseCSV(expenses.filter(function (e) { return sel.indexOf(String(e.Id)) !== -1; }));
  };

  window.exportSelectedUsersCSV = function () {
    var sel = ids("userTable");
    if (!sel.length) { toast("No rows selected.", "warn"); return; }
    exportUsersCSV(users.filter(function (u) { return sel.indexOf(String(u.UserId)) !== -1; }));
  };
})();
