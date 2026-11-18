/* ═══ UPCOMING EVENT TAG — admin page ═══
   Add / edit / show-hide / delete the events printed on receipts and summaries.
   Backend: saveUpcomingEvent, toggleUpcomingEvent, setUpcomingMaster (Admin+), deleteUpcomingEvent (Super Admin). */
var _uevAdmin = { events: [], master: true, busy: false };

function _uevLevel() { try { return typeof window._myAccessLevel === "function" ? window._myAccessLevel() : null; } catch (e) { return null; } }
function _uevCanEdit() { var l = _uevLevel(); return l === null || l !== "viewer"; }
function _uevCanDelete() { var l = _uevLevel(); return l === null || l === "super"; }
function _uevAdminName() { try { return (JSON.parse(localStorage.getItem("session") || "{}").name) || "Admin"; } catch (e) { return "Admin"; } }
function _uevTodayIso() { try { return new Date().toLocaleDateString("en-CA"); } catch (e) { return ""; } }
function _uevPretty(iso) {
  var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return "";
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + ", " + (+m[3]) + " " +
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1] + " " + m[1];
}

async function loadUpcomingEventAdmin() {
  var box = document.getElementById("uev_list"); if (!box) return;
  var dt = document.getElementById("uev_date"); if (dt) dt.min = _uevTodayIso();
  try {
    var res = await getData("getUpcomingEventsAdmin");
    if (!res || res.status !== "success") throw new Error((res && res.message) || "Could not load events.");
    _uevAdmin.events = res.events || [];
    _uevAdmin.master = res.master !== false;
    var cb = document.getElementById("uev_master"); if (cb) cb.checked = _uevAdmin.master;
    uevRenderList();
  } catch (e) {
    box.innerHTML = '<p style="color:#b91c1c;font-size:13px;">' + escapeHtml(e.message || "Could not load events.") + "</p>";
  }
}

function uevRenderList() {
  var box = document.getElementById("uev_list"); if (!box) return;
  var note = document.getElementById("uev_master_note");
  if (note) note.textContent = _uevAdmin.master ? "" : "Hidden everywhere right now";
  var list = _uevAdmin.events;
  if (!list.length) { box.innerHTML = '<p style="color:#aaa;font-size:13px;">No events yet. Add one above.</p>'; return; }
  var canEdit = _uevCanEdit(), canDel = _uevCanDelete();
  box.innerHTML = list.map(function (e) {
    var showing = e.enabled && !e.expired && _uevAdmin.master;
    var badge = e.expired ? ["Expired", "#f1f5f9", "#64748b"] : (showing ? ["Showing", "#dcfce7", "#166534"] : ["Hidden", "#fef3c7", "#92400e"]);
    var dim = showing ? "" : "opacity:.45;filter:grayscale(.6);";
    return '<div class="uev-row' + (showing ? "" : " uev-dim") + '" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px ' + (showing ? "solid #eee" : "dashed #ddd") + ';border-radius:10px;margin-bottom:8px;background:' + (showing ? "#fff" : "#f7f7f7") + ';">' +
      '<input type="checkbox" ' + (e.enabled ? "checked " : "") + (e.expired || !canEdit ? "disabled " : "") + 'onchange="uevToggle(\'' + escapeHtml(e.id) + '\',this)" aria-label="Show this event" title="' + (e.enabled ? "Showing - untick to hide" : "Hidden - tick to show") + '" style="width:18px;height:18px;accent-color:#C1440E;flex:none;">' +
      '<div style="flex:1;min-width:0;' + dim + '"><div style="font-size:14px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (showing ? "" : "text-decoration:line-through;text-decoration-color:#bbb;") + '">' + escapeHtml(e.title) + '</div>' +
      '<div style="font-size:12px;color:#888;">' + escapeHtml(e.dateText || e.date) + (e.note ? " &middot; " + escapeHtml(e.note) : "") + "</div></div>" +
      '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;background:' + badge[1] + ";color:" + badge[2] + ';flex:none;">' + badge[0] + "</span>" +
      (canEdit && !e.expired ? '<button type="button" onclick="uevEdit(\'' + escapeHtml(e.id) + '\')" title="Edit" style="background:#f0f0f0;color:#555;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;"><i class="fa-solid fa-pen"></i></button>' : "") +
      (canDel ? '<button type="button" onclick="uevDelete(\'' + escapeHtml(e.id) + '\')" title="Delete" style="background:#fee2e2;color:#b91c1c;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;box-shadow:none;"><i class="fa-solid fa-trash"></i></button>' : "") +
      "</div>";
  }).join("");
}

function uevChip(t) { var el = document.getElementById("uev_title"); if (el) { el.value = t; uevPreview(); el.focus(); } }

function uevPreview() {
  var t = (document.getElementById("uev_title").value || "").trim();
  var d = document.getElementById("uev_date").value;
  var n = (document.getElementById("uev_note").value || "").trim();
  var wrap = document.getElementById("uev_preview_wrap");
  if (!t) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  document.getElementById("uev_preview").innerHTML =
    '<div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#92400E;">UPCOMING EVENT</div>' +
    "<b>" + escapeHtml(t) + "</b>" + (d ? " &middot; " + escapeHtml(_uevPretty(d)) : "") + (n ? " &middot; " + escapeHtml(n) : "");
}

function uevCancel() {
  ["uev_id", "uev_title", "uev_date", "uev_note"].forEach(function (id) { document.getElementById(id).value = ""; });
  document.getElementById("uev_form_title").textContent = "Add an event";
  document.getElementById("uev_save_btn").innerHTML = '<i class="fa-solid fa-plus"></i>&nbsp; Add event';
  document.getElementById("uev_cancel_btn").style.display = "none";
  uevPreview();
}

function uevEdit(id) {
  var e = _uevAdmin.events.filter(function (x) { return x.id === id; })[0]; if (!e) return;
  document.getElementById("uev_id").value = e.id;
  document.getElementById("uev_title").value = e.title;
  document.getElementById("uev_date").value = e.date;
  document.getElementById("uev_note").value = e.note || "";
  document.getElementById("uev_form_title").textContent = "Edit event";
  document.getElementById("uev_save_btn").innerHTML = '<i class="fa-solid fa-check"></i>&nbsp; Save changes';
  document.getElementById("uev_cancel_btn").style.display = "inline-block";
  uevPreview();
  document.getElementById("uev_form_box").scrollIntoView({ behavior: "smooth", block: "center" });
}

function _uevRows(e) {
  var rows = [["Event", escapeHtml(e.title)]];
  if (e.dateText || e.date) rows.push(["Date", escapeHtml(e.dateText || _uevPretty(e.date) || e.date)]);
  if (e.note) rows.push(["Note", escapeHtml(e.note)]);
  return rows;
}
function _uevAsk(title, fn, label, color, rows) {
  if (typeof confirmModal === "function") confirmModal(title, fn, label, color, rows);
  else if (window.confirm(title)) fn();
}

function uevSave() {
  if (_uevAdmin.busy) return;
  if (typeof checkSession === "function" && !checkSession()) return;
  var id = document.getElementById("uev_id").value;
  var title = (document.getElementById("uev_title").value || "").trim();
  var date = document.getElementById("uev_date").value;
  var note = (document.getElementById("uev_note").value || "").trim();
  if (!title) { toast("Please enter the event name.", "error"); return; }
  if (!date) { toast("Please choose the event date.", "error"); return; }
  if (date < _uevTodayIso()) { toast("That date has already passed.", "error"); return; }
  var prev = id ? _uevAdmin.events.filter(function (x) { return x.id === id; })[0] : null;
  var rows = _uevRows({ title: title, date: date, dateText: _uevPretty(date), note: note });
  _uevAsk(id ? "Save these changes?" : "Add this event?", async function () {
    _uevAdmin.busy = true;
    try {
      var res = await postData({ action: "saveUpcomingEvent", EvId: id, Title: title, EventDate: date, Note: note, Enabled: prev && !prev.enabled ? "No" : "Yes", AdminName: _uevAdminName() });
      if (res && res.status === "success") {
        toast(id ? "Event updated." : "Event added. It now shows on receipts and summaries.", "success");
        if (window.UEV) UEV.clear();
        uevCancel();
        await loadUpcomingEventAdmin();
      } else if (res && res.errorCode !== "forbidden") toast((res && res.message) || "Could not save.", "error");
    } catch (e) { toast(e.message || "Could not save.", "error"); }
    _uevAdmin.busy = false;
  }, id ? "Save changes" : "Add event", id ? "#C1440E" : "#22c55e", rows);
}

function uevToggle(id, cb) {
  var want = cb.checked;
  cb.checked = !want;   // stays on the real state until the admin confirms
  var e = _uevAdmin.events.filter(function (x) { return x.id === id; })[0]; if (!e) return;
  _uevAsk(want ? "Show this event?" : "Hide this event?", async function () {
    try {
      var res = await postData({ action: "toggleUpcomingEvent", EvId: id, Enabled: want ? "Yes" : "No", AdminName: _uevAdminName() });
      if (res && res.status === "success") { toast(want ? "Event will be shown." : "Event hidden.", "success"); if (window.UEV) UEV.clear(); }
      else if (res && res.errorCode !== "forbidden") toast((res && res.message) || "Could not update.", "error");
    } catch (er) { toast(er.message || "Could not update.", "error"); }
    await loadUpcomingEventAdmin();
  }, want ? "Show event" : "Hide event", want ? "#22c55e" : "#C1440E", _uevRows(e));
}

function uevMaster(cb) {
  var on = cb.checked;
  cb.checked = !on;   // stays on the real state until the admin confirms
  _uevAsk(on ? "Show upcoming events again?" : "Hide upcoming events everywhere?", async function () {
    try {
      var res = await postData({ action: "setUpcomingMaster", On: on ? "Yes" : "No", AdminName: _uevAdminName() });
      if (res && res.status === "success") { toast(on ? "Upcoming events are visible again." : "Upcoming events hidden everywhere.", "success"); if (window.UEV) UEV.clear(); }
      else if (res && res.errorCode !== "forbidden") toast((res && res.message) || "Could not update.", "error");
    } catch (er) { toast(er.message || "Could not update.", "error"); }
    await loadUpcomingEventAdmin();
  }, on ? "Show events" : "Hide everywhere", on ? "#22c55e" : "#C1440E",
  [["Applies to", "Receipts, emails and summaries"], ["Your events", "Stay saved"]]);
}

function uevDelete(id) {
  var e = _uevAdmin.events.filter(function (x) { return x.id === id; })[0]; if (!e) return;
  _uevAsk("Delete this event?", async function () {
    try {
      var res = await postData({ action: "deleteUpcomingEvent", EvId: id, AdminName: _uevAdminName() });
      if (res && res.status === "success") { toast("Event deleted.", "success"); if (window.UEV) UEV.clear(); }
      else if (res && res.errorCode !== "forbidden") toast((res && res.message) || "Could not delete.", "error");
    } catch (er) { toast(er.message || "Could not delete.", "error"); }
    await loadUpcomingEventAdmin();
  }, "Delete", "#e74c3c", _uevRows(e));
}
