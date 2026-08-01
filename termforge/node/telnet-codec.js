"use strict";
// Minimal telnet protocol codec (RFC 854 subset) — socket-free and fully
// unit-testable. The host owns the socket; this module owns the bytes.
//
// Negotiated stance (see docs/termforge/telnet-host.md):
//   we offer  IAC WILL ECHO, IAC WILL SGA  (we echo, char-at-a-time)
//   we ask    IAC DO SGA, IAC DO NAWS      (suppress-GA both ways, window size)
//   we accept the matching DO/WILL silently, refuse everything else
//   (WONT x / DONT x), and never re-negotiate on refusals.

const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;
const IP = 244; // interrupt process (client ^C)

const OPT_ECHO = 1;
const OPT_SGA = 3;
const OPT_NAWS = 31;

/** The negotiation burst a server sends on connect. */
function opening() {
    return Buffer.from([
        IAC, WILL, OPT_ECHO,
        IAC, WILL, OPT_SGA,
        IAC, DO, OPT_SGA,
        IAC, DO, OPT_NAWS,
    ]);
}

/**
 * Create a decoder for one connection.
 * @param {object} handlers
 * @param {(text: string) => void} handlers.onData      decoded input text
 * @param {(w: number, h: number) => void} [handlers.onNaws]
 * @param {() => void} [handlers.onInterrupt]           client sent IAC IP
 * @returns {{feed: (buf: Buffer) => Buffer|null, opening: () => Buffer}}
 *   feed returns protocol replies to write back (or null when none)
 */
function createTelnetCodec(handlers) {
    const onData = handlers.onData || (() => {});
    const onNaws = handlers.onNaws || (() => {});
    const onInterrupt = handlers.onInterrupt || (() => {});

    // Decoder state survives chunk boundaries.
    let mode = "data";          // data | iac | opt | sb | sbIac
    let pendingCmd = 0;         // DO/DONT/WILL/WONT awaiting its option byte
    let sbBytes = [];           // current subnegotiation payload (incl. option)

    function feed(buf) {
        const replies = [];
        const data = [];
        for (const byte of buf) {
            if (mode === "data") {
                if (byte === IAC) mode = "iac";
                else data.push(byte);
            } else if (mode === "iac") {
                if (byte === IAC) { data.push(IAC); mode = "data"; }
                else if (byte === DO || byte === DONT || byte === WILL || byte === WONT) {
                    pendingCmd = byte;
                    mode = "opt";
                } else if (byte === SB) {
                    sbBytes = [];
                    mode = "sb";
                } else {
                    if (byte === IP) onInterrupt();
                    mode = "data"; // NOP/AYT/other two-byte commands: ignored
                }
            } else if (mode === "opt") {
                const opt = byte;
                if (pendingCmd === DO) {
                    // We already offered ECHO/SGA; anything else we won't do.
                    if (opt !== OPT_ECHO && opt !== OPT_SGA) replies.push(IAC, WONT, opt);
                } else if (pendingCmd === WILL) {
                    // We asked for SGA/NAWS; refuse other client offers.
                    if (opt !== OPT_SGA && opt !== OPT_NAWS) replies.push(IAC, DONT, opt);
                }
                // DONT/WONT: acknowledged silently, never re-requested.
                mode = "data";
            } else if (mode === "sb") {
                if (byte === IAC) mode = "sbIac";
                else sbBytes.push(byte);
            } else if (mode === "sbIac") {
                if (byte === SE) {
                    if (sbBytes[0] === OPT_NAWS && sbBytes.length >= 5) {
                        const w = sbBytes[1] * 256 + sbBytes[2];
                        const h = sbBytes[3] * 256 + sbBytes[4];
                        onNaws(w, h);
                    }
                    mode = "data"; // other subnegotiations: skipped wholesale
                } else if (byte === IAC) {
                    sbBytes.push(IAC); // escaped 0xFF inside SB
                    mode = "sb";
                } else {
                    sbBytes.push(byte);
                    mode = "sb";
                }
            }
        }
        if (data.length) onData(Buffer.from(data).toString("utf8"));
        return replies.length ? Buffer.from(replies) : null;
    }

    return { feed, opening };
}

module.exports = {
    createTelnetCodec,
    opening,
    IAC, DONT, DO, WONT, WILL, SB, SE, IP,
    OPT_ECHO, OPT_SGA, OPT_NAWS,
};
