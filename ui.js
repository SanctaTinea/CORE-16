import {
  CPU,
  FLAG,
  HEX,
  MEM,
  decodeInstruction,
  instrType,
  readWord,
  writeWord,
} from "./cpu.js";
import { assemble } from "./asm.js";
import { disassembleInstruction } from "./disasm.js";

const REG_NAMES = [
  "ACC",
  "DR",
  "PC",
  "INR",
  "EXT",
  "SP",
  "BR",
  "AR",
  "MAR",
  "MDR",
  "IN",
  "OUT",
  "FLAGS",
  "R0",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "OPC",
  "ADT",
  "ARG",
  "RAR",
  "RDR",
];

const FLAG_MAP = [
  { id: "flagZ", mask: FLAG.Z },
  { id: "flagS", mask: FLAG.S },
  { id: "flagO", mask: FLAG.O },
  { id: "flagI", mask: FLAG.I },
  { id: "flagE", mask: FLAG.E },
];

const DISPLAY_ONLY = new Set(["INR", "EXT", "OPC", "ADT", "EXF", "ARG", "MAR", "MDR", "RAR", 'RDR',
  "OUT"]);

function parseValue(text) {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return parseInt(trimmed, 16);
  }
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return null;
}

function formatHex(value, digits = 4) {
  return HEX(value, digits);
}

function getSourceValue() {
  const source = document.getElementById("source");
  return source?.value ?? "";
}

function setLog(message, isError = false) {
  const log = document.getElementById("log");
  const messageDiv = document.createElement("div");
  if (!log) return;

  messageDiv.textContent = message;
  if (isError)   {
    messageDiv.classList.add("error");
  }

  log.appendChild(messageDiv);
  // log.textContent = message;
  // log.classList.toggle("error", isError);
}

function buildMemTable() {
  const tbody = document.getElementById("memBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let expectOperand = false;
  const wordCount = MEM.mem.length / 2;

  for (let i = 0; i < wordCount; i += 1) {
    const address = i * 2;
    const word = readWord(MEM, address);

    let mnemonic = "";
    if (expectOperand) {
      mnemonic = "EXT";
      expectOperand = false;
    } else {
      const decoded = decodeInstruction(word);
      mnemonic = decoded.mnemonic;
      if (address + 2 < MEM.mem.length) {
        mnemonic = disassembleInstruction(word, readWord(MEM, address + 2));
      }
      else {
        mnemonic = disassembleInstruction(word, 0);
      }
      if (instrType(decoded.opc) === 2) {
        expectOperand = true;
      }
    }

    const row = document.createElement("div");
    row.className = "row";
    row.dataset.address = String(address);

    const addrCell = document.createElement("span");
    addrCell.textContent = formatHex(address, 4);

    const mnemonicCell = document.createElement("span");
    mnemonicCell.textContent = mnemonic;

    const valueCell = document.createElement("span");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "mem-value";
    input.value = formatHex(word, 4);
    input.dataset.address = String(address);
    input.addEventListener("change", onMemEdit);
    valueCell.appendChild(input);

    row.appendChild(addrCell);
    row.appendChild(mnemonicCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
  }
}

function highlightPC() {
  const tbody = document.getElementById("memBody");
  if (!tbody) return;
  tbody.querySelectorAll("div").forEach((row) => {
    row.classList.toggle("current", Number(row.dataset.address) === CPU.PC);
  });
}

function onMemEdit(event) {
  if (isRunning) return;
  const input = event.target;
  const address = Number(input.dataset.address);
  const parsed = parseValue(input.value);
  if (parsed === null) {
    input.value = formatHex(readWord(MEM, address), 4);
    return;
  }
  writeWord(MEM, address, parsed);
  //MEM.mem[address] = parsed;
  //MEM.mem[address] = parseInt(input.value.trim(), 16) & 0xFF;
  refreshMemoryViews();
}

function byteToAscii(byte) {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
}

function buildHexTable() {
  const hexBody = document.getElementById("hexBody");
  if (!hexBody) return;

  hexBody.innerHTML = "";

  const bytes = MEM.mem;
  const bytesPerRow = 16;

  for (let base = 0; base < bytes.length; base += bytesPerRow) {
    const row = document.createElement("div");
    row.className = "hex-row";
    row.dataset.base = String(base);

    const addr = document.createElement("span");
    addr.textContent = `${base.toString(16).toUpperCase().padStart(4, "0")}:`;
    row.appendChild(addr);

    //console.log(base, base / bytesPerRow, CPU.PC, CPU.PC / bytesPerRow)

    if (Math.floor(base / bytesPerRow) === Math.floor(CPU.PC / bytesPerRow)) {
      row.classList.add("selected");
    }

    let ascii = "";

    for (let i = 0; i < bytesPerRow; i += 1) {
      const address = base + i;
      const value = bytes[address] ?? 0;

      const cell = document.createElement("input");
      cell.type = "text";
      cell.maxLength = 2;
      cell.className = "hex-byte";
      cell.value = value.toString(16).toUpperCase().padStart(2, "0");
      cell.dataset.address = String(address);

      if (address === CPU.PC) {
        cell.classList.add("pc-byte");
      }
      if (address === CPU.MAR) {
        cell.classList.add("mar-byte");
      }

      cell.addEventListener("change", onHexEdit);
      row.appendChild(cell);

      ascii += byteToAscii(value);
    }

    const asciiCell = document.createElement("span");
    asciiCell.className = "ascii-col";
    asciiCell.textContent = ascii;
    row.appendChild(asciiCell);

    hexBody.appendChild(row);
  }
}

function flashHexCell(address) {
  const cell = document.querySelector(`.hex-byte[data-address="${address}"]`);
  if (!cell) return;
  cell.classList.remove("changed");
  void cell.offsetWidth;
  cell.classList.add("changed");
}

function onHexEdit(event) {
  if (isRunning) return;

  const input = event.target;
  const address = Number(input.dataset.address);
  const value = input.value.trim();

  if (!/^[0-9a-fA-F]{1,2}$/.test(value)) {
    input.value = (MEM.mem[address] ?? 0).toString(16).toUpperCase().padStart(2, "0");
    return;
  }

  MEM.mem[address] = parseInt(value, 16) & 0xFF;

  refreshMemoryViews();
}

function refreshMemoryViews() {
  buildMemTable();
  buildHexTable();
  highlightPC();
}

function updateRegisters() {
  for (const name of REG_NAMES) {
    const element = document.getElementById(name);
    if (!element) continue;

    let value = 0;
    if (name.startsWith("R")) {
      const idx = Number(name.slice(1));
      value = CPU.R[idx];
    } else {
      value = CPU[name];
    }

    element.value = formatHex(value, 4);
  }

  const instruction = decodeInstruction(CPU.INR);
  const opcField = document.getElementById("OPC");
  if (opcField) opcField.value = `0x${instruction.opc.toString(16).toUpperCase().padStart(2, "0")}`;
  const adtField = document.getElementById("ADT");
  if (adtField) adtField.value = `0x${instruction.am.toString(16).toUpperCase()}`;
  const exfField = document.getElementById("EXF");
  if (exfField) exfField.value = "0";
  const argField = document.getElementById("ARG");
  if (argField) argField.value = formatHex(instruction.data, 4);

  for (const flag of FLAG_MAP) {
    const cell = document.getElementById(flag.id);
    if (!cell) continue;
    if (CPU.getFlag(flag.mask)) {
      cell.textContent = flag.id[4] + " 1";
      cell.classList.add("active");
    }
    else {
      cell.textContent = flag.id[4] + " 0";
      cell.classList.remove("active");
    }
  }
}

function bindRegisterInputs() {
  for (const name of REG_NAMES) {
    const element = document.getElementById(name);
    if (!element || DISPLAY_ONLY.has(name)) continue;

    element.addEventListener("change", () => {
      if (isRunning) return;
      const parsed = parseValue(element.value);
      if (parsed === null) {
        updateRegisters();
        return;
      }

      if (name.startsWith("R")) {
        const idx = Number(name.slice(1));
        CPU.R[idx] = parsed;
      } else {
        CPU[name] = parsed;
      }
      updateRegisters();
      highlightPC();
    });
  }
}

function setRunningState(running) {
  const source = document.getElementById("source");
  const assembleBtn = document.getElementById("assemble");
  const resetBtn = document.getElementById("resetBtn");
  const clearMemBtn = document.getElementById("clearMemBtn");
  const clearRegBtn = document.getElementById("clearRegBtn");
  const memInputs = document.querySelectorAll(".mem-value");

  if (source) {
    source.setAttribute("contenteditable", String(!running));
    source.classList.toggle("disabled", running);
  }
  if (assembleBtn) assembleBtn.disabled = running;
  if (resetBtn) resetBtn.disabled = running;
  if (clearMemBtn) clearMemBtn.disabled = running;
  if (clearRegBtn) clearRegBtn.disabled = running;

  for (const name of REG_NAMES) {
    const element = document.getElementById(name);
    if (!element) continue;
    if (DISPLAY_ONLY.has(name)) {
      element.disabled = true;
      continue;
    }
    element.disabled = running;
  }

  memInputs.forEach((input) => {
    input.disabled = running;
  });
}

function updateLineNumbers() {
  const source = document.getElementById("source");
  const lineNumbers = document.getElementById("lineNumbers");
  if (!source || !lineNumbers) return;

  const lineCount = source.value.split("\n").length;
  let lines = "";

  for (let i = 1; i <= lineCount; i += 1) {
    lines += i + "\n";
  }

  lineNumbers.textContent = lines;
}

function syncLineNumbersScroll() {
  const source = document.getElementById("source");
  const lineNumbers = document.getElementById("lineNumbers");
  if (!source || !lineNumbers) return;

  lineNumbers.style.transform = `translateY(${-source.scrollTop}px)`;
}

function initEditorLineNumbers() {
  const source = document.getElementById("source");
  if (!source) return;

  source.addEventListener("input", updateLineNumbers);
  source.addEventListener("scroll", syncLineNumbersScroll);

  updateLineNumbers();
  syncLineNumbersScroll();
}

function onAssemble() {
  if (isRunning) return;
  try {
    assemble(getSourceValue(), 0, MEM);
    refreshMemoryViews();
    setLog("Сборка завершена без ошибок.");
  } catch (error) {
    setLog(error.message, true);
  }
}

function scrollToPC() {
  const currentRow = document.querySelector(`#memBody .row.current`);
  currentRow?.scrollIntoView({ block: "center", behavior: "smooth" });

  const pcHex = document.querySelector(`.hex-byte[data-address="${CPU.PC}"]`);
  pcHex?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
}

function onStep() {
  if (isRunning) return;
  CPU.step();
  updateRegisters();
  refreshMemoryViews();
  scrollToPC();
}

async function onRun() {
  if (isRunning) return;
  isRunning = true;
  setRunningState(true);
  CPU.halted = false;

  await CPU.run({
    max: 100000,
    intervalMs: 50,
    onStep: () => {
      updateRegisters();
      //highlightPC();
      refreshMemoryViews();
      //scrollToPC();
    },
  });

  isRunning = false;
  setRunningState(false);
  updateRegisters();
  refreshMemoryViews();
  //highlightPC();
}

function onStop() {
  CPU.halted = true;
}

function onReset() {
  if (isRunning) return;
  MEM.clear();
  CPU.reset();
  refreshMemoryViews();
  updateRegisters();
  setLog("ОЗУ очищено, регистры сброшены.");
}

function onClearMem() {
  if (isRunning) return;
  MEM.clear();
  refreshMemoryViews();
  updateRegisters();
  setLog("ОЗУ очищено.");
}

function onClearReg() {
  if (isRunning) return;
  CPU.reset();
  refreshMemoryViews();
  updateRegisters();
  setLog("Регистры сброшены.");
}

function onClearCon() {
  const log = document.getElementById("log");
  log.replaceChildren();

  setLog("Консоль была очищена.");
}

let isRunning = false;

function initUI() {
  const assembleBtn = document.getElementById("assemble");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");
  const clearMemBtn = document.getElementById("clearMemBtn");
  const clearRegBtn = document.getElementById("clearRegBtn");
  const clearConBtn = document.getElementById("clearConBtn");

  assembleBtn?.addEventListener("click", onAssemble);
  stepBtn?.addEventListener("click", onStep);
  runBtn?.addEventListener("click", onRun);
  stopBtn?.addEventListener("click", onStop);
  resetBtn?.addEventListener("click", onReset);
  clearMemBtn?.addEventListener("click", onClearMem);
  clearRegBtn?.addEventListener("click", onClearReg);
  clearConBtn?.addEventListener("click", onClearCon);

  bindRegisterInputs();
  refreshMemoryViews();
  updateRegisters();
  setRunningState(false);

  initEditorLineNumbers();
}

export { initUI };
