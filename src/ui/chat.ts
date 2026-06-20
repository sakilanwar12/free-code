import chalk, { type ChalkInstance } from 'chalk';
import { createStreamingState, renderStreamingChunk, flushStreamingState, type StreamingState } from './markdown.js';

// ════════════════════════════════════════════════════════
// ██  COLOR PALETTE — Premium dark theme               ██
// ════════════════════════════════════════════════════════

const ACCENT    = chalk.hex('#61afef');   // One Dark Blue
const ACCENT2   = chalk.hex('#c678dd');   // One Dark Purple
const ACCENT3   = chalk.hex('#56b6c2');   // One Dark Cyan
const MUTED     = chalk.hex('#5c6370');   // One Dark Gray
const DIM       = chalk.hex('#4b5263');   // One Dark Darker Gray
const TEXT      = chalk.hex('#abb2bf');   // One Dark Text
const BRIGHT    = chalk.hex('#ffffff');   // White
const SUCCESS   = chalk.hex('#98c379');   // One Dark Green
const ERROR_CLR = chalk.hex('#e06c75');   // One Dark Red
const WARN      = chalk.hex('#e5c07b');   // One Dark Yellow
const PINK      = chalk.hex('#d19a66');   // One Dark Orange

// ── Background theme ──
const BG_HEX      = '#282c34';       // One Dark Background
const USER_BG_HEX = '#2c313c';       // One Dark Lighter Gray Background
const DARK_BG     = chalk.bgHex(BG_HEX);
const USER_BG     = chalk.bgHex(USER_BG_HEX);

// Fill remaining terminal width with background color
function bgFill(text: string, bg: ChalkInstance = DARK_BG): string {
  const cols = process.stdout.columns || 80;
  const visible = stripAnsi(text).length;
  const padding = Math.max(0, cols - visible);
  return text + bg(' '.repeat(padding));
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z~]/g, '');
}

function centerText(text: string, width: number): string {
  const visLen = stripAnsi(text).length;
  const pad = Math.max(0, Math.floor((width - visLen) / 2));
  return ' '.repeat(pad) + text;
}

// Gradient text across characters
function gradientText(text: string, colors: string[]): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const colorIdx = Math.floor((i / text.length) * colors.length);
    result += chalk.hex(colors[Math.min(colorIdx, colors.length - 1)])(text[i]);
  }
  return result;
}

// ════════════════════════════════════════════════════════
// ██  TERMINAL BACKGROUND CONTROL                      ██
// ════════════════════════════════════════════════════════

export function setDarkBackground(): void {
  process.stdout.write(`\x1b]11;${BG_HEX}\x07`);
}

export function resetBackground(): void {
  process.stdout.write('\x1b]111\x07');
}

// ════════════════════════════════════════════════════════
// ██  BANNER — ASCII Art with Gradient                 ██
// ════════════════════════════════════════════════════════

const LOGO_LINES = [
  '  ███████╗██████╗ ███████╗███████╗██████╗ ██╗██╗      ██████╗ ████████╗',
  '  ██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝',
  '  ███████╗██████╔╝█████╗  █████╗  ██████╔╝██║██║     ██║   ██║   ██║   ',
  '  ██╔═══╝ ██╔══██╗██╔══╝  ██╔══╝  ██╔═══╝ ██║██║     ██║   ██║   ██║   ',
  '  ██║     ██║  ██║███████╗███████╗██║     ██║███████╗╚██████╔╝   ██║   ',
  '  ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚═╝╚══════╝ ╚══════╝   ╚═╝   ',
];

const GRADIENT_COLORS = ['#61afef', '#a78bfa', '#c678dd', '#d19a66', '#e06c75'];

export function printBanner(provider: string, model: string, cwd: string, gitStatus?: string): void {
  const cols = process.stdout.columns || 80;
  console.log();

  // ASCII logo with gradient
  for (const line of LOGO_LINES) {
    const centered = centerText(gradientText(line, GRADIENT_COLORS), cols);
    console.log(bgFill(centered));
  }

  console.log(bgFill(''));

  // Gradient separator
  const sepLen = Math.min(60, cols - 4);
  let sep = '  ';
  for (let i = 0; i < sepLen; i++) {
    const colorIdx = Math.floor((i / sepLen) * GRADIENT_COLORS.length);
    sep += chalk.hex(GRADIENT_COLORS[colorIdx])('━');
  }
  console.log(bgFill(sep));
  console.log(bgFill(''));

  // Info panel
  const providerIcon = provider === 'openrouter' ? '🌐' : provider === 'ollama' ? '🦙' : provider === 'deepseek' ? '🐋' : provider === 'openai' ? '🤖' : '⚡';
  console.log(bgFill(`  ${providerIcon} ${MUTED('Provider')} ${BRIGHT(provider)}  ${MUTED('·')}  ${MUTED('Model')} ${ACCENT(model)}`));
  console.log(bgFill(`  📂 ${MUTED('Cwd')} ${chalk.hex('#38bdf8')(cwd)}${gitStatus ? `  ${MUTED('·')}  ${WARN('⎇')} ${WARN(gitStatus)}` : ''}`));
  console.log(bgFill(''));
  console.log(bgFill(`  ${DIM('Commands:')} ${MUTED('/help')} ${DIM('·')} ${MUTED('/exit')} ${DIM('·')} ${MUTED('/clear')} ${DIM('·')} ${MUTED('/tokens')} ${DIM('·')} ${MUTED('/model')}`));
  console.log(bgFill(`  ${DIM('Shortcuts:')} ${MUTED('Esc+Enter')} ${DIM('newline')} ${DIM('·')} ${MUTED('Ctrl+O')} ${DIM('stash')} ${DIM('·')} ${MUTED('Ctrl+R')} ${DIM('restore')}`));

  // Bottom separator
  console.log(bgFill(sep));
  console.log();
}

// ════════════════════════════════════════════════════════
// ██  HELP SCREEN                                      ██
// ════════════════════════════════════════════════════════

export function printHelp(): void {
  const cols = process.stdout.columns || 80;
  const w = Math.min(56, cols - 4);

  console.log();
  console.log(bgFill(`  ${ACCENT('╭')}${ACCENT('─'.repeat(w))}${ACCENT('╮')}`));
  console.log(bgFill(`  ${ACCENT('│')} ${gradientText('⌘ Commands', GRADIENT_COLORS).padEnd(w + 40)}${ACCENT('│')}`));
  console.log(bgFill(`  ${ACCENT('├')}${DIM('─'.repeat(w))}${ACCENT('┤')}`));

  const cmds = [
    ['/exit, /quit', 'Exit the session'],
    ['/help',        'Show this help panel'],
    ['/clear',       'Clear conversation history'],
    ['/tokens',      'Show token usage & cost estimate'],
    ['/model',       'List available models'],
    ['/model <id>',  'Switch to a different model'],
  ];

  for (const [cmd, desc] of cmds) {
    const cmdStr = chalk.hex('#818cf8')(cmd.padEnd(16));
    const descStr = MUTED(desc);
    console.log(bgFill(`  ${ACCENT('│')}  ${cmdStr} ${descStr}${' '.repeat(Math.max(0, w - stripAnsi(cmdStr).length - stripAnsi(descStr).length - 3))}${ACCENT('│')}`));
  }

  console.log(bgFill(`  ${ACCENT('├')}${DIM('─'.repeat(w))}${ACCENT('┤')}`));
  console.log(bgFill(`  ${ACCENT('│')} ${gradientText('⌨ Keyboard Shortcuts', GRADIENT_COLORS).padEnd(w + 40)}${ACCENT('│')}`));
  console.log(bgFill(`  ${ACCENT('├')}${DIM('─'.repeat(w))}${ACCENT('┤')}`));

  const shortcuts = [
    ['Esc+Enter',  'Insert newline (multi-line input)'],
    ['Ctrl+O',     'Stash current prompt'],
    ['Ctrl+R',     'Restore stashed prompt'],
    ['Ctrl+U',     'Clear current input'],
    ['Ctrl+K',     'Delete to end of line'],
    ['Ctrl+L',     'Clear terminal screen'],
    ['Tab',        'Autocomplete slash commands'],
    ['↑ / ↓',     'Browse input history'],
  ];

  for (const [key, desc] of shortcuts) {
    const keyStr = chalk.hex('#a78bfa')(key.padEnd(16));
    const descStr = MUTED(desc);
    console.log(bgFill(`  ${ACCENT('│')}  ${keyStr} ${descStr}${' '.repeat(Math.max(0, w - stripAnsi(keyStr).length - stripAnsi(descStr).length - 3))}${ACCENT('│')}`));
  }

  console.log(bgFill(`  ${ACCENT('╰')}${ACCENT('─'.repeat(w))}${ACCENT('╯')}`));
  console.log();
}

// ════════════════════════════════════════════════════════
// ██  USER MESSAGE BUBBLE                              ██
// ════════════════════════════════════════════════════════

export function printUserMessage(input: string): void {
  const now = new Date();
  const time = MUTED(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

  console.log();
  console.log(bgFill(`  ${ACCENT2('╭─')} ${chalk.bold.hex('#e2e8f0')('You')} ${MUTED('›')} ${time}`, USER_BG));
  for (const line of input.split('\n')) {
    console.log(bgFill(`  ${ACCENT2('│')} ${TEXT(line)}`, USER_BG));
  }
  console.log(bgFill(`  ${ACCENT2('╰')}${DIM('─'.repeat(30))}`, USER_BG));
  console.log();
}

// ════════════════════════════════════════════════════════
// ██  ASSISTANT RESPONSE FRAME                         ██
// ════════════════════════════════════════════════════════

let streamState: StreamingState | null = null;
let assistantStartTime: number = 0;

export function printAssistantHeader(): void {
  streamState = createStreamingState();
  assistantStartTime = Date.now();
  const sparkle = gradientText('✦', ['#38bdf8', '#818cf8', '#a78bfa']);
  console.log(bgFill(`  ${ACCENT('╭─')} ${sparkle} ${chalk.bold.hex('#38bdf8')('Freepilot')}`));
  console.log(bgFill(`  ${ACCENT('│')}`));
}

export function printAssistantFooter(): void {
  // Flush any remaining streaming state
  if (streamState) {
    const remaining = flushStreamingState(streamState);
    if (remaining) {
      for (const line of remaining.split('\n')) {
        process.stdout.write(bgFill(`  ${ACCENT('│')} ${line}`) + '\n');
      }
    }
    streamState = null;
  }

  const elapsed = Date.now() - assistantStartTime;
  const secs = (elapsed / 1000).toFixed(1);
  console.log();
  console.log(bgFill(`  ${ACCENT('╰')}${DIM('─'.repeat(20))} ${DIM(`${secs}s`)}`));
  console.log();
}

export function renderAndWriteStreaming(text: string): void {
  if (!streamState) {
    streamState = createStreamingState();
  }

  const rendered = renderStreamingChunk(text, streamState);
  if (rendered) {
    // Add the left border to each line
    for (const line of rendered.split('\n')) {
      process.stdout.write(bgFill(`  ${ACCENT('│')} ${line}`) + '\n');
    }
  }
}

// ════════════════════════════════════════════════════════
// ██  TOOL CALL DISPLAY — Styled Cards                 ██
// ════════════════════════════════════════════════════════

const TOOL_ICONS: Record<string, string> = {
  edit:          '✏️',
  search_replace:'✏️',
  read_file:     '📖',
  write_file:    '📝',
  bash:          '⚡',
  git_commit:    '🔗',
  git_status:    '📊',
  git_diff:      '📋',
  git_log:       '📜',
  plan:          '📋',
  task_complete: '✅',
  grep_search:   '🔍',
  glob_search:   '🔍',
  list_directory:'📂',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let toolSpinnerInterval: ReturnType<typeof setInterval> | null = null;
let toolSpinnerFrame = 0;

export function printToolCall(name: string): void {
  const icon = TOOL_ICONS[name] || '🛠';
  const displayName = chalk.hex('#818cf8').bold(name);
  const border = DIM('┊');

  // Start spinner animation
  toolSpinnerFrame = 0;
  process.stdout.write(`\n  ${border} ${icon} ${displayName} `);

  toolSpinnerInterval = setInterval(() => {
    toolSpinnerFrame = (toolSpinnerFrame + 1) % SPINNER_FRAMES.length;
    const frame = ACCENT(SPINNER_FRAMES[toolSpinnerFrame]);
    process.stdout.write(`\r  ${border} ${icon} ${displayName} ${frame} `);
  }, 80);
}

export function printToolResult(success: boolean): void {
  if (toolSpinnerInterval) {
    clearInterval(toolSpinnerInterval);
    toolSpinnerInterval = null;
  }

  const icon = TOOL_ICONS['bash'] || '🛠';
  const status = success
    ? SUCCESS('✓ done')
    : ERROR_CLR('✗ failed');

  process.stdout.write(`\r\x1b[K  ${DIM('┊')} ${status}\n`);
}

// ════════════════════════════════════════════════════════
// ██  THINKING SPINNER — Animated                      ██
// ════════════════════════════════════════════════════════

let thinkingInterval: ReturnType<typeof setInterval> | null = null;
let thinkingFrame = 0;
let thinkingStartTime = 0;
const THINKING_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function startThinkingSpinner(): ReturnType<typeof setInterval> {
  thinkingFrame = 0;
  thinkingStartTime = Date.now();

  const render = () => {
    thinkingFrame = (thinkingFrame + 1) % THINKING_DOTS.length;
    const elapsed = ((Date.now() - thinkingStartTime) / 1000).toFixed(0);
    const frame = gradientText(THINKING_DOTS[thinkingFrame], GRADIENT_COLORS);
    const label = gradientText('Thinking', ['#38bdf8', '#818cf8', '#a78bfa']);
    process.stdout.write(`\r\x1b[K  ${frame} ${label}${MUTED('...')} ${DIM(`${elapsed}s`)}`);
  };

  render();
  thinkingInterval = setInterval(render, 80);
  return thinkingInterval;
}

export function stopThinkingSpinner(interval?: ReturnType<typeof setInterval>): void {
  if (interval) clearInterval(interval);
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
  }
}

// ════════════════════════════════════════════════════════
// ██  STATUS MESSAGES                                  ██
// ════════════════════════════════════════════════════════

export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

export function printError(message: string, details?: string): void {
  console.log();
  console.log(bgFill(`  ${ERROR_CLR('✖')} ${chalk.bold.hex('#f1f5f9')(message)}`));
  if (details) console.log(bgFill(`    ${MUTED(details)}`));
}

export function printSuccess(message: string): void {
  console.log(bgFill(`  ${SUCCESS('✔')} ${TEXT(message)}`));
}

export function printInfo(message: string): void {
  console.log(bgFill(`  ${ACCENT('ℹ')} ${TEXT(message)}`));
}

// ════════════════════════════════════════════════════════
// ██  INPUT EDITOR — Multi-line with Syntax Awareness  ██
// ════════════════════════════════════════════════════════

const SLASH_COMMANDS = ['/exit', '/quit', '/help', '/clear', '/tokens', '/model'];
const SLASH_DESCS: Record<string, string> = {
  '/exit': 'Exit session',
  '/quit': 'Exit session',
  '/help': 'Show help',
  '/clear': 'Clear history',
  '/tokens': 'Usage & cost',
  '/model': 'Switch model',
};

const PLACEHOLDERS = [
  'Ask me to code something amazing...',
  'Describe a feature you want to build...',
  'Point me to a bug you want fixed...',
  'Help me refactor this module...',
  'Explain how this codebase works...',
];

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
  stash: string[];
}

export interface PromptResult {
  text: string;
  imageBase64?: string;
  imageFile?: string;
}

function renderInputLine(
  state: InputState,
  suggestions: string[],
  sel: number,
  model: string = '',
  placeholder: string = PLACEHOLDERS[0],
  toast?: string | null,
  pasteSummary?: string | null,
): { lines: string[]; cursorLineIdx: number; cursorCol: number } {
  const cols = process.stdout.columns || 80;
  const W = Math.max(40, Math.min(90, cols - 6));
  const innerW = W - 2;
  const lines: string[] = [];

  const bg = chalk.bgHex('#2c313c'); // One Dark Lighter Gray Background
  const borderClr = chalk.hex('#4b5263'); // One Dark Darker Gray Border
  const leftBorderClr = chalk.hex('#61afef'); // One Dark Blue Border

  // Helper to format a box row with background and borders
  const boxRow = (content: string) => {
    const visLen = stripAnsi(content).length;
    const padding = Math.max(0, innerW - visLen);
    const leftBorder = leftBorderClr('│');
    const rightBorder = borderClr('│');
    return leftBorder + bg(content + ' '.repeat(padding)) + rightBorder;
  };

  // Top border
  const topBorder = leftBorderClr('┌') + borderClr('─'.repeat(innerW)) + borderClr('┐');
  lines.push(topBorder);

  // 1. Image upload line (if any)
  if (state.imageFile) {
    lines.push(boxRow(`  ${MUTED('🖼')} ${chalk.hex('#61afef')(state.imageFile)}`));
  }

  // 2. Paste summary line (if any)
  if (pasteSummary) {
    lines.push(boxRow(`  ${MUTED(pasteSummary)}`));
  }

  const MIN_HEIGHT = 3;
  let cursorLineIdx = 0;
  let cursorCol = 6;

  // Determine cursor position in 2D
  let lineIdx = 0;
  let colIdx = 0;
  let currLen = 0;
  const bufferLines = state.buffer.split('\n');
  for (let i = 0; i < bufferLines.length; i++) {
    const line = bufferLines[i];
    if (state.cursor >= currLen && state.cursor <= currLen + line.length) {
      lineIdx = i;
      colIdx = state.cursor - currLen;
      break;
    }
    currLen += line.length + 1;
  }

  const displayLines = [...bufferLines];
  while (displayLines.length < MIN_HEIGHT) {
    displayLines.push('');
  }

  // 3. Input buffer or placeholder
  const empty = state.buffer.length === 0 && !state.imageFile && !pasteSummary;
  
  for (let i = 0; i < displayLines.length; i++) {
    const line = displayLines[i];
    const currentLineIdxInBox = lines.length;
    
    if (empty && i === 0) {
      const cursorChar = chalk.bgHex('#abb2bf').hex('#282c34')(' ');
      cursorLineIdx = currentLineIdxInBox;
      cursorCol = 6;
      lines.push(boxRow(`  ${cursorChar} ${MUTED(placeholder)}`));
    } else if (!empty && i === lineIdx) {
      const before = line.slice(0, colIdx);
      const at = line[colIdx] || ' ';
      const after = line.slice(colIdx + 1);
      const cursorChar = chalk.bgHex('#abb2bf').hex('#282c34')(at);
      cursorLineIdx = currentLineIdxInBox;
      cursorCol = 6 + stripAnsi(before).length;
      lines.push(boxRow(`  ${before}${cursorChar}${after}`));
    } else {
      lines.push(boxRow(`  ${line}`));
    }
  }

  // 4. Suggestions (if any)
  if (suggestions.length > 0) {
    const divider = borderClr('─'.repeat(innerW - 4));
    lines.push(boxRow(`  ${divider}`));
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const desc = SLASH_DESCS[s] || '';
      if (i === sel) {
        const prefix = `${chalk.hex('#38bdf8')('→')} ${chalk.bold.hex('#f1f5f9')(s)}`;
        const spaceCount = Math.max(1, (innerW - 4) - stripAnsi(prefix).length - stripAnsi(desc).length);
        lines.push(boxRow(`  ${prefix}${' '.repeat(spaceCount)}${DIM(desc)}`));
      } else {
        const prefix = `  ${DIM(s)}`;
        const spaceCount = Math.max(1, (innerW - 4) - stripAnsi(prefix).length - stripAnsi(desc).length);
        lines.push(boxRow(`  ${prefix}${' '.repeat(spaceCount)}${DIM(desc)}`));
      }
    }
  }

  // 5. Divider before status
  const divider = borderClr('─'.repeat(innerW - 4));
  lines.push(boxRow(`  ${divider}`));

  // 6. Status bar
  const modelName = model || 'No Model';
  const leftStatus = chalk.hex('#38bdf8')('Model') + DIM(' · ') + BRIGHT(modelName);
  const rightStatus = MUTED('Freepilot CLI');
  const statusLine = alignLeftRight(leftStatus, rightStatus, innerW - 4);
  lines.push(boxRow(`  ${statusLine}`));

  // Bottom border
  const bottomBorder = leftBorderClr('└') + borderClr('─'.repeat(innerW)) + borderClr('┘');
  lines.push(bottomBorder);

  // Helper to align left/right inside the status bar
  function alignLeftRight(left: string, right: string, width: number): string {
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const spaces = Math.max(1, width - leftLen - rightLen);
    return left + ' '.repeat(spaces) + right;
  }

  // Toast notification (if any)
  if (toast) {
    lines.push(`  ${leftBorderClr('│')} ${TEXT(toast)}`);
  }

  const indentStr = '  ';
  return {
    lines: lines.map(line => indentStr + line),
    cursorLineIdx,
    cursorCol,
  };
}

function clearRows(count: number, lastCursorLineIdx: number): void {
  if (count <= 0) return;
  // Move cursor from lastCursorLineIdx to the bottom line of the printed block
  const dy = (count - 1) - lastCursorLineIdx;
  if (dy > 0) process.stdout.write(`\x1b[${dy}B`);

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

    // Show cursor
    output.write('\x1b[?25h\x1b[?12h');

    const state: InputState = { buffer: '', cursor: 0, stash: [] };
    let historyIdx = history.length;
    let draft = '';
    let sel = -1;
    let rows = 1;
    let lastCursorLineIdx = 0;
    let closed = false;
    let toast: string | null = null;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    let pasteBuffer = '';
    let pasteSummary: string | null = null;
    let placeholderIdx = 0;
    const placeholderTimer = setInterval(() => {
      if (closed) return;
      if (state.buffer.length === 0 && !state.imageFile && !pasteSummary) {
        placeholderIdx = (placeholderIdx + 1) % PLACEHOLDERS.length;
        draw();
      }
    }, 4000);

    function cur(): string[] { return getSuggestions(state.buffer); }

    function showToast(msg: string, duration: number = 2500) {
      toast = msg;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast = null; if (!closed) draw(); }, duration);
      draw();
    }

    function draw() {
      const s = cur();
      if (s.length === 0) sel = -1;
      else if (sel >= s.length) sel = s.length - 1;
      clearRows(rows, lastCursorLineIdx);
      const r = renderInputLine(state, s, sel, model, PLACEHOLDERS[placeholderIdx], toast, pasteSummary);
      output.write(r.lines.join('\n'));
      
      // Move native cursor back to the cursor position
      const dy = (r.lines.length - 1) - r.cursorLineIdx;
      if (dy > 0) {
        output.write(`\x1b[${dy}A`);
      }
      
      // Move to correct column
      output.write(`\x1b[${r.cursorCol}G`);
      
      rows = r.lines.length;
      lastCursorLineIdx = r.cursorLineIdx;
    }

    function done() {
      if (closed) return;
      closed = true;
      clearInterval(placeholderTimer);
      if (toastTimer) clearTimeout(toastTimer);
      clearRows(rows, lastCursorLineIdx);
      output.write('\r\x1b[K');
      output.write('\x1b[?25h\x1b[?12l');
      input.off('data', onData);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      const finalText = pasteBuffer
        ? state.buffer.trim() + '\n' + pasteBuffer
        : state.buffer.trim();
      resolve({ text: finalText, imageBase64: state.imageBase64, imageFile: state.imageFile });
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

      // Detect paste: large chunk of printable text without escape sequences
      if (str.length > 150 && !str.includes('\x1b') && !str.includes('\x03') && !str.includes('\x04')) {
        pasteBuffer += str;
        const lineCount = pasteBuffer.split('\n').length;
        pasteSummary = `📋 Pasted ~${lineCount} lines`;
        showToast(`📋 Pasted ${lineCount >= 10 ? lineCount + ' lines' : 'text'} (press Enter to send)`);
        draw();
        return;
      }

      // Clear paste state if user types normally after pasting
      if (pasteSummary && str.length > 0) {
        pasteBuffer = '';
        pasteSummary = null;
      }

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
        // Ctrl+K (kill to end)
        if (ch === '\x0b') { state.buffer = state.buffer.slice(0, state.cursor); draw(); continue; }
        // Ctrl+U (kill line)
        if (ch === '\x15') { state.buffer = ''; state.cursor = 0; draw(); continue; }
        // Ctrl+L (clear screen)
        if (ch === '\x0c') { console.clear(); rows = 0; draw(); continue; }
        // Ctrl+O (stash save)
        if (ch === '\x0f') {
          if (state.buffer.trim()) {
            state.stash.push(state.buffer);
            state.buffer = '';
            state.cursor = 0;
            showToast(`📦 Stashed (${state.stash.length} saved)`);
          }
          continue;
        }
        // Ctrl+R (stash restore)
        if (ch === '\x12') {
          if (state.stash.length > 0) {
            const stashed = state.stash.pop()!;
            state.buffer = stashed;
            state.cursor = stashed.length;
            showToast(`📤 Restored from stash (${state.stash.length} left)`);
          }
          continue;
        }
        if (ch >= ' ') { sel = -1; ins(ch); }
      }
    };

    input.on('data', onData);
    draw();
  });
}

export function closePrompt(): void {
}
