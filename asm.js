import {
  ADDR_MODE,
  MEM,
  MNEMONIC,
  RAM,
  instrOpSizeOffset,
  instrOperands,
  instrSizeBytes,
  instrType,
} from "./cpu.js";

function assemble(src, origin = 0, mem = MEM) {
  const blocks = parseASM(src);
  calcLabelBlockSizes(blocks, origin);
  const labels = {};

  let byteSize = 0;
  for (const [label, instructions] of Object.entries(blocks)) {
    labels[label] = blocks[label].offset;
    byteSize += blocks[label].size;
  }

  const buffer = new RAM(byteSize);
  let offset = 0;
  for (const instructions of Object.values(blocks)) {
    for (const ins of instructions) {
      if (!ins.OPC || ins.OPC.length === 0) continue;
      const insWord = assembleIns(ins.OPC, ins.ARG, ins.line, labels);

      buffer[offset] = (insWord >> 0) & 0xff;
      buffer[offset + 1] = (insWord >> 8) & 0xff;
      offset += 2;

      if (instrType(MNEMONIC[ins.OPC.toUpperCase()]) === 2) {
        buffer[offset] = (insWord >> 16) & 0xff;
        buffer[offset + 1] = (insWord >> 24) & 0xff;
        offset += 2;
      }
    }
  }

  for (let i = 0; i < byteSize; i++) {
    mem[i + origin] = buffer[i];
  }
}

function assembleIns(mn, args, line, labels) {
  const opc = MNEMONIC[mn.toUpperCase()];
  const type = instrType(opc);
  let ins = 0;

  if (instrOperands(opc) !== args.length) {
    throw new Error(`Invalid count of arguments in command ${mn} at line ${line}`);
  }

  if (type === 0) {
    ins = (opc << 10) & 0xfc00;
  }

  if (type === 1) {
    ins = (opc << 10) & 0xfc00;
    const opParam = instrOpSizeOffset(opc);
    let argCount = 0;

    for (const param of opParam) {
      const mask = (1 << param.size) - 1;
      const arg = parseOperand(args[argCount], labels);
      ins |= (arg.value << param.ofs) & (mask << param.ofs);
      argCount += 1;
    }
  }

  if (type === 2) {
    ins = (opc << 10) & 0xfc00;
    const opParam = instrOpSizeOffset(opc);
    let argCount = 0;

    for (const param of opParam) {
      const arg = parseOperand(args[argCount], labels);
      const mask = (1 << param.size) - 1;
      ins |= (arg.value << (param.ofs + 16)) & (mask << (param.ofs + 16));
      ins |= (arg.mode << 7) & 0x0380;
      argCount += 1;
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
  if (typeof arg !== "string" || arg.trim() === "") {
    throw new Error("Пустой аргумент инструкции");
  }

  const token = arg.trim();

  let match = token.match(/^-@R([0-7])$/i);
  if (match) {
    return { mode: ADDR_MODE.PRE_DEC, value: Number(match[1]) };
  }

  match = token.match(/^@R([0-7])\+$/i);
  if (match) {
    return { mode: ADDR_MODE.POST_INC, value: Number(match[1]) };
  }

  match = token.match(/^@R([0-7])$/i);
  if (match) {
    return { mode: ADDR_MODE.REG_INDIRECT, value: Number(match[1]) };
  }

  if (token.startsWith("@")) {
    return { mode: ADDR_MODE.MEM_INDIRECT, value: resolveValue(token.slice(1), labels) };
  }

  match = token.match(/^\[(.+)\]$/);
  if (match) {
    return { mode: ADDR_MODE.RELATIVE, value: resolveValue(match[1], labels) };
  }

  if (token.startsWith("#")) {
    return { mode: ADDR_MODE.IMMEDIATE, value: resolveValue(token.slice(1), labels) };
  }

  match = token.match(/^R([0-7])$/i);
  if (match) {
    return { mode: ADDR_MODE.REGISTER, value: Number(match[1]) };
  }

  return { mode: ADDR_MODE.DIRECT, value: resolveValue(token, labels) };
}

function resolveValue(token, labels) {
  const trimmed = token.trim();
  const num = parseNumber(trimmed);
  if (num !== null) {
    return num;
  }
  if (trimmed in labels) {
    return labels[trimmed];
  }
  throw new Error(`Неизвестная метка: ${trimmed}`);
}

function calcLabelBlockSizes(blocks, offset) {
  for (const instructions of Object.values(blocks)) {
    let size = 0;
    for (const ins of instructions) {
      size += instrSizeBytes(MNEMONIC[ins.OPC.toUpperCase()]);
    }
    instructions.size = size;
    instructions.offset = offset;
    offset += size;
  }
}

function syntaxError(state, ch, line, context = "") {
  const shown = ch === "\n" ? "\\n" : ch === "\0" ? "EOF" : ch;
  throw new Error(
    `Syntax error at line ${line}: unexpected '${shown}' in state ${state}${context ? ` (${context})` : ""}`
  );
}

function parseASM(src) {
  const STR_START = 0;
  const LABEL_OPCODE = 1;
  const ARG_START = 2;
  const ARG = 3;
  const COMMA = 4;
  const NEXT_ARG = 5;
  const COMMENT = 6;

  let state = STR_START;

  let token = "";
  let currentArg = "";
  let currentArgs = [];
  let currentOpc = "";

  let lastLabel = "";
  let lineCount = 1;

  let insBlock = [];
  const insBlocks = {};

  src += "\0";

  const isAlpha = (c) => /[A-Za-z]/.test(c);
  const isDigit = (c) => /[0-9]/.test(c);

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const eof = ch === "\0";

    switch (state) {
      case STR_START:
        if (isAlpha(ch)) {
          token += ch;
          state = LABEL_OPCODE;
        } else if (ch === " ") {
          // skip
        } else if (ch === ";") {
          state = COMMENT;
        } else if (ch === "\n" || eof) {
          lineCount++;
        } else {
          syntaxError("STR_START", ch, lineCount);
        }
        break;

      case LABEL_OPCODE:
        if (isAlpha(ch) || isDigit(ch)) {
          token += ch;
        } else if (ch === ":") {
          insBlocks[lastLabel] = insBlock;
          insBlock = [];
          lastLabel = token;
          token = "";
          state = STR_START;
        } else if (ch === " ") {
          currentOpc = token;
          token = "";
          state = ARG_START;
        } else if (ch === ";") {
          currentOpc = token;
          insBlock.push({ OPC: currentOpc, ARG: [], line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          state = COMMENT;
        } else if (ch === "\n" || eof) {
          currentOpc = token;
          insBlock.push({ OPC: currentOpc, ARG: [], line: lineCount });
          token = "";
          currentOpc = "";
          currentArgs = [];
          lineCount++;
          state = STR_START;
        } else {
          syntaxError("LABEL_OPCODE", ch, lineCount);
        }
        break;

      case ARG_START:
        if (ch === " ") {
          // skip
        } else if (ch === ";") {
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          state = COMMENT;
        } else if (ch === "\n" || eof) {
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          lineCount++;
          state = STR_START;
        } else if (isAlpha(ch) || isDigit(ch) || ch === "#" || ch === "-" || ch === "@" || ch === "[") {
          currentArg += ch;
          state = ARG;
        } else {
          syntaxError("ARG_START", ch, lineCount);
        }
        break;

      case ARG:
        if (isAlpha(ch) || isDigit(ch) || ch === "@" || ch === "]" || ch === "-" || ch === "+") {
          currentArg += ch;
        } else if (ch === " ") {
          currentArgs.push(currentArg);
          currentArg = "";
          state = COMMA;
        } else if (ch === ",") {
          currentArgs.push(currentArg);
          currentArg = "";
          state = NEXT_ARG;
        } else if (ch === ";") {
          currentArgs.push(currentArg);
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          state = COMMENT;
        } else if (ch === "\n" || eof) {
          currentArgs.push(currentArg);
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          lineCount++;
          state = STR_START;
        } else {
          syntaxError("ARG", ch, lineCount);
        }
        break;

      case COMMA:
        if (ch === " ") {
          // skip
        } else if (ch === ",") {
          state = NEXT_ARG;
        } else if (ch === ";") {
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          state = COMMENT;
        } else if (ch === "\n" || eof) {
          insBlock.push({ OPC: currentOpc, ARG: currentArgs, line: lineCount });
          currentOpc = "";
          currentArgs = [];
          currentArg = "";
          lineCount++;
          state = STR_START;
        }
        break;

      case NEXT_ARG:
        if (ch === " ") {
          // skip
        } else if (isAlpha(ch) || isDigit(ch) || ch === "#" || ch === "-" || ch === "@" || ch === "[") {
          currentArg += ch;
          state = ARG;
        } else {
          syntaxError("NEXT_ARG", ch, lineCount);
        }
        break;

      case COMMENT:
        if (ch !== "\n" && !eof) {
          // ignore
        } else {
          lineCount++;
          state = STR_START;
        }
        break;

      default:
        break;
    }
  }

  if (insBlock.length) {
    insBlocks[lastLabel] = insBlock;
  }

  return insBlocks;
}

export { assemble, parseASM };
