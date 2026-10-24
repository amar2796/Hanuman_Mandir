/* admin-polish.js — display-only: "Showing N entries · ₹total" line above the
   Contribution / Expense tables, following the active filters. Wraps the
   existing render functions and calls them untouched; any error is swallowed. */
(function () {
  "use strict";
  function cur() { return (window.APP && APP.currency) || "₹"; }
  function loc() { return (window.APP && APP.locale) || "en-IN"; }
  function put(tbodyId, count, total) {
    var tb = document.getElementById(tbodyId);
    var wrap = tb && tb.closest(".table-v2-wrap");
    if (!wrap) return;
    var line = wrap.previousElementSibling;
    if (!line || !line.classList.contains("list-count-line")) {
      line = document.createElement("div");
      line.className = "list-count-line";
      wrap.parentNode.insertBefore(line, wrap);
    }
    line.innerHTML = "Showing <b>" + count + "</b> " + (count === 1 ? "entry" : "entries") +
      " · <b>" + cur() + Number(total || 0).toLocaleString(loc()) + "</b>";
  }
  function wrap(name, fn) {
    var orig = window[name];
    if (typeof orig !== "function" || orig._polished) return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try { fn(); } catch (e) {}
      return r;
    };
    window[name]._polished = true;
  }
  function install() {
    wrap("_renderContribPage", function () {
      var l = window._contribList || [];
      put("tb", l.length, l.reduce(function (s, r) { return s + Number(r.Amount || 0); }, 0));
    });
    wrap("_renderExpensePage", function () {
      var l = window._expenseList || [];
      put("expenseRecordsBody", l.length, l.reduce(function (s, r) { return s + Number(r.Amount || 0); }, 0));
    });
  }
  if (document.readyState === "complete") install(); else window.addEventListener("load", install);
})();


/* ── Tracker filters: tap the "Power Filters" header to open / close ── */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var h = e.target && e.target.closest && e.target.closest(".ct-pf-header");
    if (!h || e.target.closest("button")) return;
    var panel = h.closest(".ct-pf-panel");
    if (panel) panel.classList.toggle("pf-open");
  });
})();


/* ── Day Book: small "N active" badge next to Filters ── */
(function () {
  "use strict";
  function upd() {
    var b = document.getElementById("db_activeCount"); if (!b) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : ""; }
    var chip = document.querySelector("#db_quick .db-chip.active");
    var n = 0;
    if (!chip || chip.getAttribute("data-q") !== "month") n++;
    if (v("db_kind") !== "all") n++;
    if (v("db_basis") !== "period") n++;
    if (v("db_order") !== "desc") n++;
    if ((v("db_search") || "").trim()) n++;
    b.textContent = n + " active"; b.classList.toggle("on", n > 0);
  }
  ["click", "change", "input"].forEach(function (t) {
    document.addEventListener(t, function (e) {
      if (e.target && e.target.closest && e.target.closest("#db_filterCard")) setTimeout(upd, 0);
    });
  });
})();


/* ── Dashboard: "Top Contributors" card under the summary tiles (follows the active filters) ── */
(function () {
  "use strict";
  var MEDAL = ["🥇", "🥈", "🥉"];
  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s)) : String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function box() {
    var b = document.getElementById("ct_topBox");
    if (b) return b;
    var strip = document.querySelector("#dash_panel_contrib .ct-sum6");
    if (!strip) return null;
    b = document.createElement("div"); b.id = "ct_topBox"; b.className = "tc-box";
    strip.parentNode.insertBefore(b, strip.nextSibling);
    return b;
  }
  function render() {
    var b = box(); if (!b) return;
    var rows = (typeof _ct_filtered !== "undefined" && _ct_filtered) || [];
    var map = {}, noteMap = {}, cnt = {}, total = 0;
    rows.forEach(function (r) {
      if (r._type !== "paid") return;
      var uid = String(r._data.UserId); if (uid.indexOf("WALKIN_") === 0) return;
      var a = Number(r._data.Amount || 0);
      map[uid] = (map[uid] || 0) + a; cnt[uid] = (cnt[uid] || 0) + 1; total += a;
      if (!noteMap[uid]) noteMap[uid] = r._data.Note || "";
    });
    var ids = Object.keys(map).sort(function (x, y) { return map[y] - map[x]; }).slice(0, 5);
    if (!ids.length) { b.style.display = "none"; b.innerHTML = ""; return; }
    b.style.display = "";
    var cur = (window.APP && APP.currency) || "₹", top = map[ids[0]] || 1;
    var fm = function (n) { return typeof fmt === "function" ? fmt(n) : Number(n).toLocaleString("en-IN"); };
    b.innerHTML = '<div class="tc-head"><div class="tc-title">🏆 Top Contributors</div><div class="tc-sub">Members only · follows your filters</div></div><div class="tc-list">' +
      ids.map(function (uid, i) {
        var u = (typeof dash_users !== "undefined" ? dash_users : []).find(function (x) { return String(x.UserId) === uid; });
        var name = typeof dash_getDisplayName === "function" ? dash_getDisplayName(uid, noteMap[uid]) : uid;
        var av = ""; try { av = typeof _avatarHtml === "function" ? _avatarHtml(u, 30) : ""; } catch (e) {}
        var pct = Math.max(4, Math.round(map[uid] / top * 100)), share = total ? Math.round(map[uid] / total * 100) : 0;
        return '<div class="tc-row tc-r' + (i + 1) + '" style="--d:' + (i * 0.06) + 's"><div class="tc-rank">' + (MEDAL[i] || (i + 1)) + '</div><div class="tc-av">' + av + '</div>' +
          '<div class="tc-main"><div class="tc-name">' + esc(name) + '</div><div class="tc-bar"><i style="width:' + pct + '%"></i></div></div>' +
          '<div class="tc-amt"><b>' + cur + fm(map[uid]) + '</b><span>' + cnt[uid] + (cnt[uid] === 1 ? ' payment' : ' payments') + ' · ' + share + '%</span></div></div>';
      }).join("") + '</div>';
    if (window._lazyLoadDriveImgs) { try { window._lazyLoadDriveImgs(b); } catch (e) {} }
  }
  function install() {
    var orig = window.ct_renderSummary;
    if (typeof orig !== "function" || orig._tc) return;
    window.ct_renderSummary = function () { var r = orig.apply(this, arguments); try { render(); } catch (e) {} return r; };
    window.ct_renderSummary._tc = true;
  }
  if (document.readyState === "complete") install(); else window.addEventListener("load", install);
})();
