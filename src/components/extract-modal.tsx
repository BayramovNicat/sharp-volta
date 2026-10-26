import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  SparklesIcon,
  XIcon,
} from './icons';
import type { ExtractedChat } from '../utils/chat-extractor';

interface ExtractModalProps {
  extracted: ExtractedChat;
  onClose: () => void;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

const triggerDownload = (filename: string, content: string, mimeType: string) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const ExtractModal = ({ extracted, onClose }: ExtractModalProps) => {
  let format: 'markdown' | 'json' = 'markdown';
  let includePrompt = true;
  let copied = false;
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  const previewEl = (
    <pre class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-all font-normal focus:outline-none" />
  ) as HTMLPreElement;
  const copyBtn = (<button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-sm active:scale-95" />) as HTMLButtonElement;
  const charCountEl = (<span class="text-xs text-zinc-400 font-mono" />) as HTMLSpanElement;

  const updateCopyBtn = () => {
    copyBtn.replaceChildren(
      copied ? <CheckIcon class="size-3.5 text-emerald-300" /> : <CopyIcon class="size-3.5" />,
      <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
    );
    if (copied) {
      copyBtn.className =
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white transition-all cursor-pointer shadow-sm';
    } else {
      copyBtn.className =
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-sm active:scale-95';
    }
  };

  const getContent = () => {
    return format === 'markdown'
      ? extracted.toMarkdown({ includePrompt })
      : extracted.toJSON({ includePrompt });
  };

  const refreshPreview = () => {
    const text = getContent();
    previewEl.textContent = text;
    const approxTokens = Math.round(text.length / 4);
    charCountEl.textContent = `${text.length.toLocaleString()} characters • ~${approxTokens.toLocaleString()} tokens`;
  };

  const handleCopy = async () => {
    const content = getContent();
    const success = await copyToClipboard(content);
    if (success) {
      copied = true;
      updateCopyBtn();
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copied = false;
        updateCopyBtn();
      }, 2000);
    }
  };

  const handleDownload = () => {
    const content = getContent();
    const safeChannelName = extracted.channel.name.replace(/[^a-z0-9_-]/gi, '-');
    if (format === 'markdown') {
      triggerDownload(`${safeChannelName}-transcript.md`, content, 'text/markdown;charset=utf-8');
    } else {
      triggerDownload(`${safeChannelName}-transcript.json`, content, 'application/json;charset=utf-8');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      onClose();
    }
  };

  const cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
    }
    if (copyResetTimer) clearTimeout(copyResetTimer);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }

  updateCopyBtn();
  refreshPreview();

  copyBtn.addEventListener('click', handleCopy);

  const markdownToggleBtn = (
    <button
      type="button"
      onClick={() => {
        format = 'markdown';
        markdownToggleBtn.className =
          'px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white transition-colors cursor-pointer';
        jsonToggleBtn.className =
          'px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer';
        refreshPreview();
      }}
      class="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white transition-colors cursor-pointer"
    >
      Markdown
    </button>
  ) as HTMLButtonElement;

  const jsonToggleBtn = (
    <button
      type="button"
      onClick={() => {
        format = 'json';
        jsonToggleBtn.className =
          'px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white transition-colors cursor-pointer';
        markdownToggleBtn.className =
          'px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer';
        refreshPreview();
      }}
      class="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
    >
      JSON
    </button>
  ) as HTMLButtonElement;

  const promptCheckbox = (
    <input
      type="checkbox"
      checked={includePrompt}
      onChange={(e: Event) => {
        includePrompt = (e.currentTarget as HTMLInputElement).checked;
        refreshPreview();
      }}
      class="rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 size-3.5 cursor-pointer accent-indigo-600"
      id="include-prompt-checkbox"
    />
  ) as HTMLInputElement;

  return (
    <div
      id="extract-chat-modal"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cleanup();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="extract-modal-title"
        class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl h-[85vh] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <header class="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-900/60">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="size-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <SparklesIcon class="size-4" />
            </div>
            <div class="min-w-0">
              <h3 id="extract-modal-title" class="text-sm font-bold text-zinc-100 flex items-center gap-2 truncate">
                Extract Chat Data for LLMs
              </h3>
              <p class="text-[11px] text-zinc-400 truncate">
                Format transcript with media links for Todo lists, task management, or summaries
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {extracted.stats.totalLoadedMessages} messages
            </span>
            {extracted.stats.totalMedia > 0 && (
              <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {extracted.stats.totalMedia} media
              </span>
            )}
            <button
              id="extract-modal-close-button"
              type="button"
              onClick={() => {
                cleanup();
                onClose();
              }}
              class="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 ml-1"
              aria-label="Close extract dialog"
            >
              <XIcon class="size-4" />
            </button>
          </div>
        </header>

        <div class="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {markdownToggleBtn}
              {jsonToggleBtn}
            </div>

            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              {promptCheckbox}
              <span>Include LLM Todo & Task Prompt</span>
            </label>
          </div>

          <div class="flex items-center gap-2">
            {copyBtn}
            <button
              type="button"
              onClick={handleDownload}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
              title="Download file"
            >
              <DownloadIcon class="size-3.5 text-zinc-400" />
              <span>Download</span>
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 p-4 bg-zinc-950 flex flex-col overflow-hidden">
          <div class="flex-1 min-h-0 rounded-xl border border-zinc-800 bg-zinc-950/90 flex flex-col overflow-hidden">
            {previewEl}
          </div>
        </div>

        <footer class="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-500 shrink-0">
          <span>Loaded messages only. Scroll up in chat to load more before extracting.</span>
          {charCountEl}
        </footer>
      </div>
    </div>
  );
};
