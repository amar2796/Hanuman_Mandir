/* ════════════════════════════════════════════════════════════════
   admin-event-review.js
   CREATE EVENT — REVIEW STEP

   "Save Event" now shows a Review screen first (like Add Contribution /
   Add User). Fields are locked until double-clicked (admin-review-lock.js).

   Confirm copies the reviewed values back into the original form fields
   (ev_name … ev_desc) and then runs the EXISTING spSave('event') →
   addEvent() path, so saving, messages and the "Event Created!" card are
   unchanged.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var MAP = [["ev_name", "rev_name"], ["ev_cat", "rev_cat"], ["ev_status", "rev_status"],
             ["ev_start", "rev_start"], ["ev_end", "rev_end"], ["ev_budget", "rev_budget"], ["ev_desc", "rev_desc"]];
  function $(id) { return document.getElementById(id); }
  function warn(m) { if (typeof toast === "function") toast(m, "warn"); }

  window.spEventReview = function () {
    if (typeof checkSession === "function" && !checkSession()) return;
    if (!String(($("ev_name") || {}).value || "").trim()) { warn("Event name is required."); return; } // same rule as addEvent()
    MAP.forEach(function (m) { var a = $(m[0]), b = $(m[1]); if (a && b) b.value = a.value; });
    $("sp-event-form").style.display = "none";
    $("sp-event-review").style.display = "";
    if (typeof window._rvLockAll === "function") window._rvLockAll($("sp-event-review"));
  };

  window.spEventReviewBack = function () {
    var r = $("sp-event-review"), f = $("sp-event-form");
    if (r) r.style.display = "none";
    if (f) f.style.display = "";
  };

  window.spEventConfirm = function () {
    if (!String(($("rev_name") || {}).value || "").trim()) { warn("Event name is required."); return; }
    MAP.forEach(function (m) { var a = $(m[0]), b = $(m[1]); if (a && b) a.value = b.value; });
    window.spEventReviewBack();      // spSave() hides the form + shows the success card itself
    if (typeof spSave === "function") spSave("event");
  };

  window._eventReviewHide = function () {
    var r = $("sp-event-review");
    if (r) r.style.display = "none";
  };
})();
