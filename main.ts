// tiny-stack-vm: a tiny stack virtual machine and its driver.
// ISA: 1-byte opcodes. PUSH takes a 4-byte LE i32; JMP/JZ/JNZ/CALL take a
// 2-byte LE absolute address. 32-bit wrapping ints, a 256-value stack,
// 256 words of memory, and ten traps with their own exit codes.
// Driver: reads $MAKEFUN_INPUT_DIR (default /input): one instance per
// subdirectory holding program.bin (+ optional input.bin), or a single
// program.bin at the root. Writes $MAKEFUN_OUTPUT_DIR/<id>/output.bin,
// exit.txt and exit_code.txt per instance. Deterministic: no clock,
// random or network access.
import fs from "node:fs";
import path from "node:path";

const OP = {
  HALT: 0, NOP: 1, PUSH: 2, POP: 3, DUP: 4, SWAP: 5, ADD: 6, SUB: 7,
  MUL: 8, DIV: 9, MOD: 10, NEG: 11, NOT: 12, AND: 13, OR: 14, XOR: 15,
  SHL: 16, SHR: 17, EQ: 18, LT: 19, GT: 20, JMP: 21, JZ: 22, JNZ: 23,
  CALL: 24, RET: 25, LOAD: 26, STORE: 27, IN: 28, OUT: 29, INC: 30, DEC: 31,
};
const MAX_STACK = 256, MAX_CALL = 256, MEM = 256;
const MAX_STEPS = 1e6, MAX_OUT = 1e6;

function run(program, input) {
  const mem = new Int32Array(MEM);
  const st = [], cs = [], out = [];
  let pc = 0, steps = 0, ip = 0;
  const trap = (c) => { throw c; };
  const push = (v) => { if (st.length >= MAX_STACK) trap(2); st.push(v | 0); };
  const pop = () => { if (!st.length) trap(1); return st.pop(); };
  const bin = (f) => { const b = pop(), a = pop(); push(f(a, b)); };
  const imm32 = () => {
    if (pc + 5 > program.length) trap(4);
    const v = program.readInt32LE(pc + 1);
    pc += 5;
    return v;
  };
  const addr16 = () => {
    if (pc + 3 > program.length) trap(4);
    const a = program.readUInt16LE(pc + 1);
    pc += 3;
    return a;
  };
  const jump = (a) => { if (a >= program.length) trap(4); pc = a; };
  try {
    for (;;) {
      if (steps >= MAX_STEPS) trap(8);
      if (pc >= program.length) trap(4);
      const op = program[pc];
      steps++;
      switch (op) {
        case OP.HALT: return { code: 0, out: Buffer.from(out) };
        case OP.NOP: pc++; break;
        case OP.PUSH: push(imm32()); break;
        case OP.POP: pop(); pc++; break;
        case OP.DUP: push(st.length ? st[st.length - 1] : trap(1)); pc++; break;
        case OP.SWAP: {
          if (st.length < 2) trap(1);
          const t = st[st.length - 1];
          st[st.length - 1] = st[st.length - 2];
          st[st.length - 2] = t;
          pc++;
          break;
        }
        case OP.ADD: bin((a, b) => a + b); pc++; break;
        case OP.SUB: bin((a, b) => a - b); pc++; break;
        case OP.MUL: bin((a, b) => Math.imul(a, b)); pc++; break;
        case OP.DIV: bin((a, b) => { if (b === 0) trap(5); return Math.trunc(a / b); }); pc++; break;
        case OP.MOD: bin((a, b) => { if (b === 0) trap(5); return a % b; }); pc++; break;
        case OP.NEG: push(-pop()); pc++; break;
        case OP.NOT: push(~pop()); pc++; break;
        case OP.AND: bin((a, b) => a & b); pc++; break;
        case OP.OR: bin((a, b) => a | b); pc++; break;
        case OP.XOR: bin((a, b) => a ^ b); pc++; break;
        case OP.SHL: bin((a, b) => a << (b & 31)); pc++; break;
        case OP.SHR: bin((a, b) => a >>> (b & 31)); pc++; break;
        case OP.EQ: bin((a, b) => (a === b ? 1 : 0)); pc++; break;
        case OP.LT: bin((a, b) => (a < b ? 1 : 0)); pc++; break;
        case OP.GT: bin((a, b) => (a > b ? 1 : 0)); pc++; break;
        case OP.JMP: jump(addr16()); break;
        case OP.JZ: { const v = pop(); const a = addr16(); if (v === 0) jump(a); break; }
        case OP.JNZ: { const v = pop(); const a = addr16(); if (v !== 0) jump(a); break; }
        case OP.CALL: { const a = addr16(); if (cs.length >= MAX_CALL) trap(6); cs.push(pc); jump(a); break; }
        case OP.RET: { if (!cs.length) trap(10); pc = cs.pop(); break; }
        case OP.LOAD: push(mem[pop() & 255]); pc++; break;
        case OP.STORE: { const a = pop(), v = pop(); mem[a & 255] = v; pc++; break; }
        case OP.IN: { if (ip >= input.length) trap(7); push(input[ip++]); pc++; break; }
        case OP.OUT: { const v = pop(); if (out.length >= MAX_OUT) trap(9); out.push(v & 255); pc++; break; }
        case OP.INC: push(pop() + 1); pc++; break;
        case OP.DEC: push(pop() - 1); pc++; break;
        default: trap(3);
      }
    }
  } catch (e) {
    if (typeof e === "number") return { code: e, out: Buffer.from(out) };
    throw e;
  }
}

const inDir = process.env.MAKEFUN_INPUT_DIR || "/input";
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const instances = [];
if (fs.existsSync(inDir)) {
  // "root" is the reserved id for the root instance: a subdirectory
  // literally named root must not shadow it when a root program exists.
  const hasRoot = fs.existsSync(path.join(inDir, "program.bin"));
  if (hasRoot) {
    instances.push({ id: "root", dir: inDir });
  }
  for (const e of fs.readdirSync(inDir, { withFileTypes: true })) {
    if (e.name === "root" && hasRoot) continue;
    if (e.isDirectory() && fs.existsSync(path.join(inDir, e.name, "program.bin"))) {
      instances.push({ id: e.name, dir: path.join(inDir, e.name) });
    }
  }
  instances.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
for (const inst of instances) {
  const program = fs.readFileSync(path.join(inst.dir, "program.bin"));
  const ip = path.join(inst.dir, "input.bin");
  const input = fs.existsSync(ip) ? fs.readFileSync(ip) : Buffer.alloc(0);
  const r = run(program, input);
  const od = path.join(outDir, inst.id);
  fs.mkdirSync(od, { recursive: true });
  fs.writeFileSync(path.join(od, "output.bin"), r.out);
  fs.writeFileSync(path.join(od, "exit.txt"), String(r.code));
  fs.writeFileSync(path.join(od, "exit_code.txt"), String(r.code));
}
