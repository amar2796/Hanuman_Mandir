/* ═══ THANK-YOU CARD LOOK — Admin → Email Automation ═══
   Pick theme / border / amount / sections, see a live preview, see which look is
   RUNNING NOW, and email yourself a test card. Super Admin only (server-enforced).
   Backend: getThankYouCardSettings, saveThankYouCardSettings, sendThankYouCardTest.
   Saved look applies to the NEXT cards; emails already sent do not change. */
var _tyc = { data: null, sel: null, qr: "", view: "with", busy: false, rz: false };
var _TYC_BORDERS = [["gold", "Gold frame"], ["line", "Thin line"], ["none", "No border"]];
var _TYC_AMOUNTS = [["off", "Off"], ["on", "On"], ["both", "Both versions"]];
var _TYC_SECS    = [["showEvents", "Events"], ["showLocation", "Location and QR"], ["showAarti", "Timings"], ["showContact", "Contact"]];
var _TYC_KEYS    = ["theme", "border", "amount", "showEvents", "showLocation", "showAarti", "showContact"];

function _tycE(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function _tycName(list, k) { var f = list.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : k; }
function _tycTheme(k) { var t = (_tyc.data.themes || []).filter(function (x) { return x.key === k; })[0]; return t || _tyc.data.themes[0]; }
function _tycSame(a, b) { return _TYC_KEYS.every(function (k) { return a[k] === b[k]; }); }
function _tycAdmin() { try { return (JSON.parse(localStorage.getItem("session") || "{}").name) || "Admin"; } catch (e) { return "Admin"; } }
function _tycMyEmail() { try { var s = JSON.parse(localStorage.getItem("session") || "{}"); return s.email || s.Email || ""; } catch (e) { return ""; } }
function _tycMix(a, b, t) {
  function h(x) { return [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; }
  var A = h(a), B = h(b);
  return "#" + [0, 1, 2].map(function (i) { var v = Math.round(A[i] + (B[i] - A[i]) * t); return (v < 16 ? "0" : "") + v.toString(16); }).join("");
}
function _tycDot(T, px) { return '<span style="width:' + px + 'px;height:' + px + 'px;border-radius:50%;flex:none;display:inline-block;background:linear-gradient(135deg,' + T.g1 + ',' + T.g2 + ');border:1px solid rgba(0,0,0,.18);"></span>'; }

async function loadThankYouCardAdmin() {
  var body = document.getElementById("tyc_body"); if (!body) return;
  try {
    var res = await getData("getThankYouCardSettings");
    if (!res || res.status !== "success") throw new Error((res && res.message) || "Could not load the card settings.");
    _tyc.data = res; _tyc.sel = Object.assign({}, res.current);
    if (!_tyc.qr && res.details.mapLink && typeof _generateQRDataUrl === "function") { try { _tyc.qr = await _generateQRDataUrl(res.details.mapLink, 200); } catch (e) {} }
    tycRender();
    var sw = document.getElementById("toggle_thankyou_card");
    if (sw && !sw._tycBound) { sw._tycBound = true; sw.addEventListener("change", function () { setTimeout(tycRenderStatus, 500); }); }
  } catch (e) {
    body.innerHTML = '<p style="color:#b91c1c;font-size:13px;">' + _tycE(e.message || "Could not load.") + "</p>";
  }
}

function tycRender() {
  var d = _tyc.data;
  document.getElementById("tyc_body").innerHTML =
    '<div id="tyc_status" style="margin-bottom:16px;"></div>' +
    '<div id="tyc_grid"><div id="tyc_ctl"></div>' +
    '<div><div id="tyc_prev_head" style="margin-bottom:8px;"></div>' +
    '<div id="tyc_prev_wrap" style="position:relative;width:100%;max-width:400px;aspect-ratio:794/1000;overflow:hidden;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.18);background:#eee;"><div id="tyc_prev" style="position:absolute;top:0;left:0;width:794px;height:1000px;transform-origin:top left;"></div></div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-top:8px;max-width:400px;">Preview of the card layout. Real cards use the same colours, text and events; names and the QR come from each receipt.</div></div></div>';
  if (!_tyc.rz) { _tyc.rz = true; window.addEventListener("resize", tycScale); }
  tycRenderStatus(); tycRenderControls(); tycRenderPreview();
}

/* ── RUNNING NOW banner ─────────────────────────────── */
function tycRenderStatus() {
  var el = document.getElementById("tyc_status"); if (!el || !_tyc.data) return;
  var d = _tyc.data, cur = d.current, T = _tycTheme(cur.theme);
  var sw = document.getElementById("toggle_thankyou_card"), on = !!(sw && sw.checked);
  var hidden = _TYC_SECS.filter(function (s) { return cur[s[0]] === false; }).map(function (s) { return s[1]; });
  var changed = !_tycSame(_tyc.sel, cur);
  var meta = d.isDefault ? "Using the default look from the code (nothing saved from this page yet)"
    : "Saved by " + _tycE(d.updatedBy || "Admin") + (d.updatedAt ? " on " + _tycE(d.updatedAt) : "");
  el.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border:1.5px solid #bbf7d0;background:#f0fdf4;border-radius:10px;">' +
    '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:#166534;">RUNNING NOW</span>' +
    '<span style="display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:20px;background:#fff;border:1.5px solid #bbf7d0;font-size:13px;font-weight:600;color:#1e293b;">' + _tycDot(T, 16) + _tycE(T.name) + "</span>" +
    '<span style="font-size:12.5px;color:#334155;">' + _tycE(_tycName(_TYC_BORDERS, cur.border)) + " · Amount " + _tycE(_tycName(_TYC_AMOUNTS, cur.amount)).toLowerCase() + (hidden.length ? " · Hidden: " + _tycE(hidden.join(", ")) : "") + "</span>" +
    '<span style="margin-left:auto;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:12px;' + (on ? "background:#dcfce7;color:#166534;" : "background:#f1f5f9;color:#64748b;") + '">' + (on ? "Card switch is ON" : "Card switch is OFF (turn it on above)") + "</span>" +
    '<div style="flex-basis:100%;font-size:11.5px;color:#64748b;">' + meta + ". New cards use this look. Emails already sent do not change.</div></div>" +
    (changed ? '<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:#fffbeb;border:1.5px solid #fde68a;color:#92400e;font-size:12.5px;">You are previewing a different look. It is <b>not saved</b> yet. Press <b>Save look</b> to start using it.</div>' : "");
}

/* ── controls ───────────────────────────────────────── */
function _tycChip(label, picked, inUse, onclick, dotTheme, title) {
  return '<button type="button" onclick="' + onclick + '"' + (title ? ' title="' + _tycE(title) + '"' : "") +
    ' style="display:inline-flex;align-items:center;gap:7px;padding:7px 12px;margin:0 6px 8px 0;border-radius:10px;cursor:pointer;font-size:12.5px;font-family:inherit;box-shadow:none;' +
    (picked ? "border:2px solid #C1440E;background:#FDF0E6;color:#7A1F1F;font-weight:600;" : "border:1.5px solid #e2e8f0;background:#fff;color:#334155;") + '">' +
    (dotTheme ? _tycDot(dotTheme, 14) : "") + _tycE(label) +
    (inUse ? '<span style="font-size:9.5px;font-weight:700;letter-spacing:.5px;background:#16a34a;color:#fff;border-radius:8px;padding:1px 6px;">IN USE</span>' : "") + "</button>";
}
function tycRenderControls() {
  var el = document.getElementById("tyc_ctl"); if (!el) return;
  var d = _tyc.data, sel = _tyc.sel, cur = d.current, changed = !_tycSame(sel, cur);
  var themes = d.themes.map(function (t) { return _tycChip(t.name, sel.theme === t.key, cur.theme === t.key, "tycPick('theme','" + t.key + "')", t, t.note); }).join("");
  var borders = _TYC_BORDERS.map(function (b) { return _tycChip(b[1], sel.border === b[0], cur.border === b[0], "tycPick('border','" + b[0] + "')"); }).join("");
  var amounts = _TYC_AMOUNTS.map(function (a) { return _tycChip(a[1], sel.amount === a[0], cur.amount === a[0], "tycPick('amount','" + a[0] + "')"); }).join("");
  var secs = _TYC_SECS.map(function (s) {
    return '<label style="display:inline-flex;align-items:center;gap:6px;margin:0 14px 6px 0;font-size:12.5px;color:#334155;cursor:pointer;"><input type="checkbox" ' + (sel[s[0]] ? "checked " : "") + 'onchange="tycPick(\'' + s[0] + '\',this.checked)" style="accent-color:#C1440E;width:16px;height:16px;">' + _tycE(s[1]) + "</label>";
  }).join("");
  var amtWarn = sel.amount === "on" ? "Every card will show the contribution amount. Anyone who sees a shared status will see it."
    : sel.amount === "both" ? "Two images are attached to the email, one without and one with the amount, and each member picks which to post. This takes about twice as long to make." : "";
  var lbl = 'font-size:12px;font-weight:700;color:#475569;margin:0 0 6px;';
  el.innerHTML =
    '<div style="' + lbl + '">Theme <span style="font-weight:400;color:#94a3b8;">(hover a theme to see when to use it)</span></div><div>' + themes + "</div>" +
    '<div style="font-size:11.5px;color:#64748b;margin:-2px 0 12px;"><b>' + _tycE(_tycTheme(sel.theme).name) + ":</b> " + _tycE(_tycTheme(sel.theme).note) + "</div>" +
    '<div style="' + lbl + '">Border</div><div>' + borders + "</div>" +
    '<div style="' + lbl + 'margin-top:6px;">Amount on card</div><div>' + amounts + "</div>" +
    (amtWarn ? '<div style="padding:8px 12px;border-radius:8px;background:#fffbeb;border:1.5px solid #fde68a;color:#92400e;font-size:12px;margin:0 0 10px;">' + _tycE(amtWarn) + "</div>" : "") +
    '<div style="' + lbl + 'margin-top:6px;">Show on the card</div><div>' + secs + "</div>" +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 4px;">' +
    '<button type="button" onclick="tycSave()" ' + (changed ? "" : "disabled ") + 'style="background:' + (changed ? "linear-gradient(135deg,#C1440E,#d35400)" : "#cbd5e1") + ';color:#fff;border:none;padding:9px 22px;border-radius:8px;font-weight:600;font-size:13.5px;cursor:' + (changed ? "pointer" : "not-allowed") + ';"><i class="fa-solid fa-check"></i>&nbsp; Save look</button>' +
    (changed ? '<button type="button" onclick="tycRevert()" style="background:#f0f0f0;color:#555;border:none;padding:9px 18px;border-radius:8px;font-weight:600;font-size:13.5px;cursor:pointer;box-shadow:none;">Back to running look</button>' : "") + "</div>" +
    '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9;">' +
    '<div style="' + lbl + '">Send a test card to an email</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><input id="tyc_test_to" type="email" placeholder="you@example.com" value="' + _tycE(_tycMyEmail()) + '" style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;">' +
    '<button id="tyc_test_btn" type="button" onclick="tycTest()" style="background:#1e293b;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;box-shadow:none;"><i class="fa-solid fa-paper-plane"></i>&nbsp; Send test card</button></div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-top:6px;">The test uses the look selected here, even if it is not saved. It takes up to about 15 seconds and counts as 1 email. Maximum 10 tests a day.</div>' +
    '<div id="tyc_test_msg" style="font-size:12.5px;margin-top:6px;"></div></div>';
}

function tycPick(k, v) { _tyc.sel[k] = v; tycRenderStatus(); tycRenderControls(); tycRenderPreview(); }
function tycRevert() { _tyc.sel = Object.assign({}, _tyc.data.current); tycRenderStatus(); tycRenderControls(); tycRenderPreview(); }
function tycView(v) { _tyc.view = v; tycRenderPreview(); }

/* ── live preview (same sizes as the real 794 x 1000 card, scaled to fit) ── */
function tycRenderPreview() {
  var d = _tyc.data, sel = _tyc.sel, cur = d.current, T = _tycTheme(sel.theme), det = d.details;
  var same = _tycSame(sel, cur);
  var head = document.getElementById("tyc_prev_head");
  var showAmt = sel.amount === "on" || (sel.amount === "both" && _tyc.view === "with");
  head.innerHTML = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;color:#334155;">' + _tycDot(T, 14) + "<b>" + _tycE(T.name) + "</b> · " + _tycE(_tycName(_TYC_BORDERS, sel.border)) +
    '<span style="font-size:10.5px;font-weight:700;letter-spacing:.5px;border-radius:8px;padding:2px 8px;' + (same ? "background:#dcfce7;color:#166534;" : "background:#fef3c7;color:#92400e;") + '">' + (same ? "RUNNING NOW" : "PREVIEW ONLY, NOT SAVED") + "</span></div>" +
    (sel.amount === "both" ? '<div style="margin-top:6px;font-size:12px;color:#64748b;">Image: ' +
      ["without", "with"].map(function (v) { return '<button type="button" onclick="tycView(\'' + v + '\')" style="margin-right:6px;padding:3px 10px;border-radius:8px;font-size:11.5px;cursor:pointer;box-shadow:none;font-family:inherit;' + (_tyc.view === v ? "border:2px solid #C1440E;background:#FDF0E6;color:#7A1F1F;" : "border:1.5px solid #e2e8f0;background:#fff;color:#475569;") + '">' + (v === "with" ? "With amount" : "Without amount") + "</button>"; }).join("") + "</div>" : "");

  var mid = _tycMix(T.g1, T.g2, 0.5), sub = _tycMix(T.fg, mid, 0.18);
  var lbg = T.lbg || _tycMix(mid, "#FFFFFF", 0.14), lbd = T.lbd || _tycMix(mid, "#FFFFFF", 0.38), gold2 = _tycMix(T.gold, mid, 0.25);
  var bordered = sel.border === "gold", ow = bordered ? 6 : 0, op = 16, ib = (sel.border === "gold" || sel.border === "line") ? 2 : 0, ip = 28;
  var first = "Ramesh" + (det.nameSuffix || ""), yr = String(new Date().getFullYear());
  var evs = (d.events || []).map(function (e) {
    return "<div style='font-size:25px;line-height:1.45;'><b>" + _tycE(e.title) + "</b> &middot; " + _tycE(String(e.dateText || "").replace(" " + yr, "")) + (e.note ? " &middot; " + _tycE(e.note) : "") + "</div>";
  }).join("");
  var row = function (inner) { return "<div style='padding:6px 0;'>" + inner + "</div>"; };
  var small = function (label, val) { return row("<span style='font-size:19px;font-weight:bold;letter-spacing:3px;color:" + sub + ";'>" + _tycE(label) + "</span> &nbsp; <span style='font-size:24px;color:" + T.fg + ";'>" + _tycE(val) + "</span>"); };
  var parts = [];
  parts.push(row("<div style='font-size:22px;letter-spacing:6px;font-weight:bold;color:" + T.fg + ";'>" + _tycE(String(det.name || "").toUpperCase()) + "</div><div style='font-size:24px;color:" + sub + ";margin-top:4px;'>" + _tycE(det.tagline) + "</div>"));
  parts.push(row("<div style='font-size:24px;color:" + sub + ";'>Thank you</div><div style='font-size:60px;font-weight:bold;line-height:1.15;color:" + T.fg + ";'>" + _tycE(first) + "</div><div style='font-size:24px;color:" + sub + ";'>for your seva &middot; November " + yr + "</div>" +
    (showAmt ? "<div style='margin-top:12px;'><span style='display:inline-block;border:3px solid " + T.gold + ";border-radius:40px;padding:4px 30px;font-size:34px;font-weight:bold;color:" + T.gold + ";'>Rs. 501</span></div>" : "") +
    (det.blessing ? "<div style='font-size:24px;font-style:italic;color:" + T.fg + ";margin-top:12px;'>" + _tycE(det.blessing) + "</div>" : "")));
  if (sel.showEvents && ((d.events || []).length || det.joinLine)) {
    parts.push(row("<div style='background:" + T.jbg + ";border-radius:22px;padding:16px 26px;text-align:left;color:" + T.jfg + ";'>" +
      (det.joinTitle ? "<div style='font-size:19px;font-weight:bold;letter-spacing:3px;color:" + T.jhd + ";margin-bottom:4px;'>" + _tycE(det.joinTitle) + "</div>" : "") + evs +
      (det.joinLine ? "<div style='font-size:21px;margin-top:4px;'>" + _tycE(det.joinLine) + "</div>" : "") + "</div>"));
  }
  if (sel.showLocation) {
    var qr = _tyc.qr ? "<img src='" + _tyc.qr + "' width='128' height='128' style='display:block;'>" : "<div style='width:128px;height:128px;background:#eee;color:#666;font-size:22px;line-height:128px;'>QR</div>";
    parts.push(row("<div style='display:flex;align-items:center;gap:20px;background:" + lbg + ";border:2px solid " + lbd + ";border-radius:22px;padding:16px 26px;text-align:left;'>" +
      "<div style='flex:1;color:" + T.fg + ";'><div style='font-size:19px;font-weight:bold;letter-spacing:3px;color:" + sub + ";'>FIND US</div><div style='font-size:28px;font-weight:bold;'>" + _tycE(det.name) + "</div><div style='font-size:23px;line-height:1.35;'>" + _tycE(det.address) + "</div></div>" +
      (det.mapLink ? "<div style='text-align:center;'><div style='background:#fff;padding:6px;border-radius:8px;display:inline-block;'>" + qr + "</div><div style='font-size:17px;color:" + sub + ";margin-top:4px;'>Scan for map</div></div>" : "") + "</div>"));
  }
  if (sel.showAarti && det.aarti) parts.push(small("AARTI", det.aarti));
  if (sel.showContact && det.contact) parts.push(small(det.contactLabel || "CONTACT", det.contact));
  if (det.footer) parts.push(row("<span style='font-size:17px;color:" + sub + ";'>" + _tycE(det.footer) + "</span>"));

  var innerH = 1000 - 2 * ow - 2 * op;
  document.getElementById("tyc_prev").innerHTML =
    "<div style=\"width:794px;height:1000px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background-color:" + mid + ";background-image:linear-gradient(170deg," + T.g1 + "," + T.g2 + ");border-radius:28px;" + (bordered ? "border:" + ow + "px solid " + T.gold + ";" : "") + "padding:" + op + "px;text-align:center;\">" +
    "<div style=\"height:" + innerH + "px;box-sizing:border-box;" + (ib ? "border:" + ib + "px solid " + gold2 + ";" : "") + "border-radius:20px;padding:" + ip + "px 30px;display:flex;flex-direction:column;justify-content:space-between;\">" + parts.join("") + "</div></div>";
  tycScale();
}
function tycScale() {
  var w = document.getElementById("tyc_prev_wrap"), p = document.getElementById("tyc_prev"); if (!w || !p) return;
  var s = w.clientWidth / 794; if (s > 0) p.style.transform = "scale(" + s + ")";
}

/* ── save + test ────────────────────────────────────── */
function tycSave() {
  if (_tyc.busy || _tycSame(_tyc.sel, _tyc.data.current)) return;
  if (typeof checkSession === "function" && !checkSession()) return;
  var s = _tyc.sel, hidden = _TYC_SECS.filter(function (x) { return !s[x[0]]; }).map(function (x) { return x[1]; });
  var rows = [["Theme", _tycE(_tycTheme(s.theme).name)], ["Border", _tycE(_tycName(_TYC_BORDERS, s.border))], ["Amount", _tycE(_tycName(_TYC_AMOUNTS, s.amount))]];
  if (hidden.length) rows.push(["Hidden", _tycE(hidden.join(", "))]);
  var run = async function () {
    _tyc.busy = true;
    try {
      var res = await postData({ action: "saveThankYouCardSettings", Theme: s.theme, Border: s.border, Amount: s.amount,
        ShowEvents: s.showEvents ? "1" : "0", ShowLocation: s.showLocation ? "1" : "0", ShowAarti: s.showAarti ? "1" : "0", ShowContact: s.showContact ? "1" : "0", AdminName: _tycAdmin() });
      if (res && res.status === "success") { toast("Card look saved. New cards will use it.", "success"); await loadThankYouCardAdmin(); }
      else if (res && res.errorCode !== "forbidden") toast((res && res.message) || "Could not save.", "error");
    } catch (e) { toast(e.message || "Could not save.", "error"); }
    _tyc.busy = false;
  };
  if (typeof confirmModal === "function") confirmModal("Use this card look?", run, "Save look", "#22c55e", rows); else run();
}
async function tycTest() {
  if (_tyc.busy) return;
  if (typeof checkSession === "function" && !checkSession()) return;
  var to = (document.getElementById("tyc_test_to").value || "").trim(), msg = document.getElementById("tyc_test_msg"), btn = document.getElementById("tyc_test_btn");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { msg.style.color = "#b91c1c"; msg.textContent = "Please enter a valid email address."; return; }
  var s = _tyc.sel;
  _tyc.busy = true; btn.disabled = true; btn.style.opacity = ".6";
  msg.style.color = "#64748b"; msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Making the card and sending... please wait up to about 15 seconds.';
  try {
    var res = await postData({ action: "sendThankYouCardTest", ToEmail: to, Theme: s.theme, Border: s.border, Amount: s.amount,
      ShowEvents: s.showEvents ? "1" : "0", ShowLocation: s.showLocation ? "1" : "0", ShowAarti: s.showAarti ? "1" : "0", ShowContact: s.showContact ? "1" : "0", AdminName: _tycAdmin() });
    if (res && res.status === "success") { msg.style.color = "#166534"; msg.textContent = "Test card sent to " + to + " (took " + (res.seconds || "a few") + " s). Check the inbox, and Spam if it is not there."; }
    else { msg.style.color = "#b91c1c"; msg.textContent = (res && res.message) || "Could not send the test card."; }
  } catch (e) { msg.style.color = "#b91c1c"; msg.textContent = e.message || "Could not send the test card."; }
  _tyc.busy = false; btn.disabled = false; btn.style.opacity = "1";
}
