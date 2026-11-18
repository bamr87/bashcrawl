// ESLint flat config for the React web trainer (web/src, plus the feedback
// kit's React adapter in components/ that it mounts) and the Vite config.
// The engine (web/assets/js, termforge/) is classic/CJS JavaScript covered by
// `make lint-js` (node --check) and the node test suite, not by ESLint; so is
// the vendored feedback widget in public/.
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
        "public/**",
        "termforge/**",
        ".venv/**",
    ]),
    {
        files: ["web/src/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "vite.config.mts"],
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
    {
        // components/FeedbackButton.tsx is the feedback kit's adapter, vendored
        // from bamr87/bamr87 templates/feedback and never edited here. Two of
        // its shapes are the kit's design: the JSX augmentation is a namespace
        // inside `declare module "react"` (the form React 19's types accept),
        // and openFeedback() and breadcrumb() are exported beside the component
        // as its API. Allow exactly those; every other rule still applies.
        files: ["components/**/*.{ts,tsx}"],
        rules: {
            "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
            "react-refresh/only-export-components": ["error", { allowExportNames: ["openFeedback", "breadcrumb"] }],
        },
    },
]);
