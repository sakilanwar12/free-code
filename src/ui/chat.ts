import chalk, { type ChalkInstance } from 'chalk';
import { renderStreamingChunk } from './markdown.js';

const INDENT = '';
const ACCENT = chalk.hex('#38bdf8');
const MUTED = chalk.hex('#94a3b8');
const TEXT = chalk.hex('#e5e7eb');

// ── Dark background theme ──
const BG_HEX = '#0d1117';        // Main dark background (GitHub dark)
const USER_BG_HEX = '#161b22';   // Slightly lighter for user message bubbles

const DARK_BG = chalk.bgHex(BG_HEX);
const USER_BG = chalk.bgHex(USER_BG_HEX);

// Fill remaining terminal width with background color
function bgFill(text: string, bg: ChalkInstance = DARK_BG): string {
  const cols = process.stdout.columns || 80;
  const visible = text.replace(/\x1b\[[0-9;?]*[A-Za-z~]/g, '').length;
  const padding = Math.max(0, cols - visible);
  return text + bg(' '.repeat(padding));
}

// ── Terminal background control ──

export function setDarkBackground(): void {
  process.stdout.write(`\x1b]11;${BG_HEX}\x07`);
}

export function resetBackground(): void {
  process.stdout.write('\x1b]111\x07');
}

export function printBanner(provider: string, model: string, cwd: string, gitStatus?: string): void {
  console.log();
  console.log(bgFill(`${ACCENT('╭')} ${chalk.bold.white('Freepilot')} ${MUTED('AI coding agent')}`));
  console.log(bgFill(`${ACCENT('│')} ${MUTED('Provider')} ${TEXT(provider)}  ${MUTED('Model')} ${TEXT(model)}`));
  console.log(bgFill(`${ACCENT('│')} ${MUTED('Cwd')} ${chalk.cyan(cwd)}${gitStatus ? `  ${chalk.yellow(gitStatus)}` : ''}`));
  console.log(bgFill(`${ACCENT('╰')} ${MUTED('/help /exit /clear /tokens /model')}`));
  console.log();
}

export function printHelp(): void {
  console.log();
  console.log(bgFill(`${ACCENT('Commands')}`));
  console.log(bgFill(`  ${chalk.cyan('/exit')}    ${MUTED('Exit')}`));
  console.log(bgFill(`  ${chalk.cyan('/quit')}    ${MUTED('Exit')}`));
  console.log(bgFill(`  ${chalk.cyan('/help')}    ${MUTED('Show help')}`));
  console.log(bgFill(`  ${chalk.cyan('/clear')}   ${MUTED('Clear history')}`));
  console.log(bgFill(`  ${chalk.cyan('/tokens')}  ${MUTED('Show usage & cost')}`));
  console.log(bgFill(`  ${chalk.cyan('/model')}   ${MUTED('List & switch models')}`));
  console.log();
}

export function printUserMessage(input: string): void {
  console.log();
  console.log(bgFill(`${ACCENT('╭')} ${chalk.bold.white('You')}`, USER_BG));
  for (const line of input.split('\n')) {
    console.log(bgFill(`${ACCENT('│')} ${TEXT(line)}`, USER_BG));
  }
  console.log(bgFill(`${ACCENT('╰')}${MUTED('─'.repeat(20))}`, USER_BG));
  console.log();
}

export function printAssistantHeader(): void {
  console.log(bgFill(`${ACCENT('╭')} ${chalk.bold.hex('#38bdf8')('Freepilot')}`));
}

export function printAssistantFooter(): void {
  console.log();
  console.log(bgFill(`${ACCENT('╰')}${MUTED('─'.repeat(20))}`));
  console.log();
}

export function renderAndWriteStreaming(text: string): void {
  process.stdout.write(renderStreamingChunk(text));
}

export function printToolCall(name: string): void {
  const icon = name === 'edit' || name === 'search_replace' ? '\u270F\uFE0F' : name === 'read_file' ? '\uD83D\uDCD6' : name === 'bash' ? '\u26A1' : name === 'git_commit' ? '\uD83D\uDD17' : name === 'plan' ? '\uD83D\uDCCB' : name === 'task_complete' ? '\u2705' : name === 'grep_search' || name === 'glob_search' ? '\uD83D\uDD0D' : '\uD83D\uDEE0';
  process.stdout.write(`\n  ${MUTED(icon)} ${name}... `);
}

export function printToolResult(success: boolean): void {
  console.log(success ? chalk.green('\u2713') : chalk.red('\u2717'));
}

export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

export function printError(message: string, details?: string): void {
  console.log();
  console.log(`  ${chalk.red('\u2716')} ${chalk.bold.white(message)}`);
  if (details) console.log(`  ${MUTED(details)}`);
}

export function printSuccess(message: string): void {
  console.log(`  ${chalk.green('\u2714')} ${message}`);
}

export function printInfo(message: string): void {
  console.log(`  ${ACCENT('\u2139')} ${message}`);
}

// ──────────────────────────────────────────────
// Input editor with blinking cursor
// ──────────────────────────────────────────────

const SLASH_COMMANDS = ['/exit', '/quit', '/help', '/clear', '/tokens', '/model'];

function getSuggestions(line: string): string[] {
  if (!line.startsWith('/')) return [];
  const n = line.toLowerCase();
  if (SLASH_COMMANDS.includes(n)) return [];
  return SLASH_COMMANDS.filter(c => c.startsWith(n));
}

export interface InputState {
  buffer: string;
  cursor: number;
  imageFile?: string;
  imageBase64?: string;
}

export interface PromptResult {
  text: string;
  imageBase64?: string;
  imageFile?: string;
}

function renderInputLine(state: InputState, suggestions: string[], sel: number, model: string = ''): string[] {
  const cols = process.stdout.columns || 80;
  const indent = 2;
  const lines: string[] = [];

  const modelTag = model ? ` ${MUTED('[')}${chalk.cyan(model)}${MUTED(']')}` : '';
  const imageTag = state.imageFile ? ` ${MUTED('\uD83D\uDDBC')} ${chalk.cyan(state.imageFile)} ` : '';
  const empty = state.buffer.length === 0 && !state.imageFile;

  // Input line: show blinking cursor via terminal escape
  let inputLine: string;
  if (empty) {
    inputLine = `${' '.repeat(indent)}${modelTag} ${ACCENT('>')} ${MUTED('Ask me to code...')}`;
  } else {
    const beforeCursor = state.buffer.slice(0, state.cursor);
    const atCursor = state.buffer[state.cursor] || ' ';
    const afterCursor = state.buffer.slice(state.cursor + 1);
    inputLine = `${' '.repeat(indent)}${modelTag} ${ACCENT('>')} ${imageTag}${beforeCursor}\x1b[?25h\x1b[5m${atCursor}\x1b[25m${afterCursor}`;
  }
  lines.push(bgFill(inputLine));

  // Suggestions
  if (suggestions.length > 0) {
    const line = suggestions.map((s, i) => i === sel ? chalk.bgCyan.black(` ${s} `) : MUTED(s)).join('  ');
    lines.push(bgFill(`${' '.repeat(indent)} ${line}`));
  }

  return lines;
}

function clearRows(count: number): void {
  if (count <= 0) return;
  for (let i = 0; i < count - 1; i++) process.stdout.write('\x1b[A');
  for (let i = 0; i < count; i++) {
    process.stdout.write('\r\x1b[K');
    if (i < count - 1) process.stdout.write('\x1b[B');
  }
  for (let i = 0; i < count - 1; i++) process.stdout.write('\x1b[A');
  process.stdout.write('\r');
}

export async function promptUser(history: string[] = [], model: string = '', provider: string = ''): Promise<PromptResult> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;

    if (input.isTTY) input.setRawMode(true);
    input.resume();

    // Show blinking cursor
    output.write('\x1b[?25h\x1b[?12h');

    const state: InputState = { buffer: '', cursor: 0 };
    let historyIdx = history.length;
    let draft = '';
    let sel = -1;
    let rows = 1;
    let closed = false;

    function cur(): string[] { return getSuggestions(state.buffer); }

    function draw() {
      const s = cur();
      if (s.length === 0) sel = -1;
      else if (sel >= s.length) sel = s.length - 1;
      clearRows(rows);
      const r = renderInputLine(state, s, sel, model);
      output.write(r.join('\n'));
      rows = r.length;
    }

    function done() {
      if (closed) return;
      closed = true;
      clearRows(rows);
      output.write('\r\x1b[K');
      output.write('\x1b[?25h\x1b[?12l');
      input.off('data', onData);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      resolve({ text: state.buffer.trim(), imageBase64: state.imageBase64, imageFile: state.imageFile });
    }

    function ins(ch: string) {
      state.buffer = state.buffer.slice(0, state.cursor) + ch + state.buffer.slice(state.cursor);
      state.cursor += ch.length;
      draw();
    }

    function del() {
      if (state.cursor <= 0) return;
      state.buffer = state.buffer.slice(0, state.cursor - 1) + state.buffer.slice(state.cursor);
      state.cursor--;
      draw();
    }

    function delFwd() {
      if (state.cursor >= state.buffer.length) return;
      state.buffer = state.buffer.slice(0, state.cursor) + state.buffer.slice(state.cursor + 1);
      draw();
    }

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');

      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '\x03' || ch === '\x04') { state.buffer = '/exit'; done(); return; }
        if (ch === '\n') { ins('\n'); continue; }
        if (ch === '\r') {
          if (sel >= 0) {
            state.buffer = cur()[sel];
            state.cursor = state.buffer.length;
            sel = -1;
            draw();
            continue;
          }
          done();
          return;
        }
        if (ch === '\x7f') { del(); continue; }
        if (ch === '\t') {
          const s = cur();
          if (s.length === 1) { state.buffer = s[0]; state.cursor = state.buffer.length; draw(); }
          else if (s.length > 1) { sel = sel < 0 ? 0 : (sel + 1) % s.length; draw(); }
          continue;
        }
        if (ch === '\x1b') {
          let end = i + 1;
          if (str[end] === '[') {
            end++;
            while (end < str.length && !/[A-Za-z~]/.test(str[end])) end++;
          }
          const seq = str.slice(i, Math.min(end + 1, str.length));
          i = Math.min(end, str.length - 1);

          if (seq === '\x1b\r' || seq === '\x1b\n') { ins('\n'); continue; }
          switch (seq) {
            case '\x1b[A':
              if (sel >= 0) { sel = (sel - 1 + cur().length) % cur().length; draw(); }
              else if (history.length) {
                if (historyIdx === history.length) { draft = state.buffer; historyIdx--; }
                else if (historyIdx > 0) historyIdx--;
                else break;
                state.buffer = history[historyIdx]; state.cursor = state.buffer.length; draw();
              }
              break;
            case '\x1b[B':
              if (sel >= 0) { sel = (sel + 1) % cur().length; draw(); }
              else if (historyIdx < history.length - 1) {
                historyIdx++; state.buffer = history[historyIdx]; state.cursor = state.buffer.length; draw();
              } else {
                historyIdx = history.length; state.buffer = draft; state.cursor = 0; draw();
              }
              break;
            case '\x1b[C': if (state.cursor < state.buffer.length) { state.cursor++; draw(); } break;
            case '\x1b[D': if (state.cursor > 0) { state.cursor--; draw(); } break;
            case '\x1b[H': state.cursor = 0; draw(); break;
            case '\x1b[F': state.cursor = state.buffer.length; draw(); break;
            case '\x1b[Z': if (cur().length) { sel = sel <= 0 ? cur().length - 1 : sel - 1; draw(); } break;
            case '\x1b[3~': delFwd(); break;
          }
          continue;
        }
        if (ch === '\x17') {
          const b = state.buffer.slice(0, state.cursor);
          const m = b.match(/(.*?)(\s*\S+\s*)$/);
          if (m) { state.buffer = state.buffer.slice(0, m[1].length) + state.buffer.slice(state.cursor); state.cursor = m[1].length; draw(); }
          continue;
        }
        if (ch === '\x01') { state.cursor = 0; draw(); continue; }
        if (ch === '\x05') { state.cursor = state.buffer.length; draw(); continue; }
        if (ch === '\x0b') { state.buffer = state.buffer.slice(0, state.cursor); draw(); continue; }
        if (ch === '\x15') { state.buffer = ''; state.cursor = 0; draw(); continue; }
        if (ch === '\x0c') { console.clear(); rows = 0; draw(); continue; }
        if (ch >= ' ') { sel = -1; ins(ch); }
      }
    };

    input.on('data', onData);
    draw();
  });
}

export function closePrompt(): void {
}
