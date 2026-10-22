/* ════════════════════════════════════════════════════════════════
   admin-expense-duplicate.js
   DUPLICATE EXPENSE WARNING (Add Expense review step only)

   Before "Confirm & Save" runs, compares the new expense with the ones
   already loaded. A likely duplicate = same Amount + same Month + same Year
   AND (same Title ignoring case/spaces OR same Expense Type).
   Payment date is NOT used (entries are often back-dated data entry).

   It only WARNS. "Add Anyway" continues with the original save untouched;
   "Go Back" returns to the review screen. No save logic is changed — this
   wraps _submitExpenseFromPreview() and calls the original when allowed.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var _orig = null;
  var _approved = false; // set only for the single call made after "Add Anyway"

  function norm(s) { return String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim(); }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }

  function findDuplicates() {
    var title = norm(val("prev_exp_title")), amt = Number(val("prev_exp_amount")),
      month = val("prev_exp_month"), year = String(val("prev_exp_year")), type = String(val("prev_exp_type"));
    if (!title || !amt) return [];
    return (typeof expenses !== "undefined" ? expenses : []).filter(function (e) {
      return Number(e.Amount) === amt &&
        String(e.Year || "") === year &&
        String(e.ForMonth || "") === String(month || "") &&
        (norm(e.Title) === title || (type && String(e.ExpenseTypeId) === type));
    });
  }

  function showWarning(dups) {
    var cur = (window.APP && APP.currency) || "₹", loc = (window.APP && APP.locale) || "en-IN";
    var exTypes = typeof expenseTypes !== "undefined" ? expenseTypes : [];
    var rows = dups.slice(0, 3).map(function (e) {
      var t = exTypes.find(function (x) { return String(x.ExpenseTypeId) === String(e.ExpenseTypeId); });
      return '<div style="padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:6px;font-size:12.5px;text-align:left;">' +
        '<b>' + esc(e.Title) + '</b> · ' + cur + Number(e.Amount).toLocaleString(loc) +
        '<div style="color:#92400e;font-size:11.5px;">' + esc((e.ForMonth || "General") + " " + (e.Year || "")) + (t ? " · " + esc(t.Name) : "") + (e.Id ? " · " + esc(e.Id) : "") + '</div></div>';
    }).join("");
    var more = dups.length > 3 ? '<div style="font-size:11.5px;color:#92400e;">+ ' + (dups.length - 3) + ' more similar</div>' : "";
    openModal(
      '<div style="height:4px;background:#f59e0b;border-radius:16px 16px 0 0;"></div>' +
      '<div class="_mbdy" style="text-align:center;padding:22px 24px 24px;">' +
      '<div style="font-size:34px;line-height:1;margin-bottom:8px;">⚠️</div>' +
      '<p style="font-size:15.5px;font-weight:700;color:#1e293b;margin:0 0 6px;">Similar expense already exists</p>' +
      '<p style="font-size:12.5px;color:#64748b;margin:0 0 12px;">Same amount, month and year with the same title or type. Is this a duplicate?</p>' +
      rows + more +
      '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">' +
      '<button class="_mbtn" style="background:transparent;color:#64748b;border:1.5px solid #e2e8f0;min-width:110px;" onclick="closeModal()">Go Back</button>' +
      '<button class="_mbtn" id="_dupAnywayBtn" style="background:#f59e0b;min-width:110px;">Add Anyway</button>' +
      '</div></div>', "380px");
    setTimeout(function () {
      var b = document.getElementById("_dupAnywayBtn");
      if (!b) return;
      b.addEventListener("click", function () {
        closeModal();
        _approved = true;
        setTimeout(function () { window._submitExpenseFromPreview(); }, 220);
      });
    }, 0);
  }

  function install() {
    if (typeof window._submitExpenseFromPreview !== "function" || _orig) return;
    _orig = window._submitExpenseFromPreview;
    window._submitExpenseFromPreview = function () {
      if (_approved) { _approved = false; return _orig.apply(this, arguments); }
      var dups = [];
      try { dups = findDuplicates(); } catch (e) { dups = []; } // never block a save on a checker error
      if (dups.length) { showWarning(dups); return; }
      return _orig.apply(this, arguments);
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
