import type { PendingFile } from '../types';
import { FileIcon, PaperclipIcon, SendIcon, XIcon } from './icons';

interface MessageInputProps {
  typingText: string;
  errorMessage?: string | null;
  onSend: (text: string, files?: File[]) => void;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MessageInput = ({ typingText, errorMessage, onSend }: MessageInputProps) => {
  let pendingFiles: PendingFile[] = [];
  let fileInputEl: HTMLInputElement | null = null;
  let attachmentsContainerEl: HTMLElement | null = null;
  let dropOverlayEl: HTMLElement | null = null;
  let dragCounter = 0;

  const renderAttachments = () => {
    if (!attachmentsContainerEl) return;
    if (pendingFiles.length === 0) {
      attachmentsContainerEl.replaceChildren();
      attachmentsContainerEl.classList.add('hidden');
      return;
    }

    attachmentsContainerEl.classList.remove('hidden');
    const fragment = document.createDocumentFragment();

    for (const pf of pendingFiles) {
      const isImg = pf.mime_type.startsWith('image/');
      fragment.appendChild(
        <div
          data-file-id={pf.id}
          class="flex items-center gap-2 p-1.5 pr-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs shrink-0 group relative overflow-hidden"
        >
          {isImg && pf.previewUrl ? (
            <img
              src={pf.previewUrl}
              alt={pf.name}
              class="size-8 rounded-lg object-cover bg-black shrink-0 border border-zinc-800"
            />
          ) : (
            <div class="size-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              <FileIcon class="size-4" />
            </div>
          )}

          <div class="flex flex-col min-w-0 max-w-36">
            <span class="text-zinc-200 font-medium truncate text-[11px]">{pf.name}</span>
            <span class="text-zinc-500 font-mono text-[10px]">{formatFileSize(pf.size)}</span>
          </div>

          <button
            type="button"
            onClick={() => removeFile(pf.id)}
            class="size-5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
            title="Remove file"
          >
            <XIcon class="size-3" />
          </button>
        </div>
      );
    }

    attachmentsContainerEl.replaceChildren(fragment);
  };

  const addFiles = (files: FileList | File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;

      pendingFiles.push({
        id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        mime_type: file.type,
        previewUrl,
      });
    }
    renderAttachments();
  };

  const removeFile = (id: string) => {
    const target = pendingFiles.find((pf) => pf.id === id);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }
    pendingFiles = pendingFiles.filter((pf) => pf.id !== id);
    renderAttachments();
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const textarea = form.elements.namedItem('message') as HTMLTextAreaElement;
    const text = textarea.value.trim();

    if (!text && pendingFiles.length === 0) return;

    const filesToSend = pendingFiles.map((pf) => pf.file);
    for (const pf of pendingFiles) {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    }
    pendingFiles = [];
    renderAttachments();

    onSend(text, filesToSend);
    form.reset();
    textarea.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = (e.currentTarget as HTMLTextAreaElement).form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleInput = (e: Event) => {
    const el = e.currentTarget as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter++;
    if (dropOverlayEl) dropOverlayEl.classList.remove('hidden');
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && dropOverlayEl) {
      dragCounter = 0;
      dropOverlayEl.classList.add('hidden');
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropOverlayEl) dropOverlayEl.classList.add('hidden');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <footer class="px-6 pb-5 pt-1.5 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent shrink-0">
      <div class="min-h-5 px-1 mb-1.5 flex items-center justify-between text-[11px] leading-tight">
        <span id="chat-typing-indicator" class="text-zinc-400 italic">
          {typingText}
        </span>
        <span id="chat-error-banner" class="text-rose-400 font-medium">
          {errorMessage || ''}
        </span>
      </div>

      <input
        ref={(el) => {
          fileInputEl = el;
        }}
        type="file"
        id="chat-file-input"
        multiple
        class="hidden"
        onChange={(e) => {
          const files = (e.currentTarget as HTMLInputElement).files;
          if (files) addFiles(files);
          (e.currentTarget as HTMLInputElement).value = '';
        }}
      />

      <form
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2.5 shadow-2xl shadow-black/50 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex flex-col gap-2 relative"
      >
        <div
          ref={(el) => {
            dropOverlayEl = el;
          }}
          class="hidden absolute inset-0 bg-indigo-950/90 border-2 border-dashed border-indigo-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-indigo-200 z-20 pointer-events-none backdrop-blur-xs"
        >
          <PaperclipIcon class="size-4 animate-bounce" />
          <span>Drop files to attach</span>
        </div>

        <div
          ref={(el) => {
            attachmentsContainerEl = el;
          }}
          id="chat-attachments-preview"
          class="hidden flex flex-wrap gap-2 pt-1 pb-1 max-h-36 overflow-y-auto"
        />

        <textarea
          id="chat-message-input"
          name="message"
          rows={1}
          placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          class="w-full bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-500 resize-none outline-hidden min-h-7 max-h-40 leading-relaxed px-1.5 py-0.5"
        />

        <div class="flex items-center justify-between pt-1.5 border-t border-zinc-800/60">
          <div class="flex items-center gap-1.5 text-zinc-400">
            <button
              type="button"
              id="chat-attachment-btn"
              onClick={() => fileInputEl?.click()}
              class="size-7 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer text-zinc-500"
              title="Attach a file"
            >
              <PaperclipIcon class="size-3.5" />
            </button>
            <span class="text-[10px] text-zinc-600 hidden sm:inline font-mono">
              Markdown supported
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-zinc-500 hidden md:inline font-mono">
              ↵ to send
            </span>
            <button
              type="submit"
              class="size-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md shadow-indigo-600/30"
              title="Send message"
            >
              <SendIcon class="size-3.5" />
            </button>
          </div>
        </div>
      </form>
    </footer>
  );
};
