import React from "react";
import { createRoot } from "react-dom/client";
import { RoleProvider } from "./context/RoleContext.jsx";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </React.StrictMode>,
);
