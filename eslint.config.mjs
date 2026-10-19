// ESLint flat config for the React web trainer (web/src) and the Vite config.
// The engine (web/assets/js, termforge/) is classic/CJS JavaScript covered by
// `make lint-js` (node --check) and the node test suite, not by ESLint.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores([
        "**/*.js",
        "node_modules/**",
        "web/assets/**",
        "web/data/**",
        "web/dist/**",
        "web/public/**",
        "termforge/**",
        ".venv/**",
    ]),
    {
        files: ["web/src/**/*.{ts,tsx}", "vite.config.mts"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2023,
            globals: { ...globals.browser, ...globals.node },
        },
    },
]);
