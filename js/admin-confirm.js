/* ════════════════════════════════════════════════════════════════
   admin-confirm.js
   ASK ONCE BEFORE ANY ACTION BUTTON

   A single capture-phase click guard. When an admin presses a button whose
   inline onclick calls one of the functions listed in RULES below (export,
   download, print, backup, send email, save, add, upload …) a small
   confirmation window opens ON TOP of whatever is showing (the receipt
   window, a form, the page). Cancel simply removes it — nothing underneath
   is touched. "Yes" re-fires the very same click once, so the original
   handler runs exactly as before.

   NOT guarded on purpose (they already ask, or are only navigation/view):
   delete*, resendReceiptEmail, approve/reject, lock/unlock year, access
   level change, review-screen "Confirm & Save", filters, tabs, pagination,
   Close/Cancel, view/open-form buttons.

   No existing function is edited — if this file fails to load, the app works
   exactly as it did before.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var C = { info: "#2563eb", share: "#7c3aed", warn: "#C1440E", ok: "#16a34a" };

  /* ── helpers ─────────────────────────────────────────────── */
  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { var cur = (window.APP && APP.currency) || "₹", loc = (window.APP && APP.locale) || "en-IN"; return cur + Number(n || 0).toLocaleString(loc); }
  function num(id) { var e = document.getElementById(id); var n = e ? parseInt(String(e.textContent).replace(/\D/g, ""), 10) : NaN; return isNaN(n) ? null : n; }
  function len(name) { try { var v = window[name]; return Array.isArray(v) ? v.length : null; } catch (e) { return null; } }

  /* ── rows builders ───────────────────────────────────────── */
  function fileRows(type, extra) {
    return function (el) {
      var r = [["File", type]];
      var e = typeof extra === "function" ? extra(el) : extra;
      return r.concat(e || []);
    };
  }
  function recordsRow(listName) { return function () { var n = len(listName); return n == null ? [] : [["Records", n + (n === 1 ? " entry" : " entries")]]; }; }
  function selectedRow(countId) { return function () { var n = num(countId); return n == null ? [] : [["Selected", n + " " + (n === 1 ? "entry" : "entries")]]; }; }

  function receiptRows(el) {
    var m = /\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute("onclick") || "");
    var rec = m && window._rcptStore && window._rcptStore[m[1]];
    if (!rec) return [];
    var c = rec.c || {}, rows = [];
    try { rows.push(["Receipt", esc(typeof _displayRID === "function" ? _displayRID(c) : (c.ReceiptID || "—"))]); } catch (e) { }
    if (rec.userName) rows.push(["Member", esc(rec.userName)]);
    if (c.Amount != null) rows.push(["Amount", money(c.Amount)]);
    return rows;
  }
  function emailRows(el) {
    var rows = receiptRows(el);
    try {
      var m = /\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute("onclick") || "");
      var rec = m && window._rcptStore && window._rcptStore[m[1]];
      var u = rec && (window.users || []).find(function (x) { return String(x.UserId) === String(rec.c && rec.c.UserId); });
      if (u && u.Email) rows.unshift(["To", esc(u.Email)]);
    } catch (e) { }
    return rows;
  }

  /* Reads the labelled fields around a Save/Add button so the dialog shows
     "what value is being saved". Passwords and files are never shown. */
  function fieldRows(el) {
    var root = el.closest("#_uniModal ._mbox, .sp-panel, .card, .page") || el.parentElement;
    if (!root) return [];
    var ctrls = root.querySelectorAll("input:not([type=hidden]):not([type=file]):not([type=password]):not([type=checkbox]):not([type=radio]), select, textarea");
    if (ctrls.length > 14) return [];
    var rows = [];
    Array.prototype.forEach.call(ctrls, function (c) {
      if (rows.length >= 6 || c.disabled || c.offsetParent === null) return;
      var v = c.tagName === "SELECT" ? (c.selectedIndex >= 0 ? c.options[c.selectedIndex].text : "") : c.value;
      v = String(v || "").trim();
      if (!v || /^(select|choose|--)/i.test(v)) return;
      var lab = "";
      var g = c.closest("div");
      var l = (c.id && root.querySelector('label[for="' + c.id + '"]')) || (g && g.querySelector("label"));
      lab = (l ? l.textContent : (c.getAttribute("placeholder") || c.name || "")).replace(/[*:]/g, "").trim();
      if (!lab) return;
      rows.push([esc(lab), esc(v.length > 60 ? v.slice(0, 57) + "…" : v)]);
    });
    return rows;
  }

  /* ── rules: first match wins ─────────────────────────────── */
  function dl(title, ok, rows, msg) {
    return { tone: C.info, icon: "fa-file-arrow-down", title: title, msg: msg || "A file will be saved to your device.", ok: ok || "Download", rows: rows };
  }
  var RULES = [
    /* exports / downloads */
    [/^exportContribCSV$/, dl("Export contributions as CSV?", "Export CSV", fileRows("CSV", recordsRow("_contribList")))],
    [/^exportExpenseCSV$/, dl("Export expenses as CSV?", "Export CSV", fileRows("CSV", recordsRow("_expenseList")))],
    [/^exportUsersCSV$/, dl("Export members as CSV?", "Export CSV", fileRows("CSV", recordsRow("_userList")))],
    [/^exportSelectedContribCSV$/, dl("Export selected contributions?", "Export CSV", fileRows("CSV", selectedRow("cr_bulkCount")))],
    [/^exportSelectedExpenseCSV$/, dl("Export selected expenses?", "Export CSV", fileRows("CSV", selectedRow("exp_bulkCount")))],
    [/^exportSelectedUsersCSV$/, dl("Export selected members?", "Export CSV", fileRows("CSV", selectedRow("users_bulkCount")))],
    [/^exportAuditCSV$/, dl("Export audit log as CSV?", "Export CSV", fileRows("CSV"))],
    [/^_trExportCounterCsv$/, dl("Export counter data as CSV?", "Export CSV", fileRows("CSV"))],
    [/^dbExportCSV$/, dl("Export Day Book as CSV?", "Export CSV", fileRows("CSV"))],
    [/^dbExportPDF$/, dl("Export Day Book as PDF?", "Export PDF", fileRows("PDF"))],
    [/^exportAnnualReportPDF$/, dl("Export Year Report as PDF?", "Export PDF", fileRows("PDF", [["Report", "Annual Financial Report"]]))],
    [/^exportAllEventsReportPDF$/, dl("Export events report as PDF?", "Export PDF", fileRows("PDF"))],
    [/^exportEventReportPDF$/, dl("Export this event report?", "Export PDF", fileRows("PDF"))],
    [/^dash_exportPDF$/, dl("Export dashboard as PDF?", "Export PDF", fileRows("PDF"))],
    [/^downloadLocalBackup$/, dl("Download local backup?", "Download backup", fileRows("Backup file"), "It contains all your sheet data — keep the file safe.")],
    [/^exportReceiptPDF$/, dl("Download this receipt as PDF?", "Download PDF", function (el) { return [["File", "PDF"]].concat(receiptRows(el)); })],
    [/^printReceipt$/, { tone: C.info, icon: "fa-print", title: "Print this receipt?", msg: "The print window will open.", ok: "Print", rows: receiptRows }],
    /* sending */
    [/^sendReceiptEmailDirect$/, { tone: C.share, icon: "fa-envelope", title: "Email this receipt?", msg: "A PDF copy is sent to the member right away.", ok: "Send email", rows: emailRows }],
    [/^sendBroadcast$/, { tone: C.share, icon: "fa-bullhorn", title: "Send this broadcast?", msg: "It goes out to the selected members right away.", ok: "Send broadcast", rows: fieldRows }],
    [/^dash_email$/, { tone: C.share, icon: "fa-envelope", title: "Email this report?", msg: "The email is sent right away.", ok: "Send email", rows: fieldRows }],
    [/^sendTracker(PendingReport|IndividualEmails|AdminSummary)$/, { tone: C.share, icon: "fa-paper-plane", title: "Send these emails?", msg: "Emails are sent right away and cannot be recalled.", ok: "Yes, send" }],
    [/^triggerTestBirthdayEmail$/, { tone: C.share, icon: "fa-cake-candles", title: "Send a test birthday email?", msg: "One test email is sent to you.", ok: "Send test" }],
    [/^triggerManual(MonthlyReport|AdminSummary)$/, { tone: C.share, icon: "fa-paper-plane", title: "Send this report now?", msg: "It is sent immediately, outside the usual schedule.", ok: "Send now" }],
    /* save / add */
    [/^saveEdit(Contrib|Expense|User|Goal|Event)$/, { tone: C.warn, icon: "fa-pen-to-square", title: "Save these changes?", msg: "The values below will be saved.", ok: "Save changes", rows: fieldRows }],
    [/^_mdSaveEdit$/, { tone: C.warn, icon: "fa-pen-to-square", title: "Save this change?", msg: "The value below will be saved.", ok: "Save changes", rows: fieldRows }],
    [/^saveAdminProfile$/, { tone: C.warn, icon: "fa-user-pen", title: "Update your profile?", msg: "", ok: "Update", rows: fieldRows }],
    [/^saveAdminNewPassword$/, { tone: C.warn, icon: "fa-key", title: "Change your password?", msg: "You will use the new password next time you sign in.", ok: "Change password" }],
    [/^saveChatbotSettings$/, { tone: C.warn, icon: "fa-robot", title: "Save chatbot settings?", msg: "", ok: "Save settings" }],
    [/^saveAnnouncement$/, { tone: C.warn, icon: "fa-bullhorn", title: "Publish this announcement?", msg: "Members will see it right away.", ok: "Publish", rows: fieldRows }],
    [/^add(Type|Occasion|ExpenseType|Goal)$/, { tone: C.ok, icon: "fa-plus", title: "Add this item?", msg: "Please check the value before adding.", ok: "Add", rows: fieldRows }],
    [/^saveWalkIn$/, { tone: C.ok, icon: "fa-circle-plus", title: "Save this donation?", msg: "Please check the details.", ok: "Save", rows: fieldRows }],
    [/^saveEventExpense$/, { tone: C.ok, icon: "fa-circle-plus", title: "Save this event expense?", msg: "Please check the details.", ok: "Save", rows: fieldRows }],
    [/^uploadGalleryPhoto$/, { tone: C.ok, icon: "fa-image", title: "Upload this photo?", msg: "It will appear in the gallery.", ok: "Upload", rows: fieldRows }],
    [/^uploadExpenseReceipt$/, { tone: C.ok, icon: "fa-paperclip", title: "Attach this receipt?", msg: "The file is uploaded and linked to the expense.", ok: "Upload" }],
    [/^runHealthCheck$/, { tone: C.info, icon: "fa-heart-pulse", title: "Run the health check?", msg: "It only reads data — nothing is changed.", ok: "Run check" }]
  ];

  /* ── finding the rule for a clicked element ──────────────── */
  function ruleFor(el) {
    var attr = el.getAttribute && el.getAttribute("onclick");
    if (!attr) return null;
    var re = /([A-Za-z_$][\w$.]*)\s*\(/g, m;
    while ((m = re.exec(attr))) {
      var name = m[1].replace(/^window\./, "");
      for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(name)) return RULES[i][1];
    }
    return null;
  }

  /* ── the dialog ──────────────────────────────────────────── */
  var _onEsc = null;
  function close() { var o = document.getElementById("gcmOverlay"); if (o) o.remove(); document.removeEventListener("keydown", onKey, true); }
  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); if (_onEsc) _onEsc(); } }

  function askCb(spec, rows, run, onCancel) {
    if (typeof _gcmEnsureCSS === "function") _gcmEnsureCSS();
    close();
    var ov = document.createElement("div");
    ov.id = "gcmOverlay";
    ov.innerHTML = '<div class="gcm-box">' + _gcmCardHtml({
      tone: spec.tone, icon: spec.icon, title: spec.title, msg: spec.msg, rows: rows || [],
      cancel: "Cancel", ok: spec.ok, okId: "gcmOk", closeJs: "document.getElementById('gcmOverlay').remove()"
    }) + '</div>';
    ov.addEventListener("click", function (e) { if (e.target === ov) { close(); if (onCancel) onCancel(); } });
    ov.querySelectorAll(".gcm-x,.gcm-cancel").forEach(function (b) { b.addEventListener("click", function () { if (onCancel) onCancel(); }); });
    document.body.appendChild(ov);
    document.addEventListener("keydown", onKey, true);
    document.getElementById("gcmOk").addEventListener("click", function () { close(); run(); });
    var cancel = ov.querySelector(".gcm-cancel"); if (cancel) cancel.focus();
  }

  function ask(spec, el) {
    var rows = [];
    try { rows = typeof spec.rows === "function" ? (spec.rows(el) || []) : (spec.rows || []); } catch (e) { rows = []; }
    askCb(spec, rows, function () {
      el.__gcmPass = true;
      try { el.click(); } finally { setTimeout(function () { el.__gcmPass = false; }, 0); }
    });
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest || t.closest("#gcmOverlay")) return;
    var el = t.closest("[onclick]");
    if (!el) return;
    if (el.__gcmPass) { el.__gcmPass = false; return; }
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.classList.contains("al-locked") || el.classList.contains("yl-locked")) return;
    var spec = ruleFor(el);
    if (!spec) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ask(spec, el);
  }

  /* Functions that are also reached without a click (Enter key, change events) are guarded
     by wrapping the function itself. */
  var TOGGLES = { auto_receipt: "automatic receipt emails", monthly_report: "the monthly report email", birthday_email: "birthday emails", admin_monthly_summary: "the admin monthly summary" };
  function wrapFns() {
    var wish = window._sendAdminBirthdayWish;
    if (typeof wish === "function" && !wish._gcm) {
      window._sendAdminBirthdayWish = function () {
        var self = this, args = arguments;
        askCb({ tone: C.share, icon: "fa-cake-candles", title: "Send birthday wish?", msg: "The wish is sent right away.", ok: "Send wish" }, [], function () { wish.apply(self, args); });
      };
      window._sendAdminBirthdayWish._gcm = true;
    }
    var tg = window.saveEmailToggle;
    if (typeof tg === "function" && !tg._gcm) {
      window.saveEmailToggle = function (key, value) {
        var el = window.event && window.event.target, self = this, args = arguments;
        var revert = function () { if (el && el.type === "checkbox") el.checked = !value; };
        var what = TOGGLES[key] || String(key || "this setting").replace(/_/g, " ");
        _onEsc = revert;
        askCb({ tone: C.warn, icon: "fa-toggle-on", title: (value ? "Turn on " : "Turn off ") + what + "?", msg: value ? "It will start working right away." : "It will stop until you turn it on again.", ok: value ? "Turn on" : "Turn off" },
          [], function () { _onEsc = null; tg.apply(self, args); }, function () { _onEsc = null; revert(); });
      };
      window.saveEmailToggle._gcm = true;
    }
  }

  function install() { document.addEventListener("click", onClick, true); wrapFns(); }
  /* registered after load so the access-level / year-lock guards (which block
     locked buttons) get the first look at every click */
  if (document.readyState === "complete") install(); else window.addEventListener("load", install);

  window._gcmRules = RULES; // exposed for tests
})();
