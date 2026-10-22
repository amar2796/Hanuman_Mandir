/* ════════════════════════════════════════════════════════════════
   admin-access-level.js
   ACCESS LEVELS for Admin accounts: Super Admin / Admin / Viewer.

   The real protection is in the backend script (appscript.txt, _ACTION_MIN).
   This file only makes the page match it:
     • shows the level (header badge, Viewer banner)
     • hides pages that are Super-Admin only
     • greys + explains buttons the level cannot use
     • shows a friendly pop-up instead of a failed request
     • gives Super Admins an Access Level control on the Users page

   Levels live in USERS.AccessLevel (Super Admin / Admin / Viewer).
   Members (Role = User) are not affected.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var RANK = { viewer: 0, admin: 1, super: 2 };
  var LABEL = { viewer: "Viewer", admin: "Admin", super: "Super Admin" };

  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
  function norm(v) {
    var t = String(v == null ? "" : v).toLowerCase().replace(/[\s_\-]/g, "");
    if (t === "superadmin" || t === "super") return "super";
    if (t === "admin") return "admin";
    return "viewer";                       // blank / unknown = Viewer (least privilege)
  }
  function isAdminRole(u) { return String((u && u.Role) || "").toLowerCase() === "admin"; }
  function session() { try { return JSON.parse(localStorage.getItem("session") || "{}"); } catch (e) { return {}; } }

  /* my level; null = not known yet (users not loaded) → no restrictions drawn */
  function myLevel() {
    var list = typeof users !== "undefined" ? users : [];
    if (!list.length) return null;
    var s = session();
    var me = list.find(function (u) { return String(u.UserId) === String(s.userId); });
    if (!me || !isAdminRole(me)) return null;
    // Before the one-time upgrade has run (no Super Admin recorded yet) nobody is restricted on screen;
    // the server upgrades the accounts on the first restricted action.
    var anySuper = list.some(function (u) { return isAdminRole(u) && String(u.AccessLevel || "").trim() !== "" && norm(u.AccessLevel) === "super"; });
    if (!anySuper) return "super";
    return norm(me.AccessLevel);
  }
  function superRecorded() {
    return (typeof users !== "undefined" ? users : []).some(function (u) { return isAdminRole(u) && String(u.AccessLevel || "").trim() !== "" && norm(u.AccessLevel) === "super"; });
  }
  /* the server adds the AccessLevel column on first use — pick the new values up without a manual reload */
  var _reloading = false;
  function reloadUsers() {
    if (_reloading || typeof getData !== "function") return;
    _reloading = true;
    getData("getUsers").then(function (list) {
      if (Array.isArray(list)) list.forEach(function (n) {
        var u = users.find(function (x) { return String(x.UserId) === String(n.UserId); });
        if (u) u.AccessLevel = n.AccessLevel;
      });
      _reloading = false; refresh();
    }, function () { _reloading = false; });
  }
  window._myAccessLevel = myLevel;
  window._alLabel = function (v) { return LABEL[norm(v)]; };
  window._alKey = function (v) { return norm(v); };
  function can(need) { var l = myLevel(); return l === null || RANK[l] >= RANK[need]; }

  /* ── what each action needs (mirror of the backend table) ── */
  var ACTION_MIN = {
    addContribution: "admin", updateContribution: "admin", addExpense: "admin", updateExpense: "admin",
    addUser: "admin", uploadExpenseReceipt: "admin",
    updateUser: "super", updateFeedbackStatus: "super",
    resolveContributionRequest: "super", sendContribReceiptEmail: "super", sendIndividualTrackerEmail: "super",
    deleteContribution: "super", deleteExpense: "super", removeExpenseReceipt: "super", removeOneExpenseReceipt: "super", removeAllExpenseReceipts: "super",
    setYearLock: "super", setAccessLevel: "super", resetTrafficStats: "super", deleteUser: "super", restoreUser: "super", approveUser: "super", rejectUser: "super",
    addType: "super", deleteType: "super", updateType: "super", addOccasion: "super", deleteOccasion: "super", updateOccasion: "super",
    addExpenseType: "super", deleteExpenseType: "super", updateExpenseType: "super", updateSortOrder: "super",
    addGoal: "super", updateGoal: "super", deleteGoal: "super", addEvent: "super", updateEvent: "super", deleteEvent: "super", addEventExpense: "super",
    deleteGalleryPhoto: "super", uploadGalleryPhoto: "super",
    saveEmailSettings: "super", saveAnnouncement: "super", clearAnnouncement: "super", toggleAnnouncementStatus: "super",
    saveBroadcast: "super", deleteBroadcast: "super", toggleBroadcast: "super", saveChatbotConfig: "super",
    deleteFeedback: "super", deleteContributionRequest: "super",
    triggerMonthlyReport: "super", triggerMonthlyReminder: "super", sendMonthlyReminders: "super", sendBirthdayEmails: "super",
    triggerAdminSummary: "super", triggerPendingReport: "super"
  };
  var READ_SUPER = /^(getAuditLog|getBroadcastsAdmin|getAnnouncementHistory|getEmailSettings|getMonthlyReportStatus|getAdminSummaryStatus|getPendingReportStatus)\b/;

  /* ── pop-up ── */
  var popupOpen = false;
  function popup(need, customMsg) {
    var l = myLevel() || "admin";
    var title = l === "viewer" ? "View only" : "Super Admin only";
    var body = customMsg ||
      (l === "viewer"
        ? "Your access level is <b>Viewer</b>. You can see everything and export, but you cannot make changes."
        : "This needs <b>" + LABEL[need || "super"] + "</b> access. Your level is <b>" + LABEL[l] + "</b>.");
    if (typeof openModal !== "function") { alert(title); return; }
    popupOpen = true;
    openModal(
      '<div style="height:4px;background:#475569;border-radius:16px 16px 0 0;"></div>' +
      '<div class="_mbdy" style="text-align:center;padding:24px 26px 24px;">' +
      '<div style="width:64px;height:64px;border-radius:50%;margin:0 auto 14px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;">' + (l === "viewer" ? "👁" : "🔐") + '</div>' +
      '<p style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 8px;">' + title + '</p>' +
      '<p style="font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.5;">' + body + '<br>Ask a Super Admin if you need this changed.</p>' +
      '<button class="_mbtn" id="_alOkBtn" style="background:#475569;min-width:110px;">OK</button></div>', "360px");
    setTimeout(function () {
      var b = document.getElementById("_alOkBtn");
      if (b) b.addEventListener("click", function () { popupOpen = false; closeModal(); });
    }, 0);
  }

  /* ── request guards ── */
  function installRequestGuards() {
    var op = window.postData;
    if (typeof op === "function" && !op._alWrapped) {
      var w = function (p) {
        var need = p && ACTION_MIN[p.action];
        if (need && !can(need)) {
          if (!popupOpen) popup(need);
          return Promise.resolve({ status: "error", errorCode: "forbidden", message: "Not allowed for your access level." });
        }
        return op.apply(this, arguments).then(function (res) {
          if (res && res.errorCode === "forbidden" && !popupOpen) popup(res.requiredLevel, res.message);
          if (res && res.status === "success" && need && !superRecorded()) reloadUsers();
          return res;
        });
      };
      w._alWrapped = true; window.postData = w;
    }
    var og = window.getData;
    if (typeof og === "function" && !og._alWrapped) {
      var g = function (action) {
        if (READ_SUPER.test(String(action || "")) && !can("super")) return Promise.resolve(/^getAuditLog/.test(String(action)) ? [] : {});
        return og.apply(this, arguments);
      };
      g._alWrapped = true; window.getData = g;
    }
    var oe = window.openEditUser;
    if (typeof oe === "function" && !oe._alWrapped) {
      var ge = function (id) {
        var s = session(), t = (typeof users !== "undefined" ? users : []).find(function (x) { return String(x.UserId) === String(id); });
        if (t && String(t.UserId) !== String(s.userId) && !can("super")) {
          popup("super", "Only a <b>Super Admin</b> can edit member and admin accounts.");
          return;
        }
        return oe.apply(this, arguments);
      };
      ge._alWrapped = true; window.openEditUser = ge;
    }
    var os = window.showPage;
    if (typeof os === "function" && !os._alWrapped) {
      var SUPER_PAGES = { masterPage: 1, galleryAdminPage: 1, announcementPage: 1, broadcastPage: 1, chatbotPage: 1, emailAutoPage: 1, auditPage: 1, healthCheckPage: 1 };
      var sp = function (id) {
        if (SUPER_PAGES[id] && !can("super")) { popup("super", "This page is for <b>Super Admin</b> only."); return; }
        return os.apply(this, arguments);
      };
      sp._alWrapped = true; window.showPage = sp;
    }
  }

  /* ── what to grey, by the function named in onclick ── */
  var SUPER_BTN = /^(delete[A-Z]\w*|approveUser|rejectUser|restoreUser|removeExpenseReceipt\w*|removeOneExpenseReceipt|_ylToggle|addGoal|trigger\w+|sendTrackerPendingReport|sendTrackerAdminSummary|sendTrackerIndividualEmails|triggerTestBirthdayEmail|sendBroadcast|saveAnnouncement|clearAnnouncement|saveChatbotSettings|addType|addOccasion|addExpenseType|openEditGoal|openEditEvent|saveEditGoal|saveEditEvent|openAddEventExpense|saveEventExpense|fbDeleteRow|_deleteOneReceipt|openEditUser|saveEditUser|resendReceiptEmail|_approveContribRequest|_rejectContribRequest|fbMarkResolved|replyToFeedback|confirmRejectUser|confirmResetTraffic|toggleAnnouncementItem|uploadGalleryPhoto|dash_exportPDF|dash_email|sendReceiptEmailDirect|downloadLocalBackup|dbExport\w+|export(?!Receipt)\w*|exportSelected\w*)$/;
  /* every report / export / download is Super Admin only (receipts stay available) */
  var REPORT_NAME = /(export|pdf|csv|report|backup)/i;
  var ADMIN_BTN = /^(openEditContrib|openEditExpense|openWalkInContribution|openBulkInsert|runBulkInsert|saveWalkIn|addContribution|addExpense|addUser|uploadExpenseReceipt|exportReceiptPDF|printReceipt|saveEditContrib\w*|saveEditExpense)$/;
  var CALL_RE = /^\s*(?:event\.stopPropagation\(\)\s*;\s*)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/;

  var ANY_CALL = /([A-Za-z_$][\w$]*)\s*\(([^()]*)\)/g;
  function needFor(el) {
    var on = el.getAttribute("onclick") || "", best = null, m;
    ANY_CALL.lastIndex = 0;
    while ((m = ANY_CALL.exec(on))) {          // e.g. "closeModal();deleteUser('U1')" → looks at every call
      var fn = m[1], arg = m[2], need = null;
      if (fn === "spOpen") {
        if (/['"]event['"]/.test(arg)) need = "super";
        else if (/['"](contrib|expense|user)['"]/.test(arg)) need = "admin";
      } else if (SUPER_BTN.test(fn) || (REPORT_NAME.test(fn) && !/receipt/i.test(fn) && fn !== "closeModal")) need = "super";
      else if (ADMIN_BTN.test(fn)) need = "admin";
      if (need === "super") return "super";
      if (need) best = need;
    }
    return best;
  }

  function decorateButtons(l) {
    var els = document.querySelectorAll("button[onclick], a[onclick], [role=button][onclick], .sp-action-btn[onclick]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], need = needFor(el);
      if (!need) continue;
      var blocked = l !== null && RANK[l] < RANK[need];
      if (blocked) {
        if (el.getAttribute("data-al-need") !== need) {
          el.setAttribute("data-al-need", need);
          if (!el.hasAttribute("data-al-title")) el.setAttribute("data-al-title", el.getAttribute("title") || "");
        }
        el.classList.add("al-locked");
        el.setAttribute("title", l === "viewer" ? "View only" : "Super Admin only");
      } else if (el.classList.contains("al-locked")) {
        el.classList.remove("al-locked"); el.removeAttribute("data-al-need");
        var t = el.getAttribute("data-al-title");
        if (t) el.setAttribute("title", t); else el.removeAttribute("title");
      }
    }
  }
  // click on a greyed control → friendly pop-up, original handler never runs
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".al-locked") : null;
    if (!t) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    popup(t.getAttribute("data-al-need"));
  }, true);

  /* ── page-level look: badge, banner, hidden pages ── */
  var HIDE_PAGE_IDS = ["masterPage", "galleryAdminPage", "announcementPage", "broadcastPage", "chatbotPage", "emailAutoPage", "auditPage", "healthCheckPage"];
  var HIDE_LABELS = ["Master Data", "Gallery", "Announcement", "Broadcast", "Chatbot", "Email Automation", "Audit Log", "System Health"];
  function decoratePage(l) {
    var b = document.body;
    ["al-super", "al-admin", "al-viewer"].forEach(function (c) { b.classList.remove(c); });
    if (l) b.classList.add("al-" + l);
    var roleEl = document.getElementById("adminDropRole");
    if (roleEl && l) roleEl.textContent = LABEL[l];
    // colour pill next to "Welcome," in the top bar
    var wu = document.getElementById("welcomeUser"), wl = wu && wu.previousElementSibling, pill = document.getElementById("alPill");
    if (wl && l) {
      if (!pill) { pill = document.createElement("span"); pill.id = "alPill"; wl.appendChild(pill); }
      pill.className = "al-b al-b-" + l; pill.textContent = LABEL[l];
    } else if (pill) pill.remove();
    // sidebar
    document.querySelectorAll("li[data-label]").forEach(function (li) {
      var hide = l !== null && l !== "super" && HIDE_LABELS.indexOf(li.getAttribute("data-label")) !== -1;
      li.style.display = hide ? "none" : "";
    });
    // viewer banner
    var ban = document.getElementById("alBanner");
    if (l === "viewer") {
      if (!ban) {
        ban = document.createElement("div"); ban.id = "alBanner";
        ban.innerHTML = '👁 <b>View only</b> — you can see everything and export, but you cannot make changes.';
        var host = document.querySelector(".main-content, #mainContent, main") || document.body;
        host.insertBefore(ban, host.firstChild);
      }
    } else if (ban) ban.remove();
  }

  /* ── Users page: level badge + (Super Admin) dropdown on Admin rows ── */
  function decorateUsers(l) {
    var rows = document.querySelectorAll("#userTable tr[onclick^=\"viewUser(\"]");
    var s = session();
    for (var i = 0; i < rows.length; i++) {
      var m = /viewUser\('([^']+)'\)/.exec(rows[i].getAttribute("onclick") || "");
      if (!m) continue;
      var u = (typeof users !== "undefined" ? users : []).find(function (x) { return String(x.UserId) === m[1]; });
      var cell = rows[i].children[4];
      if (!u || !cell || !isAdminRole(u)) continue;
      var lv = norm(u.AccessLevel);
      var sig = lv + "|" + (l === "super" && String(u.UserId) !== String(s.userId) ? "edit" : "ro");
      var box = cell.querySelector(".al-box");
      if (box && box.getAttribute("data-sig") === sig) continue;
      if (!box) { box = document.createElement("div"); box.className = "al-box"; cell.appendChild(box); }
      box.setAttribute("data-sig", sig);
      var rb = cell.querySelector(".badge");
      if (rb) {                                      // Role badge itself shows Super Admin / Admin / Viewer, colour-coded
        rb.textContent = LABEL[lv];
        rb.classList.remove("badge-red", "badge-green");
        rb.classList.add("al-b", "al-b-" + lv);
      }
      if (l === "super" && String(u.UserId) !== String(s.userId)) {
        box.innerHTML = '<select class="al-sel" data-uid="' + esc(u.UserId) + '" data-old="' + lv + '" onclick="event.stopPropagation()" onchange="_alChange(this)" title="Access level">' +
          ["super", "admin", "viewer"].map(function (k) { return '<option value="' + k + '"' + (k === lv ? " selected" : "") + '>' + LABEL[k] + '</option>'; }).join("") + '</select>';
      } else {
        box.innerHTML = "";
      }
    }
  }

  window._alChange = function (sel) {
    var uid = sel.getAttribute("data-uid"), old = sel.getAttribute("data-old"), nv = sel.value;
    if (nv === old) return;
    sel.value = old; // revert until the server confirms
    var u = (typeof users !== "undefined" ? users : []).find(function (x) { return String(x.UserId) === String(uid); });
    var msg = "Change access of " + esc(u ? u.Name : "this admin") + " from " + LABEL[old] + " to " + LABEL[nv] + "?";
    var run = async function () {
      var s = session();
      var res = await postData({ action: "setAccessLevel", UserId: uid, Level: LABEL[nv], AdminName: s.name || "Admin", sessionToken: s.sessionToken || "", userId: s.userId || "" });
      if (res && res.status === "success") {
        if (u) u.AccessLevel = LABEL[nv];
        if (typeof renderUsers === "function") renderUsers();
        if (typeof toast === "function") toast("✅ Access level changed to " + LABEL[nv] + ".");
        refresh();
      } else if (res && res.errorCode !== "forbidden" && typeof toast === "function") {
        toast((res && res.message) || "Could not change the level.", "error");
      }
    };
    if (typeof confirmModal === "function") confirmModal(msg, run, "Change Access", "#C1440E");
    else if (window.confirm(msg.replace(/<[^>]+>/g, ""))) run();
  };

  /* ── styles ── */
  try {
    var st = document.createElement("style");
    st.textContent =
      ".al-locked{opacity:.4!important;cursor:not-allowed!important;filter:grayscale(.6);}" +
      "body:not(.al-super) .yl-btn{display:none!important;}" +
      "#alBanner{margin:0 0 12px;padding:9px 14px;border-radius:10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;font-size:12.5px;}" +
      ".al-box{margin-top:4px;}.al-sel{font-size:11px;padding:2px 4px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;}" +
      ".al-chip{font-size:10px;padding:2px 8px;border-radius:999px;white-space:nowrap;}" +
      ".al-chip.al-super{background:#475569;color:#fff;}.al-chip.al-admin{background:#e0f2fe;color:#075985;}.al-chip.al-viewer{background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;}" +
      ".al-b{border-radius:999px;font-weight:600;}.al-b-super{background:#dcfce7!important;color:#166534!important;}" +
      ".al-b-admin{background:#e0f2fe!important;color:#075985!important;}.al-b-viewer{background:#fef3c7!important;color:#92400e!important;}" +
      "#alPill{margin-left:6px;padding:1px 8px;font-size:10px;vertical-align:middle;}" +
      "body.dark-mode .al-b-super{background:#14532d!important;color:#bbf7d0!important;}body.dark-mode .al-b-admin{background:#0c4a6e!important;color:#bae6fd!important;}body.dark-mode .al-b-viewer{background:#78350f!important;color:#fde68a!important;}" +
      "body.dark-mode #alBanner{background:#1e293b;border-color:#334155;color:#cbd5e1;}" +
      "body.dark-mode .al-sel{background:#111827;border-color:#2d3f58;color:#e2e8f0;}";
    document.head.appendChild(st);
  } catch (e) {}

  /* Add User form: a Super Admin chooses the new Admin's access level (shown only when Role = Admin) */
  function decorateAddUser(l) {
    var role = document.getElementById("u_role");
    if (!role) return;
    var grp = document.getElementById("u_access_group");
    if (!grp) {
      grp = document.createElement("div"); grp.className = "sp-field-group"; grp.id = "u_access_group";
      grp.innerHTML = '<label class="sp-label">Access Level <span class="sp-optional">(Admin accounts)</span></label>' +
        '<select id="u_access" class="sp-input"><option value="Super Admin">Super Admin — full access</option><option value="Admin">Admin — daily work</option><option value="Viewer" selected>Viewer — view only (default)</option></select>';
      var host = role.closest(".sp-field-group") || role.parentNode;
      host.parentNode.insertBefore(grp, host.nextSibling);
      role.addEventListener("change", function () { decorateAddUser(myLevel()); });
    }
    for (var i = 0; i < role.options.length; i++) {   // only a Super Admin can create an Admin account
      if (role.options[i].text === "Admin") { role.options[i].disabled = !(l === null || l === "super"); role.options[i].title = role.options[i].disabled ? "Only a Super Admin can create an Admin" : ""; }
    }
    grp.style.display = (role.value === "Admin" && (l === null || l === "super")) ? "" : "none";
  }

  function refresh() {
    try {
      var l = myLevel();
      decoratePage(l);
      decorateButtons(l);
      decorateUsers(l);
      decorateAddUser(l);
      var rf = document.getElementById("rcpt_file");   // expense "Receipt Photos": only Admin and above may add photos
      if (rf) {
        var okAdd = l === null || RANK[l] >= RANK.admin;
        rf.disabled = !okAdd;
        if (rf.parentNode) rf.parentNode.style.opacity = okAdd ? "" : ".5";
        if (!okAdd && !document.getElementById("rcpt_viewonly")) {
          var note = document.createElement("div"); note.id = "rcpt_viewonly";
          note.style.cssText = "font-size:11.5px;color:#92400e;margin:0 0 8px;";
          note.textContent = "View only — you cannot add or remove photos.";
          rf.parentNode.insertBefore(note, rf);
        }
      }
      // command palette (Ctrl+K): don't offer pages this level cannot open
      document.querySelectorAll(".cmdk-v2-item[data-page]").forEach(function (it) {
        var pg = it.getAttribute("data-page");
        it.style.display = (l !== null && l !== "super" && HIDE_PAGE_IDS.indexOf(pg) !== -1) ? "none" : "";
      });
      var rs = document.getElementById("eu_role");   // Edit User form: only a Super Admin may change a role
      if (rs && l && l !== "super") { rs.disabled = true; rs.title = "Only a Super Admin can change a role"; }
    } catch (e) {}
  }

  function start() {
    installRequestGuards();
    refresh();
    var timer = null;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 90);
    }).observe(document.body, { childList: true, subtree: true });
  }
  // after every page script so the functions we wrap exist
  if (document.readyState === "complete") setTimeout(start, 0);
  else window.addEventListener("load", function () { setTimeout(start, 0); });
})();
