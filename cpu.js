const U16 = (x) => (x & 0xFFFF);
const EVEN = (x) => (x & 0xFFFE);

const REG = Object.freeze({
  ACC: 0,
  DR: 1,
  PC: 2,
  INR: 3,
  EXT: 4,
  SP: 5,
  BR: 6,
  AR: 7,
  MAR: 8,
  MDR: 9,
  IN: 10,
  OUT: 11,
  FLAGS: 12,
  R0: 13,
  R1: 14,
  R2: 15,
  R3: 16,
  R4: 17,
  R5: 18,
  R6: 19,
  R7: 20,
});

const OPC = Object.freeze({
  NOP: 0x00,
  EI: 0x01,
  DI: 0x02,
  HLT: 0x03,

  ADD: 0x20,
  SUB: 0x21,
  CMP: 0x22,
  MUL: 0x23,
  DIV: 0x24,
  MOD: 0x25,

  INC: 0x0A,
  DEC: 0x0B,

  AND: 0x26,
  OR: 0x27,
  XOR: 0x28,
  NOT: 0x0F,

  SWL: 0x10,
  SWR: 0x11,

  PUSH: 0x12,
  POP: 0x13,
  PUSHF: 0x14,
  POPF: 0x15,
  CALL: 0x16,
  RET: 0x17,
  INT: 0x18,
  IRET: 0x19,

  IN: 0x1A,
  OUT: 0x1B,

  MOV: 0x1C,
  WR: 0x29,
  RD: 0x2A,
  WRBR: 0x1F,
  WRSP: 0x04,

  JMP: 0x05,
  JZ: 0x06,
  JNZ: 0x07,
  JS: 0x08,
  JNS: 0x09,
  JO: 0x0C,
  JNO: 0x0D,
  JNRZ: 0x2E,
});

const FLAG = Object.freeze({
  Z: 1 << 0,
  S: 1 << 1,
  C: 1 << 2,
  O: 1 << 3,
  I: 1 << 4,
  H: 1 << 5,
});

const MNEMONIC = Object.freeze({
  NOP: OPC.NOP,
  EI: OPC.EI,
  DI: OPC.DI,
  HLT: OPC.HLT,

  ADD: OPC.ADD,
  SUB: OPC.SUB,
  CMP: OPC.CMP,
  MUL: OPC.MUL,
  DIV: OPC.DIV,
  MOD: OPC.MOD,

  INC: OPC.INC,
  DEC: OPC.DEC,

  AND: OPC.AND,
  OR: OPC.OR,
  XOR: OPC.XOR,
  NOT: OPC.NOT,

  SWL: OPC.SWL,
  SWR: OPC.SWR,

  PUSH: OPC.PUSH,
  POP: OPC.POP,
  PUSHF: OPC.PUSHF,
  POPF: OPC.POPF,

  CALL: OPC.CALL,
  RET: OPC.RET,
  INT: OPC.INT,
  IRET: OPC.IRET,

  IN: OPC.IN,
  OUT: OPC.OUT,

  MOV: OPC.MOV,
  WR: OPC.WR,
  RD: OPC.RD,
  WRBR: OPC.WRBR,
  WRSP: OPC.WRSP,

  JMP: OPC.JMP,
  JZ: OPC.JZ,
  JNZ: OPC.JNZ,
  JS: OPC.JS,
  JNS: OPC.JNS,
  JO: OPC.JO,
  JNO: OPC.JNO,
  JNRZ: OPC.JNRZ,
});

const OPCODE_TO_MNEMONIC = Object.freeze(
  Object.fromEntries(Object.entries(MNEMONIC).map(([name, code]) => [code, name]))
);

const ADDR_MODE = Object.freeze({
  DIRECT: 0b000,
  REGISTER: 0b001,
  IMMEDIATE: 0b010,
  MEM_INDIRECT: 0b011,
  RELATIVE: 0b100,
  REG_INDIRECT: 0b101,
  POST_INC: 0b110,
  PRE_DEC: 0b111,
});

const INSTR_INFO = Object.freeze({
  [OPC.NOP]: { type: 0, operands: 0 },
  [OPC.EI]: { type: 0, operands: 0 },
  [OPC.DI]: { type: 0, operands: 0 },
  [OPC.HLT]: { type: 0, operands: 0 },

  [OPC.ADD]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.SUB]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.CMP]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.MUL]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.DIV]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.MOD]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

  [OPC.AND]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.OR]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.XOR]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

  [OPC.INC]: { type: 0, operands: 0 },
  [OPC.DEC]: { type: 0, operands: 0 },
  [OPC.NOT]: { type: 0, operands: 0 },
  [OPC.SWL]: { type: 0, operands: 0 },
  [OPC.SWR]: { type: 0, operands: 0 },

  [OPC.PUSH]: { type: 0, operands: 0 },
  [OPC.POP]: { type: 0, operands: 0 },
  [OPC.PUSHF]: { type: 0, operands: 0 },
  [OPC.POPF]: { type: 0, operands: 0 },

  [OPC.CALL]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.RET]: { type: 0, operands: 0 },
  [OPC.INT]: { type: 1, operands: 1, op_size_offset: [{ size: 4, ofs: 0 }] },
  [OPC.IRET]: { type: 0, operands: 0 },

  [OPC.IN]: { type: 0, operands: 0 },
  [OPC.OUT]: { type: 0, operands: 0 },

  [OPC.MOV]: {
    type: 1,
    operands: 2,
    op_size_offset: [
      { size: 3, ofs: 3 },
      { size: 3, ofs: 0 },
    ],
  },

  [OPC.WR]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
  [OPC.RD]: { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

  [OPC.WRBR]: { type: 0, operands: 0 },
  [OPC.WRSP]: { type: 0, operands: 0 },

  [OPC.JMP]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JZ]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JNZ]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JS]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JNS]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JO]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JNO]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
  [OPC.JNRZ]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
});

function instrType(opc) {
  return INSTR_INFO[opc]?.type;
}
function instrOperands(opc) {
  return INSTR_INFO[opc]?.operands;
}
function instrSizeBytes(opc) {
  return INSTR_INFO[opc]?.type === 2 ? 4 : 2;
}
function instrOpSizeOffset(opc) {
  return INSTR_INFO[opc]?.op_size_offset;
}

const HEX = (v, n = 4) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(n, "0")}`;

function decodeInstruction(ins) {
  const opc = (ins >>> 10) & 0x3f;
  const am = (ins >>> 7) & 0x7;
  const data = ins & 0x3ff;
  return {
    opc,
    mnemonic: OPCODE_TO_MNEMONIC[opc] ?? "???",
    am,
    data,
  };
}

class RAM {
  constructor(size) {
    this.mem = new Uint8Array(size);

    return new Proxy(this, {
      get: (t, p) => {
        if (!isNaN(p)) {
          if (p < 0 || p >= t.mem.length) {
            throw new Error("Memory access violation");
          }
          return t.mem[p];
        }
        return t[p];
      },
      set: (t, p, v) => {
        if (!isNaN(p)) {
          if (p < 0 || p >= t.mem.length) {
            throw new Error("Memory access violation");
          }
          t.mem[p] = v & 0xff;
          return true;
        }
        if (p === "push") {
          throw new Error("No push!");
        }
        t[p] = v;
        return true;
      },
    });
  }

  readIns(adr) {
    if (adr % 2 === 1) {
      throw new Error("Instruction address must be even");
    }
    return (this.mem[adr + 1] << 8) + this.mem[adr];
  }

  clear() {
    this.mem.fill(0);
  }
}

function readWord(mem, adr) {
  return mem.readIns(adr);
}

function writeWord(mem, adr, value) {
  if (adr % 2 === 1) {
    throw new Error("Instruction address must be even");
  }
  const word = U16(value);
  mem[adr] = word & 0xff;
  mem[adr + 1] = (word >> 8) & 0xff;
}

function readOperand(cpu, mem, mode, arg) {
  switch (mode) {
    case ADDR_MODE.DIRECT: {
      const addr = arg & 0x03ff;
      return mem.readIns(addr);
    }
    case ADDR_MODE.REGISTER: {
      if (arg < 0 || arg >= cpu.R.length) throw new Error("Register must be 0..7");
      return cpu.R[arg];
    }
    case ADDR_MODE.IMMEDIATE: {
      return U16(arg);
    }
    case ADDR_MODE.MEM_INDIRECT: {
      const addr = arg & 0x03ff;
      const ptr = mem.readIns(addr) & 0x03ff;
      return mem.readIns(ptr);
    }
    case ADDR_MODE.RELATIVE: {
      const addr = EVEN((cpu.BR + arg) & 0xffff) & 0x03ff;
      return mem.readIns(addr);
    }
    case ADDR_MODE.REG_INDIRECT: {
      if (arg < 0 || arg >= cpu.R.length) throw new Error("Register must be 0..7");
      const ptr = cpu.R[arg] & 0x03ff;
      return mem.readIns(ptr);
    }
    case ADDR_MODE.POST_INC: {
      if (arg < 0 || arg >= cpu.R.length) throw new Error("Register must be 0..7");
      const ptr = cpu.R[arg] & 0x03ff;
      const value = mem.readIns(ptr);
      cpu.R[arg] = EVEN((ptr + 2) & 0xffff);
      return value;
    }
    case ADDR_MODE.PRE_DEC: {
      if (arg < 0 || arg >= cpu.R.length) throw new Error("Register must be 0..7");
      const ptr = EVEN((cpu.R[arg] - 2) & 0xffff) & 0x03ff;
      cpu.R[arg] = ptr;
      return mem.readIns(ptr);
    }
    default:
      throw new Error(`Unknown addressing mode: ${mode}`);
  }
}

class CPU {
  constructor(mem) {
    this.mem = mem;
    this.rf = new Uint16Array(21);
    this.debug = false;
    this.halted = false;
    this.rf[REG.SP] = 0x03fe;
    this.R = new Uint16Array(this.rf.buffer, REG.R0 * 2, 8);
  }

  async run({ max = 10000, onStep, intervalMs = 0 } = {}) {
    let i = 0;
    while (!this.halted && i++ < max) {
      this.step();
      if (onStep) {
        onStep(this);
      }
      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } else {
        await Promise.resolve();
      }
    }
  }

  step() {
    const adr = this.PC;
    const ins = this.mem.readIns(adr);
    const opc = (ins >> 10) & 0x3f;
    const mode = (ins >> 7) & 0x07;
    const data = ins & 0x3ff;

    this._loadINR = ins;
    if (instrType(opc) === 2) {
      const ext = this.mem.readIns(adr + 2);
      this._loadEXT = ext;
      this.PC += 4;
      if (ISA[opc]) {
        ISA[opc](mode);
      }
      return;
    }

    this.PC += 2;
    if (ISA[opc]) {
      ISA[opc](data);
    }
  }

  halt() {
    this.halted = true;
  }

  push(word) {
    this.SP = this.SP - 2;
    this.mem[this.SP] = word & 0xff;
    this.mem[this.SP + 1] = (word >> 8) & 0xff;
  }

  pop() {
    const lo = this.mem[this.SP];
    const hi = this.mem[this.SP + 1];
    const v = (hi << 8) | lo;
    this.SP = this.SP + 2;
    return v;
  }

  reset() {
    this.rf.fill(0);
    this.halted = false;
    this.SP = 0x03fe;
  }

  _set(regIndex, value) {
    let v = U16(value);
    if (regIndex === REG.PC || regIndex === REG.SP) {
      v = EVEN(v);
    }
    this.rf[regIndex] = v;
    return v;
  }

  _get(regIndex) {
    return this.rf[regIndex];
  }

  get ACC() { return this._get(REG.ACC); }
  set ACC(v) { this._set(REG.ACC, v); }

  get DR() { return this._get(REG.DR); }
  set DR(v) { this._set(REG.DR, v); }

  get PC() { return this._get(REG.PC); }
  set PC(v) { this._set(REG.PC, v); }

  get SP() { return this._get(REG.SP); }
  set SP(v) { this._set(REG.SP, v); }

  get BR() { return this._get(REG.BR); }
  set BR(v) { this._set(REG.BR, v); }

  get AR() { return this._get(REG.AR); }
  set AR(v) { this._set(REG.AR, v); }

  get MAR() { return this._get(REG.MAR); }
  set MAR(v) { this._set(REG.MAR, v); }

  get MDR() { return this._get(REG.MDR); }
  set MDR(v) { this._set(REG.MDR, v); }

  get IN() { return this._get(REG.IN); }
  set IN(v) { this._set(REG.IN, v); }

  get OUT() { return this._get(REG.OUT); }
  set OUT(v) { this._set(REG.OUT, v); }

  get INR() { return this._get(REG.INR); }
  get EXT() { return this._get(REG.EXT); }
  set _loadINR(word) { this._set(REG.INR, word); }
  set _loadEXT(word) { this._set(REG.EXT, word); }

  get FLAGS() { return this._get(REG.FLAGS); }
  set FLAGS(v) { this._set(REG.FLAGS, v); }

  getFlag(mask) { return (this.FLAGS & mask) ? 1 : 0; }
  setFlag(mask, on) {
    const f = this.FLAGS;
    this.FLAGS = on ? (f | mask) : (f & ~mask);
  }

  _updateZS(result16) {
    const r = U16(result16);
    this.setFlag(FLAG.Z, r === 0);
    this.setFlag(FLAG.S, (r & 0x8000) !== 0);
  }

  snapshot() {
    return {
      ACC: this.ACC,
      DR: this.DR,
      PC: this.PC,
      INR: this.INR,
      EXT: this.EXT,
      SP: this.SP,
      BR: this.BR,
      AR: this.AR,
      MAR: this.MAR,
      MDR: this.MDR,
      IN: this.IN,
      OUT: this.OUT,
      FLAGS: this.FLAGS,
      R: Array.from(this.R),
    };
  }
}

const MEM = new RAM(1024);
const CPU_INSTANCE = new CPU(MEM);

const ISA = new Array(64);

ISA[OPC.NOP] = () => {};
ISA[OPC.EI] = () => CPU_INSTANCE.setFlag(FLAG.I, 1);
ISA[OPC.DI] = () => CPU_INSTANCE.setFlag(FLAG.I, 0);
ISA[OPC.HLT] = () => CPU_INSTANCE.halt();

ISA[OPC.ADD] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC + CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC + CPU_INSTANCE.DR);
};
ISA[OPC.SUB] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC - CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC - CPU_INSTANCE.DR);
};
ISA[OPC.CMP] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC - CPU_INSTANCE.DR);
};
ISA[OPC.MUL] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC * CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC * CPU_INSTANCE.DR);
};
ISA[OPC.DIV] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC / CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC / CPU_INSTANCE.DR);
};
ISA[OPC.MOD] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC % CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC % CPU_INSTANCE.DR);
};
ISA[OPC.INC] = () => {
  const r = U16(CPU_INSTANCE.ACC + 1);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.DEC] = () => {
  const r = U16(CPU_INSTANCE.ACC - 1);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.AND] = (mode) => {
  const r = CPU_INSTANCE.ACC & readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.OR] = (mode) => {
  const r = CPU_INSTANCE.ACC | readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.XOR] = (mode) => {
  const r = CPU_INSTANCE.ACC ^ readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.NOT] = () => {
  const r = U16(~CPU_INSTANCE.ACC);
  CPU_INSTANCE.ACC = r;
  CPU_INSTANCE._updateZS(r);
};
ISA[OPC.SWL] = () => {
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC << 1;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC << 1);
};
ISA[OPC.SWR] = () => {
  CPU_INSTANCE.ACC = CPU_INSTANCE.ACC >> 1;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.ACC >> 1);
};

ISA[OPC.PUSH] = () => {
  CPU_INSTANCE.push(CPU_INSTANCE.ACC);
};
ISA[OPC.POP] = () => {
  CPU_INSTANCE.ACC = CPU_INSTANCE.pop();
};
ISA[OPC.PUSHF] = () => {
  CPU_INSTANCE.push(CPU_INSTANCE.FLAGS);
};
ISA[OPC.POPF] = () => {
  CPU_INSTANCE.FLAGS = CPU_INSTANCE.pop();
};
ISA[OPC.CALL] = (data) => {
  CPU_INSTANCE.push(CPU_INSTANCE.PC);
  CPU_INSTANCE.PC = data;
};
ISA[OPC.RET] = () => {
  CPU_INSTANCE.PC = CPU_INSTANCE.pop();
};
ISA[OPC.INT] = (data) => {
  CPU_INSTANCE.push(CPU_INSTANCE.FLAGS);
  CPU_INSTANCE.push(CPU_INSTANCE.PC);
  CPU_INSTANCE.PC = data & 0x0f;
};
ISA[OPC.IRET] = () => {
  CPU_INSTANCE.PC = CPU_INSTANCE.pop();
  CPU_INSTANCE.FLAGS = CPU_INSTANCE.pop();
};

ISA[OPC.IN] = () => {
  CPU_INSTANCE.ACC = CPU_INSTANCE.IN;
};
ISA[OPC.OUT] = () => {
  CPU_INSTANCE.OUT = CPU_INSTANCE.ACC;
};

ISA[OPC.MOV] = (data) => {
  const R1 = (data >> 0) & 0x07;
  const R2 = (data >> 3) & 0x07;
  CPU_INSTANCE.R[R2] = CPU_INSTANCE.R[R1];
};
ISA[OPC.WR] = (mode) => {
  if (mode === ADDR_MODE.DIRECT) {
    MEM[CPU_INSTANCE.EXT] = CPU_INSTANCE.ACC;
  }
  if (mode === ADDR_MODE.REGISTER) {
    CPU_INSTANCE.R[CPU_INSTANCE.EXT] = CPU_INSTANCE.ACC;
  }
};
ISA[OPC.RD] = (mode) => {
  const op = readOperand(CPU_INSTANCE, MEM, mode, CPU_INSTANCE.EXT);
  CPU_INSTANCE.DR = U16(op);
  CPU_INSTANCE.ACC = CPU_INSTANCE.DR;
  CPU_INSTANCE._updateZS(CPU_INSTANCE.DR);
};
ISA[OPC.WRBR] = () => {
  CPU_INSTANCE.BR = CPU_INSTANCE.ACC;
};
ISA[OPC.WRSP] = () => {
  CPU_INSTANCE.SP = CPU_INSTANCE.ACC;
};

ISA[OPC.JMP] = (data) => {
  CPU_INSTANCE.PC = data & 0x3ff;
};
ISA[OPC.JZ] = (data) => {
  if (CPU_INSTANCE.getFlag(FLAG.Z)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};
ISA[OPC.JNZ] = (data) => {
  if (!CPU_INSTANCE.getFlag(FLAG.Z)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};
ISA[OPC.JS] = (data) => {
  if (CPU_INSTANCE.getFlag(FLAG.S)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};
ISA[OPC.JNS] = (data) => {
  if (!CPU_INSTANCE.getFlag(FLAG.S)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};
ISA[OPC.JO] = (data) => {
  if (CPU_INSTANCE.getFlag(FLAG.O)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};
ISA[OPC.JNO] = (data) => {
  if (!CPU_INSTANCE.getFlag(FLAG.O)) {
    CPU_INSTANCE.PC = data & 0x3ff;
  }
};

export {
  ADDR_MODE,
  CPU_INSTANCE as CPU,
  FLAG,
  HEX,
  INSTR_INFO,
  MEM,
  MNEMONIC,
  OPC,
  OPCODE_TO_MNEMONIC,
  RAM,
  REG,
  decodeInstruction,
  instrOpSizeOffset,
  instrOperands,
  instrSizeBytes,
  instrType,
  readWord,
  writeWord,
};
