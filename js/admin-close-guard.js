/* ════════════════════════════════════════════════════════════════
   admin-close-guard.js
   CLOSE PROTECTION for every slide-in panel and pop-up window

   Problem: clicking outside a form (or its X / Cancel) threw away typed
   details — or closed the window while a save was still running — with
   no warning.

   Rule (same everywhere): when the admin tries to close a panel or
   window by  • clicking outside it   • the X button   • the Cancel button
   • Esc (panels)  and EITHER
        (a) they have typed / changed something, or
        (b) a save / submit is still running ("rolling" spinner),
   a confirmation box is shown first. Otherwise it closes as before.

   It only decides WHETHER to ask. It never touches saving logic: after
   "Discard" / "Close anyway" it simply calls the original spClose() /
   closeModal(). Programmatic closes (e.g. after a successful save) are
   never intercepted.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── styles for the confirmation box (sits above panels AND pop-ups) ── */
  try {
    var st = document.createElement("style");
    st.textContent = [
      ".cg-shade{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:cgIn .15s ease;}",
      "@keyframes cgIn{from{opacity:0}to{opacity:1}}",
      ".cg-box{background:#fff;border-radius:14px;padding:22px 22px 18px;width:320px;max-width:92vw;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.28);font-family:inherit;}",
      ".cg-icon{width:44px;height:44px;border-radius:50%;background:#fff7ed;color:#ea580c;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:20px;}",
      ".cg-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:6px;}",
      ".cg-sub{font-size:12.5px;color:#64748b;line-height:1.45;margin-bottom:18px;}",
      ".cg-actions{display:flex;gap:10px;}",
      ".cg-actions button{flex:1;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#334155;}",
      ".cg-actions .cg-go{background:#e74c3c;border-color:#e74c3c;color:#fff;}",
      ".cg-actions .cg-keep{background:#C1440E;border-color:#C1440E;color:#fff;}",
      "body.dark-mode .cg-box{background:#1e293b;} body.dark-mode .cg-title{color:#f1f5f9;} body.dark-mode .cg-sub{color:#cbd5e1;}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  /* ── helpers ── */
  function visible(el) {
    return !!(el && (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length)));
  }
  function fieldSig(el) {
    if (el.type === "checkbox" || el.type === "radio") return el.checked ? "1" : "0";
    if (el.type === "file") return String(el.files ? el.files.length : 0);
    return String(el.value == null ? "" : el.value);
  }
  function isBusy(root) {
    if (!root) return false;
    var spins = root.querySelectorAll(".fa-spin, .btn-loading");
    for (var i = 0; i < spins.length; i++) if (visible(spins[i])) return true;
    return false;
  }

  /* panel dirty = anything typed in a visible field (same rule the panel already used) */
  function panelDirty(panel) {
    var fields = panel.querySelectorAll("input, textarea");
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (/^(hidden|button|submit|checkbox|radio|file)$/.test(f.type)) continue;
      if (!visible(f)) continue;
      if (f.value && String(f.value).trim() !== "") return true;
    }
    // Bulk Insert: a chosen member counts even before any amount is typed
    if (panel.id === "sp-bulk") {
      var bk = document.getElementById("bk_user");
      if (bk && bk.value) return true;
    }
    return false;
  }

  /* pop-up window dirty = a field the person actually changed from its opening value */
  function modalDirty(modal) {
    var fields = modal.querySelectorAll("input, textarea, select");
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (/^(hidden|button|submit)$/.test(f.type)) continue;
      if (!f._cgTouched) continue;
      var init = f._cgInit == null ? "" : f._cgInit;
      if (fieldSig(f) !== init) return true;
    }
    return false;
  }

  // remember opening values + whether a person touched a field (real events only)
  function snapModal(modal) {
    var fields = modal.querySelectorAll("input, textarea, select");
    for (var i = 0; i < fields.length; i++) fields[i]._cgInit = fieldSig(fields[i]);
  }
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var a = muts[i].addedNodes;
      for (var j = 0; j < a.length; j++) {
        var n = a[j];
        if (n.nodeType === 1 && n.id === "_uniModal") setTimeout(function (m) { snapModal(m); }.bind(null, n), 0);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  function touch(e) {
    var t = e.target;
    if (!e.isTrusted || !t || !t.closest || !t.closest("#_uniModal")) return;
    t._cgTouched = true;
  }
  document.addEventListener("input", touch, true);
  document.addEventListener("change", touch, true);

  /* ── the confirmation box ── */
  var open = null;
  function closeBox() {
    if (open && open.parentNode) open.parentNode.removeChild(open);
    open = null;
  }
  function ask(kind, onGo) {
    closeBox();
    var busy = kind === "busy";
    var shade = document.createElement("div");
    shade.className = "cg-shade";
    shade.innerHTML =
      '<div class="cg-box" role="alertdialog" aria-modal="true">' +
        '<div class="cg-icon"><i class="fa-solid ' + (busy ? "fa-spinner fa-spin" : "fa-triangle-exclamation") + '"></i></div>' +
        '<div class="cg-title">' + (busy ? "Still saving…" : "Discard this entry?") + '</div>' +
        '<div class="cg-sub">' + (busy
          ? "A save is still in progress. Closing now won't cancel it, but you won't see the result."
          : "You've entered some details that haven't been saved yet.") + '</div>' +
        '<div class="cg-actions">' +
          '<button type="button" class="cg-go">' + (busy ? "Close anyway" : "Discard") + '</button>' +
          '<button type="button" class="cg-keep">' + (busy ? "Keep waiting" : "Keep editing") + '</button>' +
        '</div></div>';
    document.body.appendChild(shade);
    open = shade;
    // the box's own spinner must not count as a "busy" save
    var ic = shade.querySelector(".fa-spin"); if (ic) ic.classList.remove("fa-spin");
    shade.querySelector(".cg-keep").onclick = closeBox;
    shade.querySelector(".cg-go").onclick = function () { closeBox(); try { onGo(); } catch (e) { console.warn(e); } };
    shade.addEventListener("click", function (e) { if (e.target === shade) closeBox(); });
    try { shade.querySelector(".cg-keep").focus(); } catch (e) {}
  }

  /* ── decide: close now, or ask first ── */
  function request(root, kind, doClose) {
    if (isBusy(root)) return ask("busy", doClose);
    if (kind === "panel" ? panelDirty(root) : modalDirty(root)) return ask("dirty", doClose);
    doClose();
  }
  function openPanel() { return document.querySelector(".sp-panel.sp-panel-open"); }

  // outside click on the dark area behind a slide-in panel
  window._cgPanelClose = function () {
    var p = openPanel();
    if (!p) return;
    request(p, "panel", function () { if (typeof window.spClose === "function") window.spClose(); });
  };
  // outside click on the dark area behind a pop-up window
  window._cgModalBackdrop = function () {
    var m = document.getElementById("_uniModal");
    if (!m) return;
    request(m, "modal", function () { if (typeof window.closeModal === "function") window.closeModal(); });
  };

  /* ── X / Cancel buttons: only buttons whose entire job is "close" ── */
  var PURE_PANEL = /^\s*spClose\(\)\s*;?\s*$/;
  var PURE_MODAL = /^\s*closeModal\(\)\s*;?\s*$/;
  document.addEventListener("click", function (e) {
    if (open) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest("[onclick]");
    if (!btn) return;
    var code = btn.getAttribute("onclick") || "";
    var modal = btn.closest("#_uniModal");
    var panel = btn.closest(".sp-panel");
    if (modal && PURE_MODAL.test(code)) {
      var m = modal;
      if (!isBusy(m) && !modalDirty(m)) return; // nothing to protect → normal close
      e.preventDefault(); e.stopImmediatePropagation();
      request(m, "modal", function () { window.closeModal(); });
    } else if (panel && !modal && PURE_PANEL.test(code)) {
      if (!isBusy(panel) && !panelDirty(panel)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      request(panel, "panel", function () { window.spClose(); });
    }
  }, true);

  // Esc while the box is showing = "keep editing" (never closes the panel behind it)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) {
      e.preventDefault(); e.stopImmediatePropagation();
      closeBox();
    }
  }, true);
})();
