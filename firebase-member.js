/* Firebase (Firestore) data loader for the MEMBER and ADMIN dashboards.
   Members: only their own profile + contributions and the shared lists. Admins: all tables.
   If anything is not ready (not signed in to Firebase, offline, rules, etc.) it quietly
   falls back to the old Apps Script getAllData, so the dashboard always still works. */
(function () {
  var V = "10.12.2", B = "https://www.gstatic.com/firebasejs/" + V + "/", _p = null, _cache = null, _cacheAt = 0;
  var _imp = function (u) { return import(u); };

  function sdk() {
    if (_p) return _p;
    if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) return Promise.reject(new Error("no firebase config"));
    _p = Promise.all([_imp(B + "firebase-app.js"), _imp(B + "firebase-auth.js"), _imp(B + "firebase-firestore.js")]).then(function (m) {
      var app = m[0].initializeApp(FIREBASE_CONFIG);
      return { auth: m[1].getAuth(app), db: m[2].getFirestore(app), A: m[1], F: m[2] };
    });
    _p.catch(function () { _p = null; });
    return _p;
  }

  // Wait for Firebase to restore the saved login (usually a fraction of a second)
  function who(s, ms) {
    return new Promise(function (res) {
      var off = function () {};
      var t = setTimeout(function () { off(); res(s.auth.currentUser || null); }, ms);
      off = s.A.onAuthStateChanged(s.auth, function (u) { clearTimeout(t); off(); res(u); });
    });
  }

  var byNum = function (a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); };
  var bySort = function (k) { return function (x, y) { return (Number(x.SortOrder) || 0) - (Number(y.SortOrder) || 0) || byNum(x[k], y[k]); }; };

  window.fbLoadMemberData = async function (userId, force) {
    userId = String(userId);
    if (!force && _cache && _cache.uid === userId && Date.now() - _cacheAt < 300000) return _cache.data;
    var t0 = Date.now();
    var s = await sdk(), u = await who(s, 7000);
    if (!u || u.uid !== userId) throw new Error("not signed in to Firebase");
    var F = s.F, db = s.db, col = function (c) { return F.collection(db, c); };
    var r = await Promise.all([
      F.getDoc(F.doc(db, "users", userId)),
      F.getDocs(F.query(col("contributions"), F.where("UserId", "==", userId))),
      F.getDocs(col("types")), F.getDocs(col("occasions")), F.getDocs(col("goals"))
    ]);
    var list = function (q) { return q.docs.map(function (d) { return d.data(); }); };
    if (!r[0].exists()) throw new Error("profile not found in Firestore");
    var data = {
      users: [r[0].data()],
      types: list(r[2]).sort(bySort("TypeId")),
      occasions: list(r[3]).sort(bySort("OccasionId")),
      contributions: list(r[1]).sort(function (x, y) { return byNum(x.Id, y.Id); }),
      goals: list(r[4]).sort(function (x, y) { return byNum(x.GoalId, y.GoalId); }),
      expenses: [], expenseTypes: [], yearConfig: []
    };
    _cache = { uid: userId, data: data }; _cacheAt = Date.now();
    try { console.info("[firebase] dashboard data loaded from Firestore in " + (Date.now() - t0) + " ms"); } catch (e) {}
    return data;
  };


  // ── Admin: the whole getAllData shape, read from Firestore (admins only; rules enforce it) ──
  var _acache = null, _acacheAt = 0;
  window.fbLoadAdminData = async function (userId, force) {
    userId = String(userId);
    if (!force && _acache && _acache.uid === userId && Date.now() - _acacheAt < 300000) return _acache.data;
    var t0 = Date.now();
    var s = await sdk(), u = await who(s, 7000);
    if (!u || u.uid !== userId) throw new Error("not signed in to Firebase");
    var F = s.F, db = s.db, all = function (c) { return F.getDocs(F.collection(db, c)); };
    var r = await Promise.all([all("users"), all("contributions"), all("types"), all("occasions"), all("expenses"), all("expenseTypes"), all("goals"), all("yearConfig")]);
    var list = function (q) { return q.docs.map(function (d) { return d.data(); }); };
    var users = list(r[0]).sort(function (x, y) { return byNum(x.UserId, y.UserId); });
    if (!users.some(function (x) { return String(x.UserId) === userId; })) throw new Error("admin profile not found in Firestore");
    users.forEach(function (x) { if (String(x.UserId) !== userId) x.IsDefaultPwd = false; });   // same as the old getAllData: flag only for the requester
    var byName = function (x, y) { return (Number(x.SortOrder) || 0) - (Number(y.SortOrder) || 0) || byNum(x.Name || x.ExpenseTypeId || "", y.Name || y.ExpenseTypeId || ""); };
    var data = {
      users: users,
      types: list(r[2]).sort(bySort("TypeId")),
      occasions: list(r[3]).sort(bySort("OccasionId")),
      contributions: list(r[1]).sort(function (x, y) { return byNum(x.Id, y.Id); }),
      expenses: list(r[4]).sort(function (x, y) { return byNum(x.Id, y.Id); }),
      expenseTypes: list(r[5]).sort(byName),
      goals: list(r[6]).sort(function (x, y) { return byNum(x.GoalId, y.GoalId); }),
      yearConfig: list(r[7]).sort(function (x, y) { return Number(x.Year) - Number(y.Year); })
    };
    _acache = { uid: userId, data: data }; _acacheAt = Date.now();
    try { console.info("[firebase] admin data loaded from Firestore in " + (Date.now() - t0) + " ms (" + (users.length + data.contributions.length + data.expenses.length) + " main records)"); } catch (e) {}
    return data;
  };

  // Used by user.js instead of getCached("getAllData")
  window.mandirLoadAllData = async function (force) {
    try {
      var s = JSON.parse(localStorage.getItem("session") || "null");
      var stale = Number(localStorage.getItem("fb_stale_until") || 0) > Date.now();   // member just changed something: use the live sheet for 3 min
      var role = s ? String(s.role || "").toLowerCase() : "";
      if (s && s.userId && !stale) {
        if (role === "user") return await window.fbLoadMemberData(s.userId, force);
        if (role === "admin") return await window.fbLoadAdminData(s.userId, force);
      }
    } catch (e) { try { console.warn("[firebase] using Apps Script instead:", e && e.message); } catch (x) {} }
    return getCached("getAllData");
  };

  window.fbSignOut = function () { return sdk().then(function (s) { return s.A.signOut(s.auth); }).catch(function () {}); };
})();