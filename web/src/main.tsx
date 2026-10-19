// Entry point of the React web trainer. The game engine is already on
// window by the time this module runs: index.html loads it as classic
// scripts ahead of this one, and module scripts execute after them.
import "./styles/app.css";
import "./styles/terminal.css";
import "./styles/hud.css";
import "./styles/fx.css";
import "./styles/learn.css";
import "./styles/arcade.css";
import "./styles/chrome.css";
import "./styles/game.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";

const root = document.getElementById("root");
if (root) {
    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
