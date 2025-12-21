    /*
      Быстрая front-end имитация:
      - отображает память по словам (2 байта) — адреса 0x000,0x002,...,0x03E
      - позволяет кликать слово, загружать его в IR и декодировать
      - декодер разбирает поле как в PDF: [15:10] opcode(6), [9:7] addrmode(3), [6] ext, [5:0] operand(6)
      - все отображения в HEX (4 цифры для 16-bit)
      - примитивная работа с регистрами (редактируемые в DOM)
    */

    const memBody = document.getElementById('memBody');
    const LOG = document.getElementById('log');
    const PC = document.getElementById('PC');
    const IRInput = document.getElementById('irInput');

    function hex4(n){ return ("000"+(n & 0xFFFF).toString(16).toUpperCase()).slice(-4); }
    function hex3(n){ return ("000"+(n & 0x3FF).toString(16).toUpperCase()).slice(-3); }
    function hex2(n){ return ("00"+(n & 0xFF).toString(16).toUpperCase()).slice(-2); }

    // инициируем память: количество слов (word = 2 bytes) = 0x400 / 2 = 0x200 = 512
    const WORDS = 0x200;
    let memory = new Uint16Array(WORDS); // каждый элемент — слово (16 bit)

    function initSampleMemory(){
        for(let i=0;i<WORDS;i++){
            const val = (i & 0xFF) | ((i<<8)&0xFF00);
            memory[i] = val;
        }
        // small program sample (NOP = 0x00) — помещаем несколько инструкций как примеры
        // пример: ADD (opcode 0x04) with immediate #5 -> construct short instr:
        // opcode(6)=0x04 -> 000100, addrmode 010 (immediate), ext=0, operand=000101 (5)
        // build bits: (opcode<<10)|(addr<<7)|(ext<<6)|operand
        function mkShort(opcode, addr, ext, operand){
            return ((opcode & 0x3F)<<10) | ((addr & 0x7)<<7) | ((ext&1)<<6) | (operand & 0x3F);
        }
        memory[0] = mkShort(0x04, 0x2, 0, 5); // ADD #5
        memory[1] = mkShort(0x12, 0x0, 0, 0); // PUSH (opcode 0x12)
        memory[2] = mkShort(0x21, 0x0, 1, 0); // JMP with EXT=1 (just example)
        memory[3] = 0x1234; // extended word
        // stack pointer default (display only)
        document.getElementById('SP').textContent = hex4(0x03FE);
        renderMemory();
        log('Sample memory initialized.');
    }

    function renderMemory(){
        memBody.innerHTML = '';
        // show first 64 words for convenience (addresses 0x000 .. 0x07E)
        const show = 64;
        for(let i=0;i<show;i++){
            const addrByte = i*2; // byte address
            const addrWord = i;
            const tr = document.createElement('tr');
            const tdAddr = document.createElement('td');
            tdAddr.textContent = '0x' + hex3(addrByte);
            const tdVal = document.createElement('td');
            tdVal.textContent = '0x' + hex4(memory[addrWord]);
            const tdCom = document.createElement('td');
            tdCom.textContent = 'NOP';
            tr.appendChild(tdAddr); tr.appendChild(tdCom); tr.appendChild(tdVal);
            tr.dataset.wordIndex = addrWord;
            tr.addEventListener('click', (e)=>{
                const idx = Number(tr.dataset.wordIndex);
                loadIRFromMemory(idx);
            });
            memBody.appendChild(tr);
        }
    }

    function loadIRFromMemory(wordIndex){
        const val = memory[wordIndex];
        IRInput.value = hex4(val);
        document.getElementById('IR').textContent = hex4(val); // if IR element existed
        decodeIR(val);
        log('Loaded IR from memory @' + hex3(wordIndex*2) + ' -> ' + hex4(val));
        PC.textContent = hex4(wordIndex*2);
    }

    function decodeIRHexString(hexstr){
        const n = parseInt(hexstr,16);
        if (isNaN(n)) return null;
        return n & 0xFFFF;
    }

    function decodeIR(val){
        // val is 16-bit word
        const opcode = (val >> 10) & 0x3F;
        const addrmode = (val >> 7) & 0x7;
        const ext = (val >> 6) & 0x1;
        const operand = val & 0x3F;
        document.getElementById('dOP').textContent = 'OP: ' + ("00"+opcode.toString(16).toUpperCase()).slice(-2);
        document.getElementById('dAM').textContent = 'AM: ' + addrmode.toString(10);
        document.getElementById('dEX').textContent = 'EXT: ' + ext;
        document.getElementById('dOPR').textContent = 'OPER: ' + ("00"+operand.toString(16).toUpperCase()).slice(-2);

        // краткая расшифровка по opcode (частичная, иллюстративно)
        const opNames = {
            0x00:'NOP',0x01:'EI',0x02:'DI',0x03:'HLT',0x04:'ADD',0x05:'SUB',0x06:'CMP',
            0x07:'MUL',0x08:'DIV',0x09:'MOD',0x0A:'INC',0x0B:'DEC',0x10:'SWL',0x11:'SWR',
            0x12:'PUSH',0x13:'POP',0x16:'CALL',0x17:'RET',0x18:'INT',0x19:'IRET',0x1A:'IN',
            0x1B:'OUT',0x1C:'MOV',0x1D:'WR',0x1E:'RD',0x1F:'WRBR',0x20:'WRSP',0x21:'JMP',
            0x22:'JZ',0x23:'JNZ'
        };
        const name = opNames[opcode] || 'UNK';
        const addrmodes = {
            0:'Direct',1:'Reg',2:'Immediate',3:'MemIndirect',4:'BR+offset',5:'@Rx',6:'@Rx+',7:'-@Rx'
        };
        const amn = addrmodes[addrmode] || 'unk';
        let info = name + ' ('+amn+')';
        if(ext===1){
            info += ' — расширенная инструкция (требует второго слова)';
        } else {
            info += ' — короткая';
        }
        document.getElementById('decodeInfo').textContent = info;
        return {opcode,addrmode,ext,operand,name};
    }

    document.getElementById('decodeBtn').addEventListener('click', ()=>{
        const val = decodeIRHexString(IRInput.value);
        if(val===null){ alert('Неверный HEX в поле IR'); return; }
        decodeIR(val);
        log('Decoded IR = ' + hex4(val));
    });

    // small helpers for log
    function log(msg){
        const t = new Date().toLocaleTimeString();
        LOG.textContent = t + ' — ' + msg + '\n' + LOG.textContent;
    }

    // buttons
    document.getElementById('loadExample').addEventListener('click', ()=>{
        initSampleMemory();
    });
    document.getElementById('clearMem').addEventListener('click', ()=>{
        memory.fill(0);
        renderMemory();
        log('Memory cleared.');
    });

    // run/step (mock)
    document.getElementById('stepBtn').addEventListener('click', ()=>{
        // step: read PC, fetch word, decode, increment PC by 2 (or by 4 if EXT)
        const pcVal = decodeIRHexString(PC.textContent) || 0;
        const wordIndex = (pcVal/2)|0;
        if(wordIndex < 0 || wordIndex >= WORDS){ log('PC out of range'); return; }
        const ir = memory[wordIndex];
        const dec = decodeIR(ir);
        log('STEP: PC=' + hex3(pcVal) + ' IR=' + hex4(ir) + ' -> ' + (dec.name || 'UNK'));
        let inc = 2;
        if(dec.ext===1) inc = 4;
        const newPC = (pcVal + inc) & 0x3FF;
        PC.textContent = hex4(newPC);
    });

    document.getElementById('runBtn').addEventListener('click', ()=>{
        log('Run pressed — в макете не реализован настоящее исполнение.');
        alert('Запуск (mock): реального исполнения в этой демо-версии нет.');
    });

    document.getElementById('btnSave').addEventListener('click', ()=>{
        const code = document.getElementById('source').innerText;
        const blob = new Blob([code], {type:'text/plain;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'program.asm';
        document.body.appendChild(a); a.click();
        a.remove();
        URL.revokeObjectURL(url);
        log('Source saved as program.asm');
    });

    // editable register click to edit value quickly
    document.querySelectorAll('.val').forEach(el=>{
        el.addEventListener('click', ()=>{
            const old = el.textContent;
            const v = prompt('Редактировать (HEX 4)', old);
            if(v===null) return;
            const parsed = parseInt(v,16);
            if(isNaN(parsed)){ alert('Неверный HEX'); return; }
            // special-case MAR (3 hex digits)
            if(el.id === 'MAR'){
                el.textContent = ("000"+(parsed & 0x3FF).toString(16).toUpperCase()).slice(-3);
            } else {
                el.textContent = hex4(parsed);
            }
            log('Register ' + (el.previousElementSibling ? el.previousElementSibling.textContent : el.id) + ' set to ' + el.textContent);
        });
    });

    // init
    initSampleMemory();