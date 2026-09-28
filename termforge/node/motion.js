"use strict";
// Generic stage presentation: app-provided frames, no game catalog imports.
function presentStage(screen, plan, index = 0) {
    const frames = plan && plan.stage && plan.frames;
    const frame = frames && frames.length ? frames[Math.max(0, Math.min(frames.length - 1, index))] : null;
    screen.setStage(frame);
    return frame;
}
module.exports = { presentStage };
