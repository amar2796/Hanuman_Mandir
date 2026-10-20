/* ════════════════════════════════════════════════════════════════
   admin-review-lock.js
   REVIEW-STEP LOCK — "double-click a field to edit it"

   Why: on the Review (step 2) screens every field used to be live, so a
   stray touch while scrolling, or a mouse-wheel over a dropdown, could
   silently change an amount/month/member before Confirm.

   What it does: whenever a review screen is drawn, every editable field on
   it starts LOCKED (looks normal but ignores typing/dropdown changes).
   Double-click (desktop) or double-tap (mobile) a field to unlock JUST that
   field; it locks again as soon as you leave it / pick a value.

   What it does NOT do: it never touches any save/confirm logic. Locked
   fields still hold the same values and are read by the same code
   (.value) exactly as before — it only blocks user input events.

   Review screens covered (by field id / class):
     • Add Contribution review ........ #prev_*  (incl. member dropdown)
     • Add Expense review ............. #prev_exp_*
     • Donation Counter review ........ #wprev_*
     • Bulk Insert review ............. .bkprev-amt  (per-row amounts)
     • Add User review ................ #ru_*
   Hidden/selects-in-disguise (#prev_user) are skipped; the visible member
   button (#prev_user_cmbBtn) is what gets locked.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SEL = [
    "#prev_amount", "#prev_month", "#prev_year", "#prev_type", "#prev_mode",
    "#prev_occasion", "#prev_note", "#prev_user_cmbBtn",
    "#prev_exp_title", "#prev_exp_amount", "#prev_exp_type", "#prev_exp_month", "#prev_exp_year",
    "#wprev_name", "#wprev_mobile", "#wprev_email", "#wprev_amount", "#wprev_month",
    "#wprev_year", "#wprev_type", "#wprev_occasion", "#wprev_note",
    "#ru_name", "#ru_mobile", "#ru_email", "#ru_role",
    "#rev_name", "#rev_cat", "#rev_status", "#rev_start", "#rev_end", "#rev_budget", "#rev_desc",
    ".bkprev-amt"
  ].join(",");

  var HINT = "Double-click to edit";

  /* ── one-time styles ── */
  try {
    var st = document.createElement("style");
    st.textContent =
      ".rv-locked{cursor:default!important;background-color:#f1f5f9!important;border-style:dashed!important;}" +
      ".rv-editing{border-color:#f59e0b!important;box-shadow:0 0 0 3px rgba(245,158,11,.22)!important;background-color:#fff!important;}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function isTextLike(el) {
    var t = el.tagName;
    return t === "INPUT" || t === "TEXTAREA";
  }

  function lock(el) {
    if (!el || el.getAttribute("data-rv-lock") === "1") return;
    el.setAttribute("data-rv-lock", "1");
    if (isTextLike(el)) el.readOnly = true;
    el.classList.add("rv-locked");
    el.classList.remove("rv-editing");
    if (!el.getAttribute("data-rv-title")) {
      el.setAttribute("data-rv-title", el.getAttribute("title") || "");
    }
    el.setAttribute("title", HINT);
  }

  function unlock(el) {
    if (!el || el.getAttribute("data-rv-lock") !== "1") return;
    el.removeAttribute("data-rv-lock");
    if (isTextLike(el)) el.readOnly = false;
    el.classList.remove("rv-locked");
    el.classList.add("rv-editing");
    var old = el.getAttribute("data-rv-title");
    if (old) el.setAttribute("title", old); else el.removeAttribute("title");
    try { el.focus(); } catch (e) {}
    if (el.tagName === "SELECT" && typeof el.showPicker === "function") {
      try { el.showPicker(); } catch (e) {}
    } else if (el.id === "prev_user_cmbBtn" && typeof window._cmbToggle === "function") {
      try { window._cmbToggle("prev_user"); } catch (e) {}
    }
  }

  function relock(el) {
    if (!el || !el.isConnected) return;
    el.classList.remove("rv-editing");
    lock(el);
  }

  function lockedTarget(e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    var el = t.closest("[data-rv-lock='1']");
    return el || null;
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      if (root.matches && root.matches(SEL)) lock(root);
      var list = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
      for (var i = 0; i < list.length; i++) lock(list[i]);
    } catch (e) {}
  }

  /* ── lock fields as soon as a review screen appears ── */
  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) scan(added[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── block input while locked (capture phase = runs before inline handlers) ── */
  function block(e) {
    var el = lockedTarget(e);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
  }
  document.addEventListener("mousedown", function (e) {
    var el = lockedTarget(e);
    if (!el) return;
    // inputs: allow focus (readonly = harmless, lets dblclick work); selects/combobox: stop opening
    if (isTextLike(el)) return;
    e.preventDefault();
  }, true);
  document.addEventListener("click", function (e) {
    var el = lockedTarget(e);
    if (!el || isTextLike(el)) return;
    e.preventDefault();
    e.stopPropagation(); // stops inline onclick="_cmbToggle(...)" on the member button
  }, true);
  document.addEventListener("keydown", function (e) {
    var el = lockedTarget(e);
    if (!el) return;
    if (e.key === "Tab" || e.key === "Escape") return;
    if (e.key === "Enter" || e.key === " ") { block(e); return; }
    if (!isTextLike(el)) block(e); // arrow keys / type-ahead would change a select
  }, true);
  document.addEventListener("wheel", function (e) {
    var el = lockedTarget(e);
    if (el && el.tagName === "SELECT") e.preventDefault();
  }, { capture: true, passive: false });

  /* ── desktop: double-click unlocks that one field ── */
  document.addEventListener("dblclick", function (e) {
    var el = lockedTarget(e);
    if (!el) return;
    e.preventDefault();
    unlock(el);
  }, true);

  /* ── mobile: double-tap unlocks (two taps on same field within 400ms) ── */
  var lastTap = { el: null, t: 0 };
  document.addEventListener("touchend", function (e) {
    var el = lockedTarget(e);
    if (!el) return;
    var now = Date.now();
    if (lastTap.el === el && now - lastTap.t < 400) {
      lastTap = { el: null, t: 0 };
      e.preventDefault();
      unlock(el);
      return;
    }
    lastTap = { el: el, t: now };
    // a single tap must not open a dropdown / the member list
    if (!isTextLike(el)) e.preventDefault();
  }, { capture: true, passive: false });

  /* ── re-lock when the field is left or a value is picked ── */
  document.addEventListener("focusout", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("rv-editing") && t.matches && t.matches(SEL)) {
      setTimeout(function () { if (document.activeElement !== t) relock(t); }, 120);
    }
  }, true);
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches(SEL) && t.classList.contains("rv-editing") && t.tagName === "SELECT") {
      setTimeout(function () { relock(t); }, 0);
    }
    // member combobox: its hidden select fires 'change' when a member is picked
    if (t.id === "prev_user") {
      var btn = document.getElementById("prev_user_cmbBtn");
      if (btn && btn.classList.contains("rv-editing")) setTimeout(function () { relock(btn); }, 0);
    }
  }, true);
  // member list closed by clicking elsewhere without picking → lock the button again
  document.addEventListener("click", function () {
    var btn = document.getElementById("prev_user_cmbBtn");
    if (!btn || !btn.classList.contains("rv-editing")) return;
    setTimeout(function () {
      var list = document.getElementById("prev_user_cmbList");
      if (list && list.style.display === "none") relock(btn);
    }, 50);
  });

  /* Static (always-in-DOM) review screens call this each time they are shown,
     so every field starts locked again. */
  window._rvLockAll = function (root) { scan(root || document.body); };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
