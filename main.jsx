import React from "react";
import { createRoot } from "react-dom/client";
import HomePlot from "./HomePlot.jsx";

const reset = document.createElement("style");
reset.textContent = "html,body,#root{margin:0;padding:0;height:100%}";
document.head.appendChild(reset);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HomePlot />
  </React.StrictMode>
);
