import {
    ADDR_MODE,
    MNEMONIC,
    instrOpSizeOffset,
    instrOperands,
    instrType,
} from "./cpu.js";

/**
 * Обратная таблица: opcode -> mnemonic
 */
const OPCODE_TO_MNEMONIC = Object.fromEntries(
    Object.entries(MNEMONIC).map(([mn, opc]) => [opc, mn])
);

/**
 * Красивый вывод числа.
 * Можно заменить на просто value.toString() если hex не нужен.
 */
function fmtWord(value) {
    const v = value & 0xffff;
    return "0x" + v.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Форматирование одного операнда type=2 по mode + value
 */
function formatOperand(mode, value) {
    const v = value & 0xffff;

    switch (mode) {
        case ADDR_MODE.DIRECT:
            return fmtWord(v);

        case ADDR_MODE.REGISTER:
            return `R${v & 0x7}`;

        case ADDR_MODE.IMMEDIATE:
            return `#${fmtWord(v)}`;

        case ADDR_MODE.MEM_INDIRECT:
            return `@${fmtWord(v)}`;

        case ADDR_MODE.RELATIVE:
            return `[${fmtWord(v)}]`;

        case ADDR_MODE.REG_INDIRECT:
            return `@R${v & 0x7}`;

        case ADDR_MODE.POST_INC:
            return `@R${v & 0x7}+`;

        case ADDR_MODE.PRE_DEC:
            return `-@R${v & 0x7}`;

        default:
            return `<?>(${mode}:${fmtWord(v)})`;
    }
}

/**
 * Дизассемблинг одной инструкции.
 *
 * @param {number} inr - 16-битное основное слово инструкции
 * @param {number} ext - 16-битное расширение (для type=2), можно 0
 * @returns {string}
 */
function disassembleInstruction(inr, ext = 0) {
    inr &= 0xffff;
    ext &= 0xffff;

    const opcode = (inr >> 10) & 0x3f;
    const mnemonic = OPCODE_TO_MNEMONIC[opcode];

    if (mnemonic == null) {
        return `DW ${fmtWord(inr)}${ext ? ` ; EXT=${fmtWord(ext)}` : ""}`;
    }

    const type = instrType(opcode);

    // type 0: без аргументов
    if (type === 0) {
        return mnemonic;
    }

    // type 1: короткая инструкция с параметрами в INR
    if (type === 1) {
        const params = instrOpSizeOffset(opcode);
        const args = [];

        for (const param of params) {
            const mask = (1 << param.size) - 1;
            const value = (inr >> param.ofs) & mask;

            // здесь можно при желании делать более "умный" вывод
            // по opcode, но пока универсально:
            args.push(formatType1Operand(opcode, value, param));
        }

        return args.length ? `${mnemonic} ${args.join(", ")}` : mnemonic;
    }

    // type 2: адресация в INR, операнд в EXT
    if (type === 2) {
        const mode = (inr >> 7) & 0x7;
        const argc = instrOperands(opcode);

        if (argc === 0) {
            return mnemonic;
        }

        // В твоём текущем assembler для type=2 фактически используется
        // один операнд с mode + value(EXT)
        const arg = formatOperand(mode, ext);
        return `${mnemonic} ${arg}`;
    }

    return `DW ${fmtWord(inr)} ; unknown type`;
}

/**
 * Форматирование аргументов коротких инструкций type=1
 */
function formatType1Operand(opcode, value, param) {
    const mnemonic = OPCODE_TO_MNEMONIC[opcode];

    // MOV кодируется как два регистра по 3 бита
    if (mnemonic === "MOV") {
        return `R${value & 0x7}`;
    }

    // Для INT обычно удобно печатать число прерывания
    if (mnemonic === "INT") {
        return String(value);
    }

    // Для переходов / CALL обычно удобнее hex-адрес
    if (["JMP", "JZ", "JNZ", "JS", "JNS", "JO", "JNO", "JNRZ", "CALL"].includes(mnemonic)) {
        return fmtWord(value);
    }

    // По умолчанию — число в hex
    return fmtWord(value);
}

export { disassembleInstruction };