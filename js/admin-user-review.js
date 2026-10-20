/* ════════════════════════════════════════════════════════════════
   admin-user-review.js
   ADD USER — REVIEW STEP

   "Add User" now shows a Review screen first (like Add Contribution).
   Fields on it are locked until double-clicked (admin-review-lock.js).

   Confirm copies the reviewed values back into the original form fields
   (u_name / u_mobile / u_email / u_role) and then runs the EXISTING
   spSave('user') → addUser() path, so saving, validation messages, the
   default password and the "User Added!" card are all unchanged.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }
  function say(msg) { if (typeof toast === "function") toast(msg, "error"); }

  /* same required-field rules addUser() applies */
  function check(name, mobile, email) {
    if (!name || !mobile || !email) { say("Name, Mobile, and Email are required."); return false; }
    if (!/^\d{10}$/.test(mobile))   { say("Mobile must be exactly 10 digits.");     return false; }
    return true;
  }

  window.spUserReview = function () {
    if (typeof checkSession === "function" && !checkSession()) return;
    var name = val("u_name"), mobile = val("u_mobile"), email = val("u_email");
    if (!check(name, mobile, email)) return;

    $("ru_name").value = name;
    $("ru_mobile").value = mobile;
    $("ru_email").value = email;
    $("ru_role").value = ($("u_role") || {}).value || "User";
    $("ru_dob_txt").textContent = val("u_dob") || "—";
    $("ru_cstart_txt").textContent = val("u_contrib_start") || "— (Auto)";

    $("sp-user-form").style.display = "none";
    $("sp-user-review").style.display = "";
    if (typeof window._rvLockAll === "function") window._rvLockAll($("sp-user-review"));
  };

  window.spUserReviewBack = function () {
    var r = $("sp-user-review"), f = $("sp-user-form");
    if (r) r.style.display = "none";
    if (f) f.style.display = "";
  };

  window.spUserConfirm = function () {
    var name = val("ru_name"), mobile = val("ru_mobile"), email = val("ru_email");
    if (!check(name, mobile, email)) return; // stay on review so it can be fixed
    $("u_name").value = name;
    $("u_mobile").value = mobile;
    $("u_email").value = email;
    if ($("u_role")) $("u_role").value = ($("ru_role") || {}).value || "User";
    spUserReviewBack();   // spSave() hides the form + shows the success card itself
    if (typeof spSave === "function") spSave("user");
  };

  /* used by spOpen() so a re-opened panel never starts on a stale review */
  window._userReviewHide = function () {
    var r = $("sp-user-review");
    if (r) r.style.display = "none";
  };
})();
