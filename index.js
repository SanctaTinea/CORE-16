console.log('Happy developing ✨')

// Утилиты
const U16 = (x) => (x & 0xFFFF);
const EVEN = (x) => (x & 0xFFFE); // выравнивание по 2 байтам

// Индексы регистров в "регфайле"
const REG = Object.freeze({
    ACC: 0,
    DR: 1,
    PC: 2,
    INR: 3,    // read-only с точки зрения ISA, но CPU пишет
    EXT: 4,   // read-only с точки зрения ISA, но CPU пишет
    SP: 5,
    BR: 6,
    AR: 7,
    MAR: 8,
    MDR: 9,
    IN: 10,   // input register (IR в твоём тексте про I/O — чтобы не путать с instruction register, назвал IN)
    OUT: 11,  // output register (OR)
    FLAGS: 12,

    // R0..R7 (РОН)
    R0: 13, R1: 14, R2: 15, R3: 16, R4: 17, R5: 18, R6: 19, R7: 20,
});

export const OPC = Object.freeze({
    NOP:  0x00,
    EI:   0x01,
    DI:   0x02,
    HLT:  0x03,

    ADD:  0x20,
    SUB:  0x21,
    CMP:  0x22,
    MUL:  0x23,
    DIV:  0x24,
    MOD:  0x25,

    INC:  0x0A,
    DEC:  0x0B,

    AND:  0x26,
    OR:   0x27,
    XOR:  0x28,
    NOT:  0x0F,

    SWL:  0x10,
    SWR:  0x11,

    PUSH: 0x12,
    POP:  0x13,
    PUSHF:0x14,
    POPF: 0x15,
    CALL: 0x16,
    RET:  0x17,
    INT:  0x18,
    IRET: 0x19,

    IN:   0x1A,
    OUT:  0x1B,

    MOV:  0x1C,
    WR:   0x29,
    RD:   0x2A,
    WRBR: 0x1F,
    WRSP: 0x04,

    JMP:  0x05,
    JZ:   0x06,
    JNZ:  0x07,
    JS:   0x08,
    JNS:  0x09,
    JO:   0x0C,
    JNO:  0x0D,
    JNRZ: 0x2E,
});

// Биты флагов (минимум из твоего описания)
const FLAG = Object.freeze({
    Z: 1 << 0,
    S: 1 << 1,
    C: 1 << 2,
    O: 1 << 3,
    I: 1 << 4,
    H: 1 << 5,
});

const MNEMONIC = Object.freeze({
    // ───────────── Управление
    NOP:  OPC.NOP,   // 0x00
    EI:   OPC.EI,    // 0x01
    DI:   OPC.DI,    // 0x02
    HLT:  OPC.HLT,   // 0x03

    // ───────────── Арифметика
    ADD:  OPC.ADD,   // 0x04
    SUB:  OPC.SUB,   // 0x05
    CMP:  OPC.CMP,   // 0x06
    MUL:  OPC.MUL,   // 0x07
    DIV:  OPC.DIV,   // 0x08
    MOD:  OPC.MOD,   // 0x09

    INC:  OPC.INC,   // 0x0A
    DEC:  OPC.DEC,   // 0x0B

    // ───────────── Логика
    AND:  OPC.AND,   // 0x0C
    OR:   OPC.OR,    // 0x0D
    XOR:  OPC.XOR,   // 0x0E
    NOT:  OPC.NOT,   // 0x0F

    // ───────────── Сдвиги
    SWL:  OPC.SWL,   // 0x10
    SWR:  OPC.SWR,   // 0x11

    // ───────────── Стек и прерывания
    PUSH:  OPC.PUSH,   // 0x12
    POP:   OPC.POP,    // 0x13
    PUSHF: OPC.PUSHF,  // 0x14
    POPF:  OPC.POPF,   // 0x15

    CALL:  OPC.CALL,   // 0x16
    RET:   OPC.RET,    // 0x17
    INT:   OPC.INT,    // 0x18
    IRET:  OPC.IRET,   // 0x19

    // ───────────── Ввод / вывод
    IN:   OPC.IN,    // 0x1A
    OUT:  OPC.OUT,   // 0x1B

    // ───────────── Чтение / запись
    MOV:  OPC.MOV,   // 0x1C
    WR:   OPC.WR,    // 0x1D
    RD:   OPC.RD,    // 0x1E
    WRBR: OPC.WRBR,  // 0x1F
    WRSP: OPC.WRSP,  // 0x20

    // ───────────── Переходы
    JMP:  OPC.JMP,   // 0x21
    JZ:   OPC.JZ,    // 0x22
    JNZ:  OPC.JNZ,   // 0x23
    JS:   OPC.JS,    // 0x24
    JNS:  OPC.JNS,   // 0x25
    JO:   OPC.JO,    // 0x26
    JNO:  OPC.JNO,   // 0x27
    JNRZ: OPC.JNRZ,  // 0x28
});

const ADDR_MODE = Object.freeze({
    DIRECT:        0b000, // x
    REGISTER:      0b001, // Rx
    IMMEDIATE:     0b010, // #x
    MEM_INDIRECT:  0b011, // @x
    RELATIVE:      0b100, // [x]
    REG_INDIRECT:  0b101, // @Rx
    POST_INC:      0b110, // @Rx+
    PRE_DEC:       0b111, // -@Rx
});

// 0 = тип 0 (16 бит, без параметров)
// 1 = тип 1 (16 бит, DATA[9:0])
// 2 = тип 2 (32 бита, ADDRMODE + OPERAND16)

const INSTR_INFO = Object.freeze({
    // ───────────── Управление (type 0)
    [OPC.NOP]:  { type: 0, operands: 0 },
    [OPC.EI]:   { type: 0, operands: 0 },
    [OPC.DI]:   { type: 0, operands: 0 },
    [OPC.HLT]:  { type: 0, operands: 0 },

    // ───────────── Арифметика / логика (ACC op operand) (type 2)
    [OPC.ADD]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.SUB]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.CMP]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.MUL]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.DIV]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.MOD]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

    [OPC.AND]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.OR]:   { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.XOR]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

    // ───────────── Арифметика без операндов (type 0)
    [OPC.INC]:  { type: 0, operands: 0 },
    [OPC.DEC]:  { type: 0, operands: 0 },
    [OPC.NOT]:  { type: 0, operands: 0 },
    [OPC.SWL]:  { type: 0, operands: 0 },
    [OPC.SWR]:  { type: 0, operands: 0 },

    // ───────────── Стек (type 0)
    [OPC.PUSH]:  { type: 0, operands: 0 },
    [OPC.POP]:   { type: 0, operands: 0 },
    [OPC.PUSHF]: { type: 0, operands: 0 },
    [OPC.POPF]:  { type: 0, operands: 0 },

    // ───────────── Подпрограммы / прерывания
    [OPC.CALL]: { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.RET]:  { type: 0, operands: 0 },
    [OPC.INT]:  { type: 1, operands: 1, op_size_offset: [{ size: 4, ofs: 0 }] },
    [OPC.IRET]: { type: 0, operands: 0 },

    // ───────────── Ввод / вывод (type 0)
    [OPC.IN]:   { type: 0, operands: 0 },
    [OPC.OUT]:  { type: 0, operands: 0 },

    // ───────────── Память / регистры
    // MOV Rdst, Rsrc  → DATA[5:3], DATA[2:0]
    [OPC.MOV]: {
        type: 1,
        operands: 2,
        op_size_offset: [
            { size: 3, ofs: 3 }, // Rdst
            { size: 3, ofs: 0 }, // Rsrc
        ]
    },

    // WR / RD используют OPERAND + ADDRMODE
    [OPC.WR]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },
    [OPC.RD]:  { type: 2, operands: 1, op_size_offset: [{ size: 16, ofs: 0 }] },

    [OPC.WRBR]: { type: 0, operands: 0 },
    [OPC.WRSP]: { type: 0, operands: 0 },

    // ───────────── Переходы (PC = VAL)
    [OPC.JMP]:  { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JZ]:   { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JNZ]:  { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JS]:   { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JNS]:  { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JO]:   { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
    [OPC.JNO]:  { type: 1, operands: 1, op_size_offset: [{ size: 10, ofs: 0 }] },
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

const HEX = (v, n = 4) => "0x" + (v >>> 0).toString(16).toUpperCase().padStart(n, "0");
function dumpRegs(CPU) {
    const r = CPU.rf;
    return [
        `ACC=${HEX(r[REG.ACC])}`,
        `DR=${HEX(r[REG.DR])}`,
        `PC=${HEX(r[REG.PC])}`,
        `SP=${HEX(r[REG.SP])}`,
        `BR=${HEX(r[REG.BR])}`,
        `AR=${HEX(r[REG.AR])}`,
        `MAR=${HEX(r[REG.MAR])}`,
        `MDR=${HEX(r[REG.MDR])}`,
        `IN=${HEX(r[REG.IN])}`,
        `OUT=${HEX(r[REG.OUT])}`,
        `FLAGS=${HEX(r[REG.FLAGS])}`,
        `R0=${HEX(r[REG.R0])}`,
        `R1=${HEX(r[REG.R1])}`,
        `R2=${HEX(r[REG.R2])}`,
        `R3=${HEX(r[REG.R3])}`,
        `R4=${HEX(r[REG.R4])}`,
        `R5=${HEX(r[REG.R5])}`,
        `R6=${HEX(r[REG.R6])}`,
        `R7=${HEX(r[REG.R7])}`,
    ].join(" | ");
}
function decodeInstr(ins) {
    const opc = (ins >>> 10) & 0x3F;
    const am  = (ins >>> 7) & 0x7;

    const mnemonic = Object.keys(MNEMONIC).find(k => MNEMONIC[k] === opc) ?? "???";
    const amName = Object.keys(ADDR_MODE).find(k => ADDR_MODE[k] === am) ?? "-";

    return { opc, mnemonic, am, amName };
}

class CPU_ {
    constructor() {
        // 21 регистр * 16 бит
        this.rf = new Uint16Array(21);

        this.debug = false; // ← можно выключать


        // Инициализация как в описании: SP = 0x03FE (верх памяти 1KB, стек вниз)
        // PC и SP должны быть кратны 2 (выравнивание инструкций/стека)
        this.rf[REG.SP] = 0x03FE;

        // Для удобства: RON как view
        this.R = new Uint16Array(this.rf.buffer, REG.R0 * 2, 8);
        this.halted = false;
    }

    run(max = 30) {
        let i = 0;
        while (!this.halted && i++ < max) {
            this.step();
        }
    }

    step() {
        let adr = this.PC;
        let pcBefore = this.PC
        let ins = MEM.readIns(adr);

        let opc = (ins >> 10) & 0x3F;
        let mode = (ins >> 7) & 0x07;
        let data = (ins >> 0) & 0x3FF;

        this._loadINR = ins;
        if (instrType(opc) === 2) {
            let ext = MEM.readIns(adr+2);
            this._loadEXT = ext;
            this.PC += 4;
            ISA[opc](mode);
        }
        else {
            this.PC += 2;
            ISA[opc](data);
        }

        if (this.debug) {
            const d = decodeInstr(ins);
            console.group(
                `\n%cPC=${HEX(pcBefore)}  ${d.mnemonic}  AM=${d.amName}  INS=${HEX(ins, 8)}`,
                "color:#2563eb;font-weight:bold"
            );
            console.log("Before:", dumpRegs(this));
        }
    }

    halt() { this.halted = true; }

    push(word) {
        this.SP = this.SP - 2;
        MEM[this.SP]     = word & 0xFF;
        MEM[this.SP + 1] = (word >> 8) & 0xFF;
    }

    pop() {
        const lo = MEM[this.SP];
        const hi = MEM[this.SP + 1];
        const v = (hi << 8) | lo;
        this.SP = this.SP + 2;
        return v;
    }
    // Низкоуровневая запись в регистр (CPU-уровень)
    _set(regIndex, value) {
        let v = U16(value);

        // Инварианты архитектуры
        if (regIndex === REG.PC || regIndex === REG.SP) v = EVEN(v);

        this.rf[regIndex] = v;
        return v;
    }

    // Низкоуровневое чтение (CPU-уровень)
    _get(regIndex) {
        return this.rf[regIndex];
    }

    // Публичные удобные геттеры/сеттеры (для ядра/микрокода и UI)
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

    // IR/EXT обычно “read-only” для программы, но ядро CPU их устанавливает при fetch/decode
    get INR() { return this._get(REG.IR); }
    get EXT() { return this._get(REG.EXT); }
    set _loadINR(word) { this._set(REG.IR, word); }
    set _loadEXT(word) { this._set(REG.EXT, word); }

    // FLAGS как битовое поле
    get FLAGS() { return this._get(REG.FLAGS); }
    set FLAGS(v) { this._set(REG.FLAGS, v); }

    getFlag(mask) { return (this.FLAGS & mask) ? 1 : 0; }
    setFlag(mask, on) {
        const f = this.FLAGS;
        this.FLAGS = on ? (f | mask) : (f & ~mask);
    }

    // Пример: обновление Z/S по результату 16-бит
    _updateZS(result16) {
        const r = U16(result16);
        this.setFlag(FLAG.Z, r === 0);
        this.setFlag(FLAG.S, (r & 0x8000) !== 0);
    }

    // Пример ALU: ADD в аккумулятор
    aluAdd(operand) {
        const a = this.ACC;
        const b = U16(operand);
        const sum = a + b;

        const res = U16(sum);
        this.ACC = res;

        // Carry (беззнаковый перенос)
        this.setFlag(FLAG.C, sum > 0xFFFF);

        // Overflow (знаковое переполнение): знаки a и b одинаковы, знак res другой
        const sa = (a & 0x8000) !== 0;
        const sb = (b & 0x8000) !== 0;
        const sr = (res & 0x8000) !== 0;
        this.setFlag(FLAG.O, (sa === sb) && (sr !== sa));

        this._updateZS(res);
        return res;
    }

    // Снапшот состояния для UI
    snapshot() {
        return {
            ACC: this.ACC, DR: this.DR, PC: this.PC, IR: this.IR, EXT: this.EXT,
            SP: this.SP, BR: this.BR, AR: this.AR, MAR: this.MAR, MDR: this.MDR,
            IN: this.IN, OUT: this.OUT, FLAGS: this.FLAGS,
            R: Array.from(this.R), // R0..R7
        };
    }
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
                    t.mem[p] = v & 0xFF;
                    return true;
                }
                if (p === "push") { throw new Error("No push!"); }
                t[p] = v;
                return true;
            }
        });
    }

    readIns(adr) {
        if (adr % 2 === 1) { throw new Error("Instruction address must be even"); }
        return (this.mem[adr+1] << 8) + this.mem[adr];
    }
}

const ISA = new Array(64);

ISA[OPC.NOP] = () => {};
ISA[OPC.EI] = () => CPU.setFlag(FLAG.I, 1);
ISA[OPC.DI] = () => CPU.setFlag(FLAG.I, 0);
ISA[OPC.HLT] = () => CPU.halt();

ISA[OPC.ADD] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.ACC + CPU.DR;
    CPU._updateZS(CPU.ACC + CPU.DR);
};
ISA[OPC.SUB] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.ACC - CPU.DR;
    CPU._updateZS(CPU.ACC - CPU.DR);
}; //TODO
ISA[OPC.CMP] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU._updateZS(CPU.ACC - CPU.DR);
};
ISA[OPC.MUL] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.ACC * CPU.DR;
    CPU._updateZS(CPU.ACC * CPU.DR);
};
ISA[OPC.DIV] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.ACC / CPU.DR;
    CPU._updateZS(CPU.ACC / CPU.DR);
};
ISA[OPC.MOD] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.ACC % CPU.DR;
    CPU._updateZS(CPU.ACC % CPU.DR);
};
ISA[OPC.INC] = () => {
    const r = U16(CPU.ACC + 1);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.DEC] = () => {
    const r = U16(CPU.ACC - 1);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.AND] = (mode) => {
    const r = CPU.ACC & readOperand(mode, CPU.EXT);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.OR] = (mode) => {
    const r = CPU.ACC | readOperand(mode, CPU.EXT);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.XOR] = (mode) => {
    const r = CPU.ACC ^ readOperand(mode, CPU.EXT);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.NOT] = () => {
    const r = U16(~CPU.ACC);
    CPU.ACC = r;
    CPU._updateZS(r);
};
ISA[OPC.SWL] = () => {
    CPU.ACC = CPU.ACC << 1;
    CPU._updateZS(CPU.ACC << 1);
};
ISA[OPC.SWR] = () => {
    CPU.ACC = CPU.ACC >> 1;
    CPU._updateZS(CPU.ACC >> 1);
};

ISA[OPC.PUSH] = () => {
    CPU.push(CPU.ACC);
};
ISA[OPC.POP] = () => {
    CPU.ACC = CPU.pop();
};
ISA[OPC.PUSHF] = () => {
    CPU.push(CPU.FLAGS);
};
ISA[OPC.POPF] = () => {
    CPU.FLAGS = CPU.pop();
};
ISA[OPC.CALL] = (data) => {
    CPU.push(CPU.PC);
    CPU.PC = data;
};
ISA[OPC.RET] = () => {
    CPU.PC = CPU.pop();
};
ISA[OPC.INT] = (data) => {
    CPU.push(CPU.FLAGS);
    CPU.push(CPU.PC);
    CPU.PC = data & 0x0F;
};
ISA[OPC.RET] = () => {
    CPU.PC = CPU.pop();
    CPU.FLAGS = CPU.pop();
};

ISA[OPC.IN] = () => {
    CPU.ACC = CPU.IN;
};
ISA[OPC.OUT] = () => {
    CPU.OUT = CPU.ACC;
};

ISA[OPC.MOV] = (data) => {
    const R1 = (data >> 0) & 0x07;
    const R2 = (data >> 3) & 0x07;
    CPU.R[R2] = CPU.R[R1];
};
//TODO
ISA[OPC.WR] = (mode) => { //TODO
    if (mode === ADDR_MODE.DIRECT) {
        MEM[CPU.EXT] = CPU.ACC;
    }
    if (mode === ADDR_MODE.REGISTER) {
        CPU.R[CPU.EXT] = CPU.ACC;
    }
    if (mode === ADDR_MODE.IMMEDIATE) {

    }
};
ISA[OPC.RD] = (mode) => {
    let op = readOperand(mode, CPU.EXT);
    CPU.DR = U16(op);
    CPU.ACC = CPU.DR;
    CPU._updateZS(CPU.DR); //TODO
};
ISA[OPC.WRBR] = () => {
    CPU.BR = CPU.ACC;
};
ISA[OPC.WRSP] = () => {
    CPU.SP = CPU.ACC;
};

ISA[OPC.JMP] = (data) => {
    CPU.PC = data & 0x3FF;
};
ISA[OPC.JZ] = (data) => {
    if (CPU.getFlag(FLAG.Z)) {
        CPU.PC = data & 0x3FF;
    }
};
ISA[OPC.JNZ] = (data) => {
    if (!CPU.getFlag(FLAG.Z)) {
        CPU.PC = data & 0x3FF;
    }
};
ISA[OPC.JS] = (data) => {
    if (CPU.getFlag(FLAG.S)) {
        CPU.PC = data & 0x3FF;
    }
};
ISA[OPC.JNS] = (data) => {
    if (!CPU.getFlag(FLAG.S)) {
        CPU.PC = data & 0x3FF;
    }
};
ISA[OPC.JO] = (data) => {
    if (CPU.getFlag(FLAG.O)) {
        CPU.PC = data & 0x3FF;
    }
};
ISA[OPC.JNO] = (data) => {
    if (!CPU.getFlag(FLAG.O)) {
        CPU.PC = data & 0x3FF;
    }
};
// JNRZ TODO

/**
 * @param {number} mode  режим адресации (ADDR_MODE.*)
 * @param {number} arg   значение/номер регистра/адрес (обычно CPU.EXT)
 * @returns {number}
 */
function readOperand(mode, arg) {
    switch (mode) {
        // 000 DIRECT: x  -> MEM[x]
        case ADDR_MODE.DIRECT: {
            const addr = arg & 0x03FF;           // 10-bit addr space (1KB)
            return MEM.readIns(addr);
        }

        // 001 REGISTER: Rx
        case ADDR_MODE.REGISTER: {
            if (arg < 0 || arg >= CPU.R.length) throw new Error("Register must be 0..7");
            return CPU.R[arg];
        }

        // 010 IMMEDIATE: #x
        case ADDR_MODE.IMMEDIATE: {
            return U16(arg);
        }

        // 011 MEM_INDIRECT: @x -> MEM[ MEM[x] ]
        case ADDR_MODE.MEM_INDIRECT: {
            const addr = arg & 0x03FF;
            const ptr = MEM.readIns(addr) & 0x03FF;
            return MEM.readIns(ptr);
        }

        // 100 RELATIVE: [x] -> MEM[BR + x]
        case ADDR_MODE.RELATIVE: {
            const addr = EVEN((CPU.BR + arg) & 0xFFFF) & 0x03FF;
            return MEM.readIns(addr);
        }

        // 101 REG_INDIRECT: @Rx -> MEM[ R[x] ]
        case ADDR_MODE.REG_INDIRECT: {
            if (arg < 0 || arg >= CPU.R.length) throw new Error("Register must be 0..7");
            const ptr = CPU.R[arg] & 0x03FF;
            return MEM.readIns(ptr);
        }

        // 110 POST_INC: @Rx+ (сначала читаем, потом R += 2)
        case ADDR_MODE.POST_INC: {
            if (arg < 0 || arg >= CPU.R.length) throw new Error("Register must be 0..7");
            const ptr = CPU.R[arg] & 0x03FF;
            const value = MEM.readIns(ptr);
            CPU.R[arg] = EVEN((ptr + 2) & 0xFFFF);
            return value;
        }

        // 111 PRE_DEC: -@Rx (сначала R -= 2, потом читаем)
        case ADDR_MODE.PRE_DEC: {
            if (arg < 0 || arg >= CPU.R.length) throw new Error("Register must be 0..7");
            const ptr = EVEN((CPU.R[arg] - 2) & 0xFFFF) & 0x03FF;
            CPU.R[arg] = ptr;
            return MEM.readIns(ptr);
        }

        default:
            throw new Error(`Unknown addressing mode: ${mode}`);
    }
}



const MEM = new RAM(1024);
const CPU = new CPU_();

function assemble(src, origin = 0) {
    const blocks = parseASM(src);
    calcLabelBlockSizes(blocks, origin);
    const labels = {}

    let byteSize = 0;
    for (const [label, instructions] of Object.entries(blocks)) {
        labels[label] = blocks[label]['offset'];
        byteSize += blocks[label]['size'];
    }

    const buffer = new RAM(byteSize);
    let offset = 0;
    for (const [label, instructions] of Object.entries(blocks)) {
        //let offset = blocks[label]['offset'];

        for (const ins of instructions) {
            if (!ins.OPC || ins.OPC.length === 0) continue;
            let ins2 = assembleIns(ins['OPC'], ins['ARG'], ins['line'], labels);

            buffer[offset] = (ins2 >> 0) & 0xFF;
            buffer[offset+1] = (ins2 >> 8) & 0xFF;
            offset += 2;
            if (instrType(MNEMONIC[ins['OPC'].toUpperCase()]) === 2) {
                buffer[offset] = (ins2 >> 16) & 0xFF;
                buffer[offset+1] = (ins2 >> 24) & 0xFF;
                offset += 2;
            }
        }
    }

    for (let i = 0; i < byteSize; i++) {
        MEM[i+origin] = buffer[i];
        // console.log(`MEM[${i+origin}] = ${MEM[i+origin]}`)
    }
}
function assembleIns(mn, args, line, labels) {
    const opc = MNEMONIC[mn.toUpperCase()];
    const size = instrSizeBytes(opc);
    const type = instrType(opc);
    let ins = 0;

    if (instrOperands(opc) !== args.length) {
        throw new Error(
            `Invalid count of arguments in command ${mn} at line ${line}`
        );
    }

    if (type === 0) {
        ins = (opc<<10) & 0xFC00
    }

    if (type === 1) {
        ins = (opc<<10) & 0xFC00
        const op_param = instrOpSizeOffset(opc);
        let arg_count = 0;
        for (const param of op_param) {
            const mask = (1 << param.size) - 1;
            const arg = parseOperand(args[arg_count], labels);
            ins |= (arg.value << param.ofs) & (mask << param.ofs);

            arg_count += 1
        }
    }

    if (type === 2) {
        ins = (opc<<10) & 0xFC00
        const op_param = instrOpSizeOffset(opc);
        let arg_count = 0;

        // console.log(Array.isArray(op_param));
        // console.log(typeof op_param);
        // console.log(op_param);

        for (const param of op_param) {
            const arg = parseOperand(args[arg_count], labels);
            const mask = (1 << param.size) - 1;
            ins |= (arg.value << (param.ofs + 16)) & (mask << (param.ofs + 16));
            ins |= (arg.mode << 7) & 0x0380;

            arg_count += 1
        }
    }

    return ins;
}
function parseNumber(str) {
    if (/^-?0x[0-9a-f]+$/i.test(str)) {
        return parseInt(str, 16);
    }
    if (/^-?\d+$/.test(str)) {
        return parseInt(str, 10);
    }
    return null;
}
function parseOperand(arg, labels = {}) {
    if (typeof arg !== 'string' || arg.trim() === '') {
        throw new Error('Пустой аргумент инструкции');
    }

    arg = arg.trim();

    // ───────────── PRE DEC: -@R3
    let m = arg.match(/^-@R([0-7])$/i);
    if (m) {
        return {
            mode: ADDR_MODE.PRE_DEC,
            value: Number(m[1]),
        };
    }

    // ───────────── POST INC: @R3+
    m = arg.match(/^@R([0-7])\+$/i);
    if (m) {
        return {
            mode: ADDR_MODE.POST_INC,
            value: Number(m[1]),
        };
    }

    // ───────────── REG INDIRECT: @R3
    m = arg.match(/^@R([0-7])$/i);
    if (m) {
        return {
            mode: ADDR_MODE.REG_INDIRECT,
            value: Number(m[1]),
        };
    }

    // ───────────── MEM INDIRECT: @x
    if (arg.startsWith('@')) {
        const val = resolveValue(arg.slice(1), labels);
        return {
            mode: ADDR_MODE.MEM_INDIRECT,
            value: val,
        };
    }

    // ───────────── RELATIVE: [x]
    m = arg.match(/^\[(.+)\]$/);
    if (m) {
        const val = resolveValue(m[1], labels);
        return {
            mode: ADDR_MODE.RELATIVE,
            value: val,
        };
    }

    // ───────────── IMMEDIATE: #x
    if (arg.startsWith('#')) {
        const val = resolveValue(arg.slice(1), labels);
        return {
            mode: ADDR_MODE.IMMEDIATE,
            value: val,
        };
    }

    // ───────────── REGISTER: R3
    m = arg.match(/^R([0-7])$/i);
    if (m) {
        return {
            mode: ADDR_MODE.REGISTER,
            value: Number(m[1]),
        };
    }

    // ───────────── DIRECT: x / label
    const val = resolveValue(arg, labels);
    return {
        mode: ADDR_MODE.DIRECT,
        value: val,
    };
}
function resolveValue(token, labels) {
    token = token.trim();

    const num = parseNumber(token);
    if (num !== null) { return num; }

    if (token in labels) {
        return labels[token];
    }
    throw new Error(`Неизвестная метка: ${token}`);
}
function calcLabelBlockSizes(blocks, offset) {
    const result = {};

    for (const [label, instructions] of Object.entries(blocks)) {
        let size = 0;

        for (const ins of instructions) {
            size += instrSizeBytes(MNEMONIC[ins["OPC"].toUpperCase()]);
        }

        result[label] = size;
        blocks[label]['size'] = size;
        blocks[label]['offset'] = offset;
        offset += size;
    }

    return result;
}
function syntaxError(state, ch, line, context = "") {
    const shown = ch === "\n" ? "\\n" : ch === "\0" ? "EOF" : ch;
    throw new Error(
        `Syntax error at line ${line}: unexpected '${shown}' in state ${state}${context ? " (" + context + ")" : ""}`
    );
}
function parseASM(src) {
    // =======================
    // Состояния автомата
    // =======================
    const STR_START     = 0;
    const LABEL_OPCODE  = 1;
    const ARG_START     = 2;
    const ARG           = 3;
    const COMMA         = 4;
    const NEXT_ARG      = 5;
    const COMMENT       = 6;

    let STATE = STR_START;

    // =======================
    // Переменные автомата
    // =======================
    let TOKEN = "";
    let CURRENT_ARG = "";
    let CURRENT_ARGS = [];
    let CURRENT_OPC = "";

    let LAST_LABEL = "";
    let LINE_COUNT = 1; // Для пользователя нумерация с 1

    let INS_BLOCK = [];
    let INS_BLOCKS = {};

    // Добавляем EOF
    src += "\0";

    // =======================
    // Классы символов
    // =======================
    const isAlpha = c => /[A-Za-z]/.test(c);
    const isDigit = c => /[0-9]/.test(c);

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        const EOF = ch === "\0";

        switch (STATE) {

            // =====================================================
            // STR_START
            // =====================================================

            // STR_START + ALPHA
            case STR_START:
                if (isAlpha(ch)) {
                    TOKEN += ch;
                    STATE = LABEL_OPCODE;
                }
                // STR_START + " "
                else if (ch === " ") {
                    // stay
                }
                // STR_START + ";"
                else if (ch === ";") {
                    STATE = COMMENT;
                }
                // STR_START + "\n" || EOF
                else if (ch === "\n" || EOF) {
                    LINE_COUNT++;
                }
                else {
                    syntaxError("STR_START", ch, LINE_COUNT);
                }
                break;

            // =====================================================
            // LABEL_OPCODE
            // =====================================================

            // LABEL_OPCODE + ALPHA || DIGIT
            case LABEL_OPCODE:
                if (isAlpha(ch) || isDigit(ch)) {
                    TOKEN += ch;
                }
                // LABEL_OPCODE + ":"
                else if (ch === ":") {
                    INS_BLOCKS[LAST_LABEL] = INS_BLOCK;
                    INS_BLOCK = [];
                    LAST_LABEL = TOKEN;
                    TOKEN = "";
                    STATE = STR_START;
                }
                // LABEL_OPCODE + " "
                else if (ch === " ") {
                    CURRENT_OPC = TOKEN;
                    TOKEN = "";
                    STATE = ARG_START;
                }
                // LABEL_OPCODE + ";"
                else if (ch === ";") {
                    CURRENT_OPC = TOKEN;
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: [], line: LINE_COUNT});
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    STATE = COMMENT;
                }
                // LABEL_OPCODE + "\n" || EOF
                else if (ch === "\n" || EOF) {
                    CURRENT_OPC = TOKEN;
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: [], line: LINE_COUNT });
                    TOKEN = "";
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    LINE_COUNT++;
                    STATE = STR_START;
                }
                else {
                    syntaxError("LABEL_OPCODE", ch, LINE_COUNT);
                }
                break;

            // =====================================================
            // ARG_START
            // =====================================================

            // ARG_START + " "
            case ARG_START:
                if (ch === " ") {
                    // skip
                }
                // ARG_START + ";"
                else if (ch === ";") {
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    STATE = COMMENT;
                }
                // ARG_START + "\n" || EOF
                else if (ch === "\n" || EOF) {
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    LINE_COUNT++;
                    STATE = STR_START;
                }
                // ARG_START + ALPHA || "#" || "-" || "@" || "[" || DIGIT
                else if (
                    isAlpha(ch) ||
                    isDigit(ch) ||
                    ch === "#" ||
                    ch === "-" ||
                    ch === "@" ||
                    ch === "["
                ) {
                    CURRENT_ARG += ch;
                    STATE = ARG;
                }
                else {
                    syntaxError("ARG_START", ch, LINE_COUNT);
                }
                break;

            // =====================================================
            // ARG
            // =====================================================

            // ARG + ALPHA || "@" || DIGIT || "]" || "-" || "+"
            case ARG:
                if (
                    isAlpha(ch) ||
                    isDigit(ch) ||
                    ch === "@" ||
                    ch === "]" ||
                    ch === "-" ||
                    ch === "+"
                ) {
                    CURRENT_ARG += ch;
                }
                // ARG + " "
                else if (ch === " ") {
                    CURRENT_ARGS.push(CURRENT_ARG);
                    CURRENT_ARG = "";
                    STATE = COMMA;
                }
                // ARG + ","
                else if (ch === ",") {
                    CURRENT_ARGS.push(CURRENT_ARG);
                    CURRENT_ARG = "";
                    STATE = NEXT_ARG;
                }
                // ARG + ";"
                else if (ch === ";") {
                    CURRENT_ARGS.push(CURRENT_ARG);
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    STATE = COMMENT;
                }
                // ARG + "\n" || EOF
                else if (ch === "\n" || EOF) {
                    CURRENT_ARGS.push(CURRENT_ARG);
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    LINE_COUNT++;
                    STATE = STR_START;
                }
                else {
                    syntaxError("ARG", ch, LINE_COUNT);
                }
                break;

            // =====================================================
            // COMMA
            // =====================================================

            // COMMA + " "
            case COMMA:
                if (ch === " ") {
                    // skip
                }
                // COMMA + ","
                else if (ch === ",") {
                    STATE = NEXT_ARG;
                }
                // COMMA + ";"
                else if (ch === ";") {
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    STATE = COMMENT;
                }
                // COMMA + "\n" || EOF
                else if (ch === "\n" || EOF) {
                    INS_BLOCK.push({ OPC: CURRENT_OPC, ARG: CURRENT_ARGS, line: LINE_COUNT });
                    CURRENT_OPC = "";
                    CURRENT_ARGS = [];
                    CURRENT_ARG = "";
                    LINE_COUNT++;
                    STATE = STR_START;
                }
                break;

            // =====================================================
            // NEXT_ARG
            // =====================================================

            // NEXT_ARG + " "
            case NEXT_ARG:
                if (ch === " ") {
                    // skip
                }
                // NEXT_ARG + ALPHA || "#" || "-" || "@" || "[" || DIGIT
                else if (
                    isAlpha(ch) ||
                    isDigit(ch) ||
                    ch === "#" ||
                    ch === "-" ||
                    ch === "@" ||
                    ch === "["
                ) {
                    CURRENT_ARG += ch;
                    STATE = ARG;
                }
                else {
                    syntaxError("NEXT_ARG", ch, LINE_COUNT);
                }
                break;

            // =====================================================
            // COMMENT
            // =====================================================

            // COMMENT + ANY && !"\n" && !EOF
            case COMMENT:
                if (ch !== "\n" && !EOF) {
                    // ignore
                }
                // COMMENT + "\n" || EOF
                else {
                    LINE_COUNT++;
                    STATE = STR_START;
                }

                break;
        }
    }

    // сохранить последний блок
    if (INS_BLOCK.length) {
        INS_BLOCKS[LAST_LABEL] = INS_BLOCK;
    }

    return INS_BLOCKS;
}

const SEP = "─".repeat(60);
function pretty(obj) {
    return JSON.stringify(obj, null, 2);
}
function printTitle(title) {
    console.log("\n" + SEP);
    console.log(`🧪 ${title}`);
    console.log(SEP);
}
function printSection(name, content) {
    console.log(`\n▶ ${name}`);
    console.log(content);
}

function runTest(name, src) {
    printTitle(name);

    printSection("SOURCE", src.replace(/\0/g, ""));

    try {
        const result = parseASM(src);
        printSection("PARSED RESULT", pretty(result));
    } catch (e) {
        printSection("ERROR", e.message);
    }
}
function runTests() {
    runTest(
        "Simple instructions",
        `NOP
HLT
`
    );
    runTest(
        "Instruction with arguments",
        `ADD R1, R2
SUB #10
`
    );
    runTest(
        "Inline comments",
        `ADD R1, R2 ; сложение
SUB #10     ; вычитание
`
    );
    runTest(
        "Labels and blocks",
        `start:
    ADD R1, #5
    JMP end

end:
    HLT
`
    );
    runTest(
        "Complex arguments (raw)",
        `LOAD @R1
STORE [label]
ADD -5
ADD #-10
`
    );
    runTest(
        "Whitespace stress test",
        `

   ADD    R1   ,    R2   

   ; только комментарий

   HLT

`
    );
    runTest(
        "Single argument",
        `JMP label
`
    );
    runTest(
        "EOF without newline",
        `ADD R1, R2`
    );
}


function section(title) {
    console.log(`\n${SEP}`);
    console.log(`🧪 ${title}`);
    console.log(SEP);
}
function ok(msg) {
    console.log(`✅ ${msg}`);
}
function fail(msg, err) {
    console.error(`❌ ${msg}`);
    if (err) console.error("   ", err.message);
}
function expectEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }
}

function expectThrows(fn, msg) {
    let thrown = false;
    try { fn(); }
    catch { thrown = true; }
    if (!thrown) throw new Error(`${msg}: expected exception`);
}
function bigCPUTest() {
    section("BIG CPU INTEGRATION TEST");

    // ───── Reset CPU & Memory ─────
    MEM.mem.fill(0);
    CPU.rf.fill(0);
    CPU.halted = false;
    CPU.SP = 0x03FE;

    // ───── Assemble program ─────
    assemble(`
        MOV R0, R0
        ADD #1
        MOV R1, R0

        WR R0
        ADD #5
        SUB #1
        WR R0
        MOV R2, R0 ; R2 = 5
        RD #1 ; ACC = 1
        WR R4 ; R4 = ACC

loop:
        MOV R0, R1
        RD R4 ; ACC = R4
        MUL R2
        WR R4 ; R4 = ACC
        MOV R1, R0

        MOV R0, R2
        RD R2
        DEC
        WR R2
        WR R0
        ; MOV R2, R0
        RD R2

        CMP #0
        JZ end
        JMP loop

end:
        MOV R0, R1
        RD R4
        PUSH
        POP
        HLT
    `, 0x20);

    CPU.PC = 0x20;

    // ───── Run program ─────
    CPU.run(500);

    // ───── Assertions ─────
    try {
        expectEqual(CPU.ACC, 120, "Factorial result");
        expectEqual(CPU.R[1], 120, "Result register");
        expectEqual(CPU.R[2], 0, "Counter finished");
        expectEqual(CPU.SP, 0x03FE, "Stack balanced");
        expectEqual(CPU.halted, true, "CPU halted");

        ok("BIG CPU TEST PASSED 🎉");
    } catch (e) {
        fail("BIG CPU TEST FAILED", e);
        console.log("Final CPU snapshot:", CPU.snapshot());
    }
}
// assemble(`
// start:  ADD #4
//         MOV R1, R2
//         ADD @R3+
//         ADD -@R4
//         ADD [2]
//         JZ ok
// ok:     HLT
//
// `, 0x20);

//runTests();
//bigCPUTest()

//CPU.PC = 0x20;
//CPU.run();

console.log(CPU.ACC);