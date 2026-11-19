import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../backend.js";

const RoleContext = createContext(null);

export const ROLES = {
  SEEKER: "seeker",
  RECRUITER: "recruiter",
  ADMIN: "admin",
};

export function RoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleData, setRoleData] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setReady(true);
      return undefined;
    }
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setRole(null);
        setRoleData(null);
        setReady(true);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        const userRole = data.role || ROLES.SEEKER;
        setRole(userRole);
        setRoleData(data);
      } catch {
        setRole(ROLES.SEEKER);
        setRoleData({});
      } finally {
        setReady(true);
      }
    });
  }, []);

  const setUserRole = async (uid, nextRole) => {
    await setDoc(
      doc(db, "users", uid),
      { role: nextRole, roleUpdatedAt: new Date().toISOString() },
      { merge: true },
    );
    setRole(nextRole);
    if (roleData) setRoleData({ ...roleData, role: nextRole });
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setUser(null);
    setRole(null);
    setRoleData(null);
  };

  const isRecruiter = role === ROLES.RECRUITER || role === ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;

  return (
    <RoleContext.Provider
      value={{
        user,
        role,
        roleData,
        ready,
        isRecruiter,
        isAdmin,
        setUserRole,
        signOut,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
};

export default RoleContext;
