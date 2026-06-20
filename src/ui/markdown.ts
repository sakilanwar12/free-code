import { marked } from 'marked';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';

// ── Color Palette ──
const ACCENT = chalk.hex('#61afef');   // One Dark Blue
const MUTED = chalk.hex('#5c6370');    // One Dark Gray
const CODE_BG = chalk.bgHex('#282c34'); // One Dark Background
const CODE_BORDER = chalk.hex('#4b5263'); // One Dark Darker Gray
const LANG_TAG = chalk.hex('#c678dd'); // One Dark Purple
const LINE_NUM = chalk.hex('#5c6370'); // One Dark Gray
const HEADING_COLORS = [
  chalk.hex('#61afef').bold,  // h1 — Blue
  chalk.hex('#c678dd').bold,  // h2 — Purple
  chalk.hex('#56b6c2').bold,  // h3 — Cyan
  chalk.hex('#e06c75').bold,  // h4 — Red
  chalk.hex('#98c379').bold,  // h5 — Green
  chalk.hex('#e5c07b').bold,  // h6 — Yellow
];

// ── Syntax Highlight ──
function highlightCode(code: string, lang?: string): string {
  try {
    return highlight(code, { language: lang || 'typescript', ignoreIllegals: true });
  } catch {
    return code;
  }
}

// ── Inline Markdown ──
function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold(m))
    .replace(/`(.+?)`/g, (_, m) => chalk.hex('#61afef').bgHex('#2c313c')(` ${m} `))
    .replace(/_(.+?)_/g, (_, m) => chalk.italic(m))
    .replace(/~~(.+?)~~/g, (_, m) => chalk.strikethrough(m))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `${chalk.hex('#61afef').underline(label)} ${MUTED(`(${url})`)}`);
}

// ── Non-streaming full render ──
function getHeadingPrefix(level: number): string {
  const color = HEADING_COLORS[Math.min(level - 1, HEADING_COLORS.length - 1)];
  const symbols = ['◆', '◇', '▸', '▹', '•', '·'];
  const sym = symbols[Math.min(level - 1, symbols.length - 1)];
  return color(` ${sym} `);
}

export interface RenderOptions {
  width?: number;
}

export function renderMarkdown(md: string, options: RenderOptions = {}): string {
  const tokens = marked.lexer(md);
  const lines: string[] = [];
  const width = options.width || process.stdout.columns || 80;

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const text = renderInline(token.text);
        const color = HEADING_COLORS[Math.min(token.depth - 1, HEADING_COLORS.length - 1)];
        lines.push(`\n${getHeadingPrefix(token.depth)}${color(text)}\n`);
        break;
      }

      case 'paragraph': {
        const text = renderInline(token.text);
        lines.push(`  ${text}\n`);
        break;
      }

      case 'code': {
        lines.push(renderCodeBlock(token.text, token.lang, width));
        break;
      }

      case 'blockquote': {
        const text = renderInline(token.text);
        for (const line of text.split('\n')) {
          lines.push(`  ${ACCENT('▎')} ${chalk.italic.hex('#94a3b8')(line)}`);
        }
        lines.push('');
        break;
      }

      case 'list': {
        for (let i = 0; i < token.items.length; i++) {
          const item = token.items[i];
          const prefix = token.ordered
            ? MUTED(`${(item as any).start || i + 1}.`)
            : ACCENT('  •');
          const text = renderInline(item.text);
          lines.push(`  ${prefix} ${text}`);
        }
        lines.push('');
        break;
      }

      case 'hr':
        lines.push(`  ${MUTED('─'.repeat(Math.min(50, width - 6)))}\n`);
        break;

      case 'space':
        lines.push('');
        break;

      case 'table': {
        const colWidths: number[] = [];
        for (const row of token.rows) {
          for (let i = 0; i < row.length; i++) {
            colWidths[i] = Math.max(colWidths[i] || 0, row[i].text.length + 2);
          }
        }
        for (let i = 0; i < token.header.length; i++) {
          colWidths[i] = Math.max(colWidths[i] || 0, token.header[i].text.length + 2);
        }

        const renderRow = (cells: any[], isHeader: boolean) => {
          const rendered = cells.map((cell: any, i: number) => {
            const w = colWidths[i] || cell.text.length + 2;
            const padded = cell.text.padEnd(w - 1);
            return isHeader ? chalk.bold.hex('#e2e8f0')(padded) : chalk.hex('#cbd5e1')(padded);
          });
          lines.push(`  ${rendered.join(CODE_BORDER(' │ '))}`);
        };

        lines.push('');
        renderRow(token.header, true);
        lines.push(`  ${colWidths.map((w) => CODE_BORDER('─'.repeat(w))).join(CODE_BORDER('─┼─'))}`);
        for (const row of token.rows) {
          renderRow(row, false);
        }
        lines.push('');
        break;
      }

      default:
        if ('text' in token) {
          lines.push(`  ${renderInline((token as any).text)}\n`);
        }
    }
  }

  return lines.join('\n');
}

// ── Render a code block with box styling ──
function renderCodeBlock(code: string, lang: string | null | undefined, width?: number): string {
  const cols = width || process.stdout.columns || 80;
  const maxWidth = Math.min(cols - 6, 100);
  const highlighted = highlightCode(code, lang || undefined);
  const codeLines = highlighted.split('\n');
  const lineNumWidth = String(codeLines.length).length;
  const langLabel = lang ? LANG_TAG(` ${lang} `) : '';

  const out: string[] = [];
  out.push(`\n  ${CODE_BORDER('╭─')}${langLabel}${CODE_BORDER('─'.repeat(Math.max(1, maxWidth - (lang ? lang.length + 4 : 2))))}`);

  for (let i = 0; i < codeLines.length; i++) {
    const num = LINE_NUM(String(i + 1).padStart(lineNumWidth));
    out.push(`  ${CODE_BORDER('│')} ${num} ${CODE_BORDER('│')} ${codeLines[i]}`);
  }

  out.push(`  ${CODE_BORDER('╰─')}${CODE_BORDER('─'.repeat(Math.max(1, maxWidth)))}\n`);
  return out.join('\n');
}


// ════════════════════════════════════════════════════════
// ██  STREAMING MARKDOWN RENDERER                      ██
// ════════════════════════════════════════════════════════
//
// Handles incremental chunks from the LLM stream.
// Key capability: detects ```lang fences, buffers code lines,
// and renders a complete styled code block when the closing
// fence arrives — all in real-time streaming.

export interface StreamingState {
  buffer: string;            // Partial line buffer
  inCodeBlock: boolean;      // Currently inside a code fence
  codeLang: string;          // Language tag of current fence
  codeLines: string[];       // Accumulated code lines
  lineCount: number;         // Lines rendered so far
}

export function createStreamingState(): StreamingState {
  return {
    buffer: '',
    inCodeBlock: false,
    codeLang: '',
    codeLines: [],
    lineCount: 0,
  };
}

export function renderStreamingChunk(chunk: string, state: StreamingState): string {
  const output: string[] = [];
  state.buffer += chunk;

  // Process complete lines
  while (state.buffer.includes('\n')) {
    const newlineIdx = state.buffer.indexOf('\n');
    const line = state.buffer.slice(0, newlineIdx);
    state.buffer = state.buffer.slice(newlineIdx + 1);

    const rendered = processStreamLine(line, state);
    if (rendered !== null) {
      output.push(rendered);
    }
  }

  // If not in a code block, render the partial buffer as inline
  // (but don't consume it — keep buffering)
  // We skip partial rendering to avoid double-output artifacts.

  return output.join('\n');
}

export function flushStreamingState(state: StreamingState): string {
  const output: string[] = [];

  // If there's remaining buffer content
  if (state.buffer.trim()) {
    if (state.inCodeBlock) {
      state.codeLines.push(state.buffer);
      // Force-close the code block
      const block = renderCodeBlock(state.codeLines.join('\n'), state.codeLang || undefined);
      output.push(block);
      state.inCodeBlock = false;
      state.codeLines = [];
    } else {
      output.push(renderStreamedLine(state.buffer));
    }
    state.buffer = '';
  } else if (state.inCodeBlock && state.codeLines.length > 0) {
    // Unclosed code block — render what we have
    const block = renderCodeBlock(state.codeLines.join('\n'), state.codeLang || undefined);
    output.push(block);
    state.inCodeBlock = false;
    state.codeLines = [];
  }

  return output.join('\n');
}

function processStreamLine(line: string, state: StreamingState): string | null {
  const trimmed = line.trimEnd();

  // ── Code fence detection ──
  const fenceMatch = trimmed.match(/^```(\w*)/);

  if (fenceMatch && !state.inCodeBlock) {
    // Opening fence
    state.inCodeBlock = true;
    state.codeLang = fenceMatch[1] || '';
    state.codeLines = [];
    return null; // Don't render the fence itself
  }

  if (state.inCodeBlock) {
    if (trimmed === '```') {
      // Closing fence — render the complete code block
      state.inCodeBlock = false;
      const block = renderCodeBlock(state.codeLines.join('\n'), state.codeLang || undefined);
      state.codeLines = [];
      state.codeLang = '';
      return block;
    }
    // Accumulate code line
    state.codeLines.push(line);
    return null;
  }

  // ── Normal markdown line ──
  return renderStreamedLine(line);
}

function renderStreamedLine(line: string): string {
  const trimmed = line.trimEnd();

  // Empty line
  if (!trimmed) return '';

  // Heading
  const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const color = HEADING_COLORS[Math.min(level - 1, HEADING_COLORS.length - 1)];
    return `\n${getHeadingPrefix(level)}${color(renderInline(headingMatch[2]))}\n`;
  }

  // Horizontal rule
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
    const cols = process.stdout.columns || 80;
    return `  ${MUTED('─'.repeat(Math.min(50, cols - 6)))}`;
  }

  // Unordered list
  const ulMatch = trimmed.match(/^(\s*)[*\-+]\s+(.+)/);
  if (ulMatch) {
    const indent = Math.floor((ulMatch[1]?.length || 0) / 2);
    const bullet = ACCENT('•');
    return `  ${'  '.repeat(indent)}${bullet} ${renderInline(ulMatch[2])}`;
  }

  // Ordered list
  const olMatch = trimmed.match(/^(\s*)(\d+)\.\s+(.+)/);
  if (olMatch) {
    const indent = Math.floor((olMatch[1]?.length || 0) / 2);
    const num = MUTED(`${olMatch[2]}.`);
    return `  ${'  '.repeat(indent)}${num} ${renderInline(olMatch[3])}`;
  }

  // Blockquote
  const bqMatch = trimmed.match(/^>\s?(.*)/);
  if (bqMatch) {
    return `  ${ACCENT('▎')} ${chalk.italic.hex('#94a3b8')(renderInline(bqMatch[1]))}`;
  }

  // Normal paragraph line
  return `  ${renderInline(trimmed)}`;
}

// Legacy export for backward compatibility
export function renderStreamingChunkSimple(chunk: string): string {
  return renderInline(chunk);
}
