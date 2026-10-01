import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/700.css";
import "bootstrap/dist/css/bootstrap.rtl.min.css";
import "./styles/tokens.css";
import "./styles.css";
import "./components/ui/ui.css";
import "./core/shell/shell.css";
import App from "./App";
import { ThemeProvider } from "./core/theme/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);