/* ════════════════════════════════════════════════════════════════
   admin-receipt-resend.js
   ONE-CLICK "EMAIL RECEIPT AGAIN" button on the Contribution list

   The receipt window already had an Email button (app.js →
   sendReceiptEmailDirect → backend action sendContribReceiptEmail).
   This only adds a direct ✉ button on each list row that asks first,
   then calls that SAME function — so quota checks, the double-send
   guard, the "no email on record" / "quota reached" messages and the
   quota counter refresh are all unchanged. Email only (no WhatsApp).
   Counter (walk-in) donations have no member record/email, so they
   get no button.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  window.resendReceiptEmail = function (rid) {
    var d = window._rcptStore && window._rcptStore[rid];
    if (!d || !d.c) { toast("Receipt data not found.", "error"); return; }
    var c = d.c;
    if (String(c.UserId).indexOf("WALKIN_") === 0) {
      toast("Counter donations have no member email on record.", "warn");
      return;
    }
    var u = (typeof users !== "undefined" ? users : []).find(function (x) { return String(x.UserId) === String(c.UserId); });
    var email = u ? String(u.Email || "").trim() : "";
    if (!email) { toast("⚠️ No email address on record for " + (d.userName || "this member") + ".", "warn"); return; }
    var rcp = (c.ReceiptID || "").replace(new RegExp("^" + ((window.APP && APP.legacyReceiptPrefix) || "TRX") + "-"), ((window.APP && APP.receiptPrefix) || "REC") + "-");
    confirmModal(
      "Email receipt <b>" + escapeHtml(rcp || "") + "</b> to <b>" + escapeHtml(d.userName || "member") + "</b>?" +
      '<br><span style="font-size:13px;font-weight:500;color:#64748b;">' + escapeHtml(email) + "</span>" +
      '<br><span style="font-size:12px;font-weight:500;color:#94a3b8;">Uses 1 of today\'s email quota.</span>',
      function () { sendReceiptEmailDirect(rid); },
      "Send Email",
      "#C1440E"
    );
  };
})();
