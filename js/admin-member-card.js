/* ════════════════════════════════════════════════════════════════
   admin-member-card.js
   MEMBER VERIFY CARD + PHOTO ZOOM

   Shown under the Member dropdown in Add Contribution and Bulk Insert.
   Replaces the old tiny 30px strip with a larger card (photo, name,
   mobile) so the admin can verify who they are about to credit.
   Click / tap the photo → full-screen viewer with zoom in / zoom out
   (buttons, mouse wheel, click-to-zoom, drag to pan, pinch on mobile).

   Display only: it never touches the member <select>, the save logic or
   any data. Called from _updateContribMemberPreview() and
   _updateBkMemberPreview() in admin-dashboard.js.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── styles ── */
  try {
    var st = document.createElement("style");
    st.textContent = [
      ".mc-card{display:flex;align-items:center;gap:14px;margin-top:10px;padding:12px 14px;border-radius:14px;",
      "  background:linear-gradient(135deg,#fffaf3,#fff4e6);border:1px solid #f1d9bd;box-shadow:0 2px 10px rgba(193,68,14,.08);}",
      ".mc-photo{position:relative;flex-shrink:0;width:76px;height:76px;border-radius:16px;padding:0;border:0;",
      "  background:#fff;cursor:zoom-in;box-shadow:0 0 0 3px #fff,0 0 0 4px #e8c9a6,0 4px 12px rgba(0,0,0,.15);overflow:visible;}",
      ".mc-photo.mc-nophoto{cursor:default;}",
      ".mc-photo img{width:100%;height:100%;object-fit:cover;border-radius:16px;display:block;background:#eee;}",
      ".mc-zoom-badge{position:absolute;right:-6px;bottom:-6px;width:24px;height:24px;border-radius:50%;background:#C1440E;color:#fff;",
      "  display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.3);}",
      ".mc-info{min-width:0;flex:1;}",
      ".mc-name{font-size:16px;font-weight:700;color:#1e293b;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".mc-mobile{margin-top:3px;font-size:13.5px;color:#475569;display:flex;align-items:center;gap:6px;}",
      ".mc-mobile i{color:#C1440E;font-size:12px;}",
      ".mc-hint{margin-top:5px;font-size:11px;color:#94a3b8;}",
      "body.dark-mode .mc-card{background:#1e293b;border-color:#334155;box-shadow:none;}",
      "body.dark-mode .mc-name{color:#f1f5f9;} body.dark-mode .mc-mobile{color:#cbd5e1;}",
      /* viewer */
      ".mc-viewer{position:fixed;inset:0;z-index:1000000;background:rgba(8,12,20,.97);display:flex;flex-direction:column;",
      "  animation:mcFade .18s ease;touch-action:none;user-select:none;-webkit-user-select:none;}",
      "@keyframes mcFade{from{opacity:0}to{opacity:1}}",
      ".mc-vtop{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;color:#fff;}",
      ".mc-vtitle{min-width:0;} .mc-vtitle b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".mc-vtitle span{font-size:12px;color:#cbd5e1;}",
      ".mc-vclose{flex-shrink:0;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:18px;cursor:pointer;}",
      ".mc-vstage{position:relative;flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:zoom-in;}",
      ".mc-vstage.mc-zoomed{cursor:grab;}",
      ".mc-vimg{max-width:92vw;max-height:78vh;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.6);transform-origin:center center;",
      "  will-change:transform;-webkit-user-drag:none;pointer-events:none;background:#222;}",
      ".mc-vbar{display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px calc(14px + env(safe-area-inset-bottom));}",
      ".mc-vbar button{height:40px;min-width:40px;padding:0 14px;border-radius:20px;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:15px;font-weight:600;cursor:pointer;}",
      ".mc-vbar button:active{background:rgba(255,255,255,.3);}",
      ".mc-vpct{min-width:62px;text-align:center;color:#e2e8f0;font-size:13px;}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(String(s == null ? "" : s));
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ── card ── */
  function renderMemberCard(el, u) {
    if (!el) return;
    if (!u) { el.style.display = "none"; el.innerHTML = ""; return; }
    var hasPhoto = !!u.PhotoURL;
    var fb = window._AVATAR_FALLBACK_SVG || (typeof _AVATAR_FALLBACK_SVG !== "undefined" ? _AVATAR_FALLBACK_SVG : "");
    var thumb = hasPhoto && typeof window._driveImgSrc === "function" ? window._driveImgSrc(u.PhotoURL)
              : (hasPhoto && typeof _driveImgSrc === "function" ? _driveImgSrc(u.PhotoURL) : "");
    var imgTag = hasPhoto
      ? '<img data-rawphoto="' + esc(u.PhotoURL) + '" data-drivesrc="' + esc(thumb) + '" src="' + fb + '" alt="' + esc(u.Name || "") + '" ' +
        'onerror="this.onerror=null;this.src=\'' + fb + '\';"/>'
      : '<img src="' + fb + '" alt=""/>';
    el.style.cssText = "display:flex;"; // layout comes from .mc-card
    el.className = "mc-card";
    el.innerHTML =
      '<button type="button" class="mc-photo' + (hasPhoto ? "" : " mc-nophoto") + '"' +
        (hasPhoto ? ' onclick="_openMemberPhotoZoom(this)" title="Click to zoom photo" aria-label="Zoom photo"' : ' tabindex="-1" aria-label="No photo"') + '>' +
        imgTag +
        (hasPhoto ? '<span class="mc-zoom-badge"><i class="fa-solid fa-magnifying-glass-plus"></i></span>' : "") +
      '</button>' +
      '<div class="mc-info">' +
        '<div class="mc-name" title="' + esc(u.Name || "") + '">' + esc(u.Name || "") + '</div>' +
        '<div class="mc-mobile"><i class="fa-solid fa-phone"></i><span>' + (u.Mobile ? esc(u.Mobile) : "—") + '</span></div>' +
        '<div class="mc-hint">' + (hasPhoto ? "Tap photo to zoom &amp; verify" : "No photo on file") + '</div>' +
      '</div>';
    el._mcUser = u;
    if (window._lazyLoadDriveImgs) window._lazyLoadDriveImgs(el);
  }
  window._renderMemberCard = renderMemberCard;

  /* ── full-screen viewer ── */
  var viewer = null;

  function bigSrc(u, cardImg) {
    // currently loaded image in the card (base64 or thumbnail) — shows instantly
    var fb = window._AVATAR_FALLBACK_SVG || (typeof _AVATAR_FALLBACK_SVG !== "undefined" ? _AVATAR_FALLBACK_SVG : "");
    var cur = cardImg && cardImg.src && cardImg.src !== fb ? cardImg.src : "";
    // try a larger Google Drive thumbnail for sharper zoom
    var big = "";
    try {
      var m = String(u.PhotoURL || "").match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{10,})/);
      if (m) big = "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
    } catch (e) {}
    return { cur: cur, big: big };
  }

  window._openMemberPhotoZoom = function (btn) {
    var card = btn && btn.closest ? btn.closest(".mc-card") : null;
    var u = card && card._mcUser;
    if (!u || !u.PhotoURL) return;
    closeViewer();
    var cardImg = btn.querySelector("img");
    var src = bigSrc(u, cardImg);

    var v = document.createElement("div");
    v.className = "mc-viewer";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-label", "Member photo");
    v.innerHTML =
      '<div class="mc-vtop"><div class="mc-vtitle"><b>' + esc(u.Name || "") + '</b><span>' + (u.Mobile ? esc(u.Mobile) : "") + '</span></div>' +
        '<button type="button" class="mc-vclose" title="Close" aria-label="Close">&#10005;</button></div>' +
      '<div class="mc-vstage"><img class="mc-vimg" alt="' + esc(u.Name || "") + '"/></div>' +
      '<div class="mc-vbar"><button type="button" data-z="out" title="Zoom out" aria-label="Zoom out">&minus;</button>' +
        '<span class="mc-vpct">100%</span>' +
        '<button type="button" data-z="in" title="Zoom in" aria-label="Zoom in">+</button>' +
        '<button type="button" data-z="reset" title="Reset">Reset</button></div>';
    document.body.appendChild(v);
    viewer = v;

    var stage = v.querySelector(".mc-vstage");
    var img = v.querySelector(".mc-vimg");
    var pct = v.querySelector(".mc-vpct");
    var S = { s: 1, x: 0, y: 0 };
    var MIN = 1, MAX = 6;

    img.src = src.cur || src.big || "";
    if (src.big && src.cur) {
      var pre = new Image();
      pre.onload = function () { if (img.isConnected) img.src = src.big; };
      pre.src = src.big;
    }

    function clampPan() {
      // keep the image from being dragged completely out of view
      var r = img.getBoundingClientRect();
      var base = { w: r.width / S.s, h: r.height / S.s };
      var maxX = Math.max(0, (base.w * S.s - stage.clientWidth) / 2 + 60);
      var maxY = Math.max(0, (base.h * S.s - stage.clientHeight) / 2 + 60);
      S.x = Math.max(-maxX, Math.min(maxX, S.x));
      S.y = Math.max(-maxY, Math.min(maxY, S.y));
      if (S.s <= 1) { S.x = 0; S.y = 0; }
    }
    function apply() {
      S.s = Math.max(MIN, Math.min(MAX, S.s));
      clampPan();
      img.style.transform = "translate(" + S.x + "px," + S.y + "px) scale(" + S.s + ")";
      pct.textContent = Math.round(S.s * 100) + "%";
      stage.classList.toggle("mc-zoomed", S.s > 1);
    }
    function zoomTo(ns) { S.s = ns; apply(); }

    v.querySelector('[data-z="in"]').onclick = function () { zoomTo(S.s * 1.5); };
    v.querySelector('[data-z="out"]').onclick = function () { zoomTo(S.s / 1.5); };
    v.querySelector('[data-z="reset"]').onclick = function () { S.x = 0; S.y = 0; zoomTo(1); };
    v.querySelector(".mc-vclose").onclick = closeViewer;
    // click on the dark area (not the photo/bar) closes
    v.addEventListener("click", function (e) {
      if (e.target === v) closeViewer();
    });

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomTo(S.s * Math.exp(-e.deltaY * 0.0018));
    }, { passive: false });

    /* pointer handling: drag to pan, pinch to zoom, tap to toggle zoom */
    var ptrs = {}, startDist = 0, startScale = 1, moved = false, downT = 0, last = null;
    function dist() {
      var k = Object.keys(ptrs);
      if (k.length < 2) return 0;
      var a = ptrs[k[0]], b = ptrs[k[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    stage.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      moved = false; downT = Date.now();
      last = { x: e.clientX, y: e.clientY };
      if (Object.keys(ptrs).length === 2) { startDist = dist(); startScale = S.s; }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var n = Object.keys(ptrs).length;
      if (n === 2 && startDist) {
        moved = true;
        S.s = startScale * (dist() / startDist);
        apply();
      } else if (n === 1 && S.s > 1 && last) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        S.x += dx; S.y += dy; last = { x: e.clientX, y: e.clientY };
        apply();
      } else if (last && Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 6) {
        moved = true;
      }
    });
    function up(e) {
      var wasTap = !moved && Date.now() - downT < 350 && Object.keys(ptrs).length === 1;
      delete ptrs[e.pointerId];
      if (Object.keys(ptrs).length < 2) startDist = 0;
      if (wasTap) { S.x = 0; S.y = 0; zoomTo(S.s > 1 ? 1 : 2.5); }
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", function (e) { delete ptrs[e.pointerId]; startDist = 0; });

    apply();
    setTimeout(function () { try { v.querySelector(".mc-vclose").focus(); } catch (e) {} }, 0);
  };

  function closeViewer() {
    if (viewer && viewer.parentNode) viewer.parentNode.removeChild(viewer);
    viewer = null;
  }

  // Esc closes ONLY the viewer (and must not also trigger the panel's Esc / discard dialog)
  document.addEventListener("keydown", function (e) {
    if (!viewer) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      closeViewer();
    } else if (e.key === "+" || e.key === "=") {
      var b = viewer.querySelector('[data-z="in"]'); if (b) b.click();
    } else if (e.key === "-") {
      var o = viewer.querySelector('[data-z="out"]'); if (o) o.click();
    }
  }, true);
})();
