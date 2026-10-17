// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Keystone feedback language (.ks): one typed statement per line, `Type name(arguments);` (`//` starts a comment).
// An argument is a "string", a number, an Enum::Value, the name of an earlier statement, or a value `Type(arguments)`.
// The tables below are the whole language. The presenter, the server, tools/transcribe.py and Claude all write
// feedback.ks files; every one of them must pass parse() with no error.
//   node tools/ks.mjs <file.ks> …     check files: prints `file:line: message` and exits with 1 when one is wrong
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const ENUMS = {
  Kind: ["Tap", "Line", "Loop", "Scribble", "Free"],   // a hint about a stroke's shape; its points stay the truth
  Color: ["Red"],
  State: ["Todo", "Doing", "Done", "Ask", "Stopped"],   // Ask: Claude needs an answer before doing it; Stopped: the user interrupted Claude
};

// Statements. Arguments in order; "X..." = any number of X at the end; Name = any earlier statement.
// Times are ms since the recording started; positions are slide px (1280×720).
export const STATEMENTS = {
  Session: ["String"],                              // its folder name, YYYYMMDD-HHMMSS
  Enter: ["Time", "String"],                        // this slide (id) is shown from this time
  Stroke: ["Kind", "Color", "Span", "Point..."],
  Target: ["Stroke", "String", "String"],           // a slide element under the stroke: tag#id.class, start of its text
  Undo: ["Time", "Stroke"],                         // the user took this stroke back (Cmd+Z)
  Say: ["Span", "Word..."],                         // words said with no pause
  Note: ["String"],                                 // a message typed by the user for this slide (the editor's "Message to Claude")
  Task: ["State", "String", "String", "Name..."],   // by Claude: slide id, what to do, the strokes and phrases it comes from
  Reply: ["Task", "String"],                        // by the user, on the task's pin: more about it (the task goes back to Todo)
  Close: ["Task"],                                  // by the user: pin removed; a task not done yet is dropped
  About: ["String", "String"],                      // this session is a follow-up on a task: its session, its name
};
export const VALUES = {
  Span: ["Number", "Number"],   // start, end
  Time: ["Number"],
  Point: ["Number", "Number"],  // x, y
  Word: ["Number", "String"],   // start, text
};

function parseStatement(line) {
  let i = 0;
  const fail = what => { throw new Error(`${what} at column ${i + 1}`); };
  const ws = () => { while (line[i] === " " || line[i] === "\t") i++; };
  const take = re => { ws(); re.lastIndex = i; const m = re.exec(line); if (m) i = re.lastIndex; return m?.[0]; };
  const expect = ch => { ws(); if (line[i] !== ch) fail(`expected "${ch}"`); i++; };
  const ident = () => take(/[A-Za-z_]\w*/y);
  function args() {
    expect("("); ws();
    const out = [];
    if (line[i] === ")") { i++; return out; }
    for (;;) { out.push(arg()); ws(); if (line[i] !== ",") break; i++; }
    expect(")");
    return out;
  }
  function arg() {
    const s = take(/"(?:[^"\\]|\\.)*"/y); if (s) return { string: JSON.parse(s) };
    const n = take(/-?\d+(?:\.\d+)?/y); if (n) return { number: Number(n) };
    const id = ident() || fail("expected a value");
    if (line.startsWith("::", i)) { i += 2; return { enum: id, value: ident() || fail("expected an enum value") }; }
    ws();
    return line[i] === "(" ? { type: id, args: args() } : { name: id };
  }
  const type = ident() || fail("expected a type"), name = ident() || fail("expected a name");
  const a = args();
  expect(";"); ws();
  if (i < line.length && !line.startsWith("//", i)) fail("unexpected text after ;");
  return { type, name, args: a };
}

function check(sig, args, names, where) {
  const rest = sig.at(-1)?.endsWith("...") ? sig.at(-1).slice(0, -3) : null, fixed = rest ? sig.slice(0, -1) : sig;
  if (args.length < fixed.length || (!rest && args.length > fixed.length))
    throw new Error(`${where}(${sig.join(", ")}) got ${args.length} argument${args.length === 1 ? "" : "s"}`);
  args.forEach((a, k) => {
    const want = fixed[k] || rest;
    const ok = want === "String" ? "string" in a : want === "Number" ? "number" in a
      : ENUMS[want] ? a.enum === want && ENUMS[want].includes(a.value)
      : VALUES[want] ? a.type === want && (check(VALUES[want], a.args, names, want), true)
      : want === "Name" ? names.has(a.name) : names.get(a.name) === want;
    if (!ok) throw new Error(`${where}: argument ${k + 1} must be ${ENUMS[want] ? `${want}::${ENUMS[want].join("|")}` : want}`);
  });
}

// An argument as a plain value: string, number, enum value, statement name, or the array of a value's arguments
const plain = a => "string" in a ? a.string : "number" in a ? a.number : a.enum ? a.value : a.type ? a.args.map(plain) : a.name;

// → { statements: [{ type, name, v: plain arguments, line }], errors: [{ line, message }] }
export function parse(text) {
  const statements = [], errors = [], names = new Map();
  text.split("\n").forEach((raw, k) => {
    if (!raw.trim() || raw.trim().startsWith("//")) return;
    try {
      const s = parseStatement(raw);
      if (!STATEMENTS[s.type]) throw new Error(`unknown statement ${s.type}`);
      if (names.has(s.name)) throw new Error(`${s.name} is already declared`);
      check(STATEMENTS[s.type], s.args, names, s.type);
      names.set(s.name, s.type);
      statements.push({ type: s.type, name: s.name, v: s.args.map(plain), line: k + 1 });
    } catch (e) { errors.push({ line: k + 1, message: e.message }); }
  });
  return { statements, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0;
  for (const file of process.argv.slice(2)) {
    const { statements, errors } = parse(fs.readFileSync(file, "utf8"));
    for (const e of errors) console.log(`${file}:${e.line}: ${e.message}`);
    if (!errors.length) console.log(`${file}: ok, ${statements.length} statements`);
    bad += errors.length;
  }
  process.exit(bad ? 1 : 0);
}
