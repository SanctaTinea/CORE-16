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
];

const FLAG_MAP = [
  { id: "flagZ", mask: FLAG.Z },
  { id: "flagS", mask: FLAG.S },
  { id: "flagO", mask: FLAG.O },
  { id: "flagI", mask: FLAG.I },
  { id: "flagH", mask: FLAG.H },
];

const DISPLAY_ONLY = new Set(["INR", "EXT", "OPC", "ADT", "EXF", "ARG"]);

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
  return source?.innerText ?? "";
}

function setLog(message, isError = false) {
  const log = document.getElementById("log");
  if (!log) return;
  log.textContent = message;
  log.classList.toggle("log-error", isError);
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
      if (instrType(decoded.opc) === 2) {
        expectOperand = true;
      }
    }

    const row = document.createElement("tr");
    row.dataset.address = String(address);

    const addrCell = document.createElement("td");
    addrCell.textContent = formatHex(address, 4);

    const mnemonicCell = document.createElement("td");
    mnemonicCell.textContent = mnemonic;

    const valueCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "mem-input";
    input.value = formatHex(word, 4);
    input.dataset.address = String(address);
    input.addEventListener("change", onMemEdit);
    valueCell.appendChild(input);

    row.appendChild(addrCell);
    row.appendChild(mnemonicCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
  }

  highlightPC();
}

function highlightPC() {
  const tbody = document.getElementById("memBody");
  if (!tbody) return;
  tbody.querySelectorAll("tr").forEach((row) => {
    row.classList.toggle("mem-active", Number(row.dataset.address) === CPU.PC);
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
  buildMemTable();
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
    cell.textContent = CPU.getFlag(flag.mask) ? "1" : "0";
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
  const clearBtn = document.getElementById("clearMem");
  const memInputs = document.querySelectorAll(".mem-input");

  if (source) {
    source.setAttribute("contenteditable", String(!running));
    source.classList.toggle("disabled", running);
  }
  if (assembleBtn) assembleBtn.disabled = running;
  if (clearBtn) clearBtn.disabled = running;

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

function onAssemble() {
  if (isRunning) return;
  try {
    assemble(getSourceValue(), 0, MEM);
    buildMemTable();
    setLog("Сборка завершена без ошибок.");
  } catch (error) {
    setLog(error.message, true);
  }
}

function onStep() {
  if (isRunning) return;
  CPU.step();
  updateRegisters();
  buildMemTable();
}

async function onRun() {
  if (isRunning) return;
  isRunning = true;
  setRunningState(true);
  CPU.halted = false;

  await CPU.run({
    max: 100000,
    intervalMs: 80,
    onStep: () => {
      updateRegisters();
      highlightPC();
    },
  });

  isRunning = false;
  setRunningState(false);
  updateRegisters();
  highlightPC();
}

function onStop() {
  CPU.halted = true;
}

function onClear() {
  if (isRunning) return;
  MEM.clear();
  CPU.reset();
  buildMemTable();
  updateRegisters();
  setLog("ОЗУ очищено, регистры сброшены.");
}

let isRunning = false;

function initUI() {
  const assembleBtn = document.getElementById("assemble");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearMem");

  assembleBtn?.addEventListener("click", onAssemble);
  stepBtn?.addEventListener("click", onStep);
  runBtn?.addEventListener("click", onRun);
  stopBtn?.addEventListener("click", onStop);
  clearBtn?.addEventListener("click", onClear);

  bindRegisterInputs();
  buildMemTable();
  updateRegisters();
  setRunningState(false);
}

export { initUI };
