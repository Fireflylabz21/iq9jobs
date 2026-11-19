import React from "react";
import { createRoot } from "react-dom/client";
import { RoleProvider } from "./context/RoleContext.jsx";
import App from "./App.jsx";
import "./styles.css";

import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RoleProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </RoleProvider>
  </React.StrictMode>,
);
