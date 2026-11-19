import { useState, useEffect } from "react";
import { Users, ShieldCheck, LogOut, ArrowRight, Search, DollarSign, TrendingUp, LayoutGrid, Activity } from "lucide-react";
import { useRole, ROLES } from "../context/RoleContext.jsx";
import { collection, query, getDocs, doc, setDoc } from "firebase/firestore";
import { db, supabase } from "../backend.js";

export default function AdminPanel({ user, onSignOut, busy }) {
  const { isAdmin, setUserRole } = useRole();
  if (!isAdmin) return null;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [saving, setSaving] = useState(new Set());
  const [stats, setStats] = useState({ totalSeekers: 0, totalRecruiters: 0, totalAdmins: 0, totalJobs: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    getDocs(collection(db, "users")).then((snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [db]);

  useEffect(() => {
    if (!db || !supabase) return;
    setStatsLoading(true);
    Promise.all([
      getDocs(collection(db, "users")),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
    ]).then(([userSnap, jobRes]) => {
      const allUsers = userSnap.docs.map((d) => d.data());
      const totalSeekers = allUsers.filter((u) => u.RoleContext === "seeker").length;
      const totalRecruiters = allUsers.filter((u) => u.RoleContext === "recruiter").length;
      const totalAdmins = allUsers.filter((u) => u.RoleContext === "admin").length;
      setStats({
        totalSeekers,
        totalRecruiters,
        totalAdmins,
        totalJobs: jobRes.count || 0,
      });
      setStatsLoading(false);
    }).catch(() => setStatsLoading(false));
  }, [db, supabase]);

  const filtered = users.filter((u) => {
    const q = queryText.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.RoleContext || "").toLowerCase().includes(q)
    );
  });

  const handleRoleChange = async (uid, nextRole) => {
    setSaving((prev) => new Set([...prev, uid]));
    try {
      await setUserRole(uid, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, RoleContext: nextRole } : u)));
      setStats((prev) => ({
        ...prev,
        totalSeekers: prev.totalSeekers - (nextRole === "seeker" ? 0 : 1) + (nextRole === "seeker" ? 1 : 0),
        totalRecruiters: prev.totalRecruiters - (nextRole === "recruiter" ? 0 : 1) + (nextRole === "recruiter" ? 1 : 0),
        totalAdmins: prev.totalAdmins - (nextRole === "admin" ? 0 : 1) + (nextRole === "admin" ? 1 : 0),
      }));
    } catch (err) {
      alert(err.message || "Could not update role.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  const statTiles = [
    { label: "Total Job Seekers", value: stats.totalSeekers, icon: <Activity size={24} />, color: "#226fe8" },
    { label: "Total Recruiters", value: stats.totalRecruiters, icon: <DollarSign size={24} />, color: "#7161eb" },
    { label: "Total Job Posts Live", value: stats.totalJobs, icon: <LayoutGrid size={24} />, color: "#059669" },
  ];

  return (
    <div className="recruiter-page admin-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMIN — ROLE-BASED ACCESS CONTROL</div>
          <h1>User & role management</h1>
          <p>Assign and manage roles (seeker, recruiter, admin) across the platform.</p>
        </div>
        <button className="button button-secondary" onClick={onSignOut} disabled={busy}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <div className="admin-toolbar">
        <div className="search-box"><Search size={18} /><input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Search users by email, name, or role…" aria-label="Search users" /></div>
      </div>

      <div className="stats-banner">
        {statTiles.map((tile) => (
          <div key={tile.label} className="stat-tile">
            <div className="stat-value">{tile.value}</div>
            <div className="stat-label">{tile.label}</div>
            <div className="stat-icon" style={{ color: tile.color }}>{tile.icon}</div>
          </div>
        ))}
      </div>

      <div className="recruiter-card">
        {loading ? (
          <div className="jobs-loading"><div className="loading-spinner" /> Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Users size={25} /></div>
            <h2>No users found</h2>
            <p>Try a different search.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="avatar admin-avatar">{((u.displayName || u.email || "U")[0]).toUpperCase()}</div>
                        <div>{u.displayName || "Unnamed"}</div>
                      </div>
                    </td>
                    <td>{u.email || "—"}</td>
                    <td>
                      <span className={`role-badge role-${u.RoleContext}`}>{u.RoleContext ? u.RoleContext.charAt(0).toUpperCase() + u.RoleContext.slice(1) : "—"}</span>
                    </td>
                    <td>
                      <select
                        value={u.RoleContext || "seeker"}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={saving.has(u.id) || busy}
                        className="role-select"
                      >
                        {Object.values(ROLES).map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                      {u.id === user.uid && <span className="muted-copy" style={{ fontSize: 11, color: "#66748c", marginLeft: 8 }}>You</span>}
                      {saving.has(u.id) && <span style={{ fontSize: 11, color: "#7bcfff", marginLeft: 8 }}>Saving…</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
