"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Atomic local saves; no shared account or persistence is implied for TCP.
function fileStore(file) {
    return {
        description: `Progress is saved to ${file}.`,
        load() {
            try { return JSON.parse(fs.readFileSync(file, "utf8")); }
            catch (err) {
                if (err.code === "ENOENT") return null;
                throw new Error(`Could not load ${file}: ${err.message}`);
            }
        },
        save(state) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const temporary = `${file}.${process.pid}.tmp`;
            try {
                fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
                fs.renameSync(temporary, file);
            } finally {
                if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
            }
            return true;
        },
    };
}
module.exports = { fileStore };
