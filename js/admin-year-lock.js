/* ════════════════════════════════════════════════════════════════
   admin-year-lock.js
   YEAR LOCK — one Lock / Unlock switch per year (Year Summary page).

   • Stored in the YEAR_CONFIG sheet, column "Locked" (TRUE/FALSE), next to the
     opening balance — so it survives refresh and is shared by all admins.
   • Unlocked year  → works exactly as before.
   • Locked year    → no add / edit / delete of contributions or expenses.
                      Viewing, exports, PDFs, receipt email resend still work.
   • The year used is the entry's Year field (NOT PaymentDate).
   • The backend (appscript.txt) enforces the same rule; this file gives the
     friendly pop-up and stops the request early.

   Existing functions are wrapped, never rewritten: the original runs
   untouched whenever the year is not locked.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }

  /* ── lock state (from the YEAR_CONFIG rows already loaded) ── */
  function isTrue(v) {
    v = String(v == null ? "" : v).trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1" || v === "locked";
  }
  function lockedSet() {
    var set = {};
    (typeof yearConfig !== "undefined" ? yearConfig : []).forEach(function (r) {
      var y = parseInt(r.Year || r.year, 10);
      if (!isNaN(y) && isTrue(r.Locked)) set[y] = true;
    });
    return set;
  }
  function isLocked(y) { y = parseInt(y, 10); return !isNaN(y) && lockedSet()[y] === true; }
  window._yearIsLocked = isLocked;

  function entryYear(kind, id) {
    var list = kind === "exp" ? (typeof expenses !== "undefined" ? expenses : []) : (typeof data !== "undefined" ? data : []);
    var r = list.find(function (x) { return String(x.Id) === String(id); });
    return r ? r.Year : "";
  }

  /* ── the pop-up ── */
  var _popupOpen = false;
  function showLockedPopup(year) {
    if (typeof openModal !== "function") { alert("Year " + year + " is locked."); return; }
    _popupOpen = true;
    openModal(
      '<div style="height:4px;background:#475569;border-radius:16px 16px 0 0;"></div>' +
      '<div class="_mbdy" style="text-align:center;padding:24px 26px 24px;">' +
      '<div style="width:64px;height:64px;border-radius:50%;margin:0 auto 14px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;">🔒</div>' +
      '<p style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 8px;">Year ' + esc(year) + ' is locked</p>' +
      '<p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.5;">You can’t add, edit or delete entries for ' + esc(year) +
      '.<br>To change them, open <b>Year Summary</b> and unlock ' + esc(year) + ' first.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
      '<button class="_mbtn" id="_ylOpenBtn" style="background:#475569;min-width:130px;">Open Year Summary</button>' +
      '<button class="_mbtn" id="_ylOkBtn" style="background:transparent;color:#64748b;border:1.5px solid #e2e8f0;min-width:90px;">OK</button>' +
      '</div></div>', "380px");
    setTimeout(function () {
      var ok = document.getElementById("_ylOkBtn"), go = document.getElementById("_ylOpenBtn");
      if (ok) ok.addEventListener("click", function () { _popupOpen = false; closeModal(); });
      if (go) go.addEventListener("click", function () {
        _popupOpen = false; closeModal();
        try { if (typeof spClose === "function") spClose(); } catch (e) {}
        var li = document.querySelector("[onclick*=\"showPage('yearSummaryPage'\"]");
        if (typeof showPage === "function") showPage("yearSummaryPage", li || undefined);
      });
    }, 0);
  }
  window._showYearLockedPopup = showLockedPopup;

  /* ── wrap helper: run `check()` first; if it returns a locked year, show pop-up and stop ── */
  function guard(name, check) {
    var orig = window[name];
    if (typeof orig !== "function" || orig._ylWrapped) return;
    var w = function () {
      var y = null;
      try { y = check.apply(null, arguments); } catch (e) { y = null; }
      if (y) { showLockedPopup(y); return; }
      return orig.apply(this, arguments);
    };
    w._ylWrapped = true;
    window[name] = w;
  }
  function selYear(id) { var el = document.getElementById(id); return el && isLocked(el.value) ? el.value : null; }
  function rowYear(kind) { return function (id) { var y = entryYear(kind, id); return isLocked(y) ? y : null; }; }

  /* ── PRE-CHECKS (friendly, before the request) ── */
  function installGuards() {
    guard("openEditContrib", rowYear("c"));
    guard("openEditExpense", rowYear("exp"));
    guard("deleteContribution", rowYear("c"));
    guard("deleteExpense", rowYear("exp"));
    guard("addContribution", function () { return selYear("contribYear"); });
    guard("addExpense", function () { return selYear("expYear"); });
    guard("runBulkInsert", function () { return selYear("bk_year"); });
    guard("saveWalkIn", function () { return selYear("wi_year"); });
    guard("_submitExpenseFromPreview", function () { return selYear("prev_exp_year"); });
  }

  /* ── SAFETY NET on every request (covers edit-save, undo, bulk rows, review-step edits …) ── */
  var WRITE = { addContribution: 1, updateContribution: 1, deleteContribution: 1, addExpense: 1, updateExpense: 1, deleteExpense: 1 };
  function payloadYears(p) {
    var ys = [];
    if (p.Year) ys.push(p.Year);
    if (p.action === "updateContribution" || p.action === "deleteContribution") ys.push(entryYear("c", p.Id));
    if (p.action === "updateExpense" || p.action === "deleteExpense") ys.push(entryYear("exp", p.Id));
    return ys;
  }
  function installPostGuard() {
    var orig = window.postData;
    if (typeof orig !== "function" || orig._ylWrapped) return;
    var w = function (p) {
      if (p && WRITE[p.action]) {
        var ys = payloadYears(p), hit = null;
        for (var i = 0; i < ys.length; i++) if (isLocked(ys[i])) { hit = ys[i]; break; }
        if (hit) {
          if (!_popupOpen) showLockedPopup(hit);
          return Promise.resolve({ status: "error", errorCode: "year_locked", year: Number(hit), message: "Year " + hit + " is locked." });
        }
      }
      return orig.apply(this, arguments).then(function (res) {
        // another admin locked it after this page loaded → server refused
        if (res && res.errorCode === "year_locked") {
          if (res.year) markLocked(res.year, true);
          if (!_popupOpen) showLockedPopup(res.year || "");
        }
        return res;
      });
    };
    w._ylWrapped = true;
    window.postData = w;
  }

  /* ── keep the in-memory yearConfig in step ── */
  function markLocked(year, locked) {
    year = Number(year);
    if (typeof yearConfig === "undefined") return;
    var row = yearConfig.find(function (r) { return parseInt(r.Year || r.year, 10) === year; });
    if (!row) { row = { Year: year, OpeningBalance: "" }; yearConfig.push(row); }
    row.Locked = locked ? "TRUE" : "FALSE";
    try { if (typeof dash_yearConfig !== "undefined") dash_yearConfig = yearConfig.slice(); } catch (e) {}
    decorate(document.body);
  }

  /* ── DECORATION (observer): year dropdowns, Edit/Delete buttons, Year Summary rows ── */
  var FORM_YEAR_SELECTS = ["contribYear", "expYear", "bk_year", "wi_year", "prev_year", "prev_exp_year", "wprev_year"];

  function decorateSelect(sel) {
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (isLocked(o.value)) {
        if (o.text.indexOf("🔒") === -1) o.text = o.text + " 🔒";
        o.setAttribute("data-yl", "1");
      } else if (o.getAttribute("data-yl") === "1") {
        o.text = o.text.replace(/\s*🔒$/, ""); o.removeAttribute("data-yl");
      }
    }
  }
  var BTN_RE = /^\s*(openEditContrib|deleteContribution|openEditExpense|deleteExpense)\(\s*['"]([^'"]+)['"]\s*\)/;
  function decorateButton(b) {
    var m = BTN_RE.exec(b.getAttribute("onclick") || "");
    if (!m) return;
    var kind = /Expense$/.test(m[1]) ? "exp" : "c";
    var y = entryYear(kind, m[2]);
    if (isLocked(y)) {
      b.classList.add("yl-locked");
      if (!b.getAttribute("data-yl-title")) b.setAttribute("data-yl-title", b.getAttribute("title") || "");
      b.setAttribute("title", "🔒 Year " + y + " is locked");
    } else if (b.classList.contains("yl-locked")) {
      b.classList.remove("yl-locked");
      var t = b.getAttribute("data-yl-title");
      if (t) b.setAttribute("title", t); else b.removeAttribute("title");
    }
  }

  function decorateYearSummary() {
    var body = document.getElementById("ys_tbody");
    if (!body) return;
    var rows = body.querySelectorAll("tr");
    for (var i = 0; i < rows.length; i++) {
      var td = rows[i].querySelector("td");
      if (!td) continue;
      var y = parseInt((td.getAttribute("data-yl-year") || td.textContent).replace(/[^0-9]/g, "").slice(0, 4), 10);
      if (isNaN(y)) continue;
      td.setAttribute("data-yl-year", String(y));
      var locked = isLocked(y);
      var box = td.querySelector(".yl-box");
      if (!box) { box = document.createElement("div"); box.className = "yl-box"; td.appendChild(box); }
      var sig = locked ? "1" : "0";
      if (box.getAttribute("data-sig") === sig) continue;
      box.setAttribute("data-sig", sig);
      box.innerHTML = locked
        ? '<span class="yl-badge yl-on">🔒 Locked</span><button type="button" class="yl-btn" onclick="_ylToggle(' + y + ',false)">Unlock</button>'
        : '<span class="yl-badge yl-off">Open</span><button type="button" class="yl-btn" onclick="_ylToggle(' + y + ',true)">Lock</button>';
    }
  }

  function decorate(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      FORM_YEAR_SELECTS.forEach(function (id) { var s = document.getElementById(id); if (s) decorateSelect(s); });
      var btns = document.querySelectorAll("button[onclick*='openEditContrib'],button[onclick*='deleteContribution'],button[onclick*='openEditExpense'],button[onclick*='deleteExpense']");
      for (var i = 0; i < btns.length; i++) decorateButton(btns[i]);
      decorateYearSummary();
    } catch (e) {}
  }

  /* ── Lock / Unlock action (Year Summary) ── */
  window._ylToggle = function (year, lock) {
    var msg = lock
      ? "Lock " + year + "? No one will be able to add, edit or delete contributions or expenses of " + year + " until it is unlocked."
      : "Unlock " + year + "? Entries of " + year + " can then be added, edited and deleted again.";
    var run = async function () {
      var s = {};
      try { s = JSON.parse(localStorage.getItem("session") || "{}"); } catch (e) {}
      var res = await postData({
        action: "setYearLock", Year: String(year), Locked: lock ? "true" : "false",
        AdminName: s.name || "Admin", sessionToken: s.sessionToken || "", userId: s.userId || ""
      });
      if (res && res.status === "success") {
        markLocked(year, lock);
        if (typeof toast === "function") toast((lock ? "🔒 " : "🔓 ") + year + (lock ? " locked." : " unlocked."));
      } else if (typeof toast === "function") {
        toast((res && res.message) || "Could not change the lock. Try again.", "error");
      }
    };
    if (typeof confirmModal === "function") confirmModal(msg, run, lock ? "Lock Year" : "Unlock Year", "#C1440E");
    else if (window.confirm(msg)) run();
  };

  /* ── styles ── */
  try {
    var st = document.createElement("style");
    st.textContent =
      "button.yl-locked{opacity:.4!important;cursor:not-allowed!important;filter:grayscale(.6);}" +
      ".yl-box{display:flex;gap:6px;align-items:center;justify-content:center;margin-top:5px;font-weight:500;}" +
      ".yl-badge{font-size:10px;padding:2px 7px;border-radius:999px;white-space:nowrap;}" +
      ".yl-on{background:#475569;color:#fff;}.yl-off{background:#dcfce7;color:#166534;}" +
      ".yl-btn{font-size:10.5px;padding:2px 8px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer;box-shadow:none;transform:none;}" +
      ".yl-btn:hover{border-color:#334155;}" +
      "body.dark-mode .yl-btn{background:#111827;border-color:#2d3f58;color:#e2e8f0;}" +
      "body.dark-mode .yl-off{background:#14532d;color:#bbf7d0;}";
    document.head.appendChild(st);
  } catch (e) {}

  function start() {
    installGuards();
    installPostGuard();
    decorate(document.body);
    var timer = null;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () { decorate(document.body); }, 80);
    }).observe(document.body, { childList: true, subtree: true });
  }
  // run after all page scripts so every function we wrap already exists
  if (document.readyState === "complete") setTimeout(start, 0);
  else window.addEventListener("load", function () { setTimeout(start, 0); });
})();
