import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}

interface RichTextEditorHandle {
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  getSelection: () => { start: number; end: number; text: string };
  focus: () => void;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, onKeyDown, placeholder, className }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const undoStackRef = useRef<string[]>([]);
    const redoStackRef = useRef<string[]>([]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        if (!textareaRef.current) return;
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newValue = value.slice(0, start) + text + value.slice(end);
        
        onChange(newValue);
        
        // カーソル位置を調整
        setTimeout(() => {
          if (textareaRef.current) {
            const newPosition = start + text.length;
            textareaRef.current.selectionStart = newPosition;
            textareaRef.current.selectionEnd = newPosition;
            textareaRef.current.focus();
          }
        }, 0);
      },

      wrapSelection: (before: string, after: string) => {
        if (!textareaRef.current) return;
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selectedText = value.slice(start, end);
        const newText = before + selectedText + after;
        const newValue = value.slice(0, start) + newText + value.slice(end);
        
        onChange(newValue);
        
        // 選択範囲を調整
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + before.length;
            textareaRef.current.selectionEnd = start + before.length + selectedText.length;
            textareaRef.current.focus();
          }
        }, 0);
      },

      getSelection: () => {
        if (!textareaRef.current) {
          return { start: 0, end: 0, text: '' };
        }
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = value.slice(start, end);
        
        return { start, end, text };
      },

      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Zで元に戻す
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStackRef.current.length > 0) {
          const previousValue = undoStackRef.current.pop()!;
          redoStackRef.current.push(value);
          onChange(previousValue);
        }
      }
      
      // Ctrl+Shift+Zでやり直し
      if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (redoStackRef.current.length > 0) {
          const nextValue = redoStackRef.current.pop()!;
          undoStackRef.current.push(value);
          onChange(nextValue);
        }
      }

      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      // Undo履歴に追加
      if (Math.abs(newValue.length - value.length) > 10 || 
          newValue.charAt(newValue.length - 1) === '\n') {
        undoStackRef.current.push(value);
        if (undoStackRef.current.length > 50) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = [];
      }
      
      onChange(newValue);
    };

    // タブキー対応
    const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;
        
        if (start === end) {
          // タブ文字を挿入
          const newValue = value.slice(0, start) + '　' + value.slice(end);
          onChange(newValue);
          
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = start + 1;
              textareaRef.current.selectionEnd = start + 1;
            }
          }, 0);
        } else {
          // 選択範囲をインデント
          const lines = value.slice(start, end).split('\n');
          const indentedLines = lines.map(line => '　' + line);
          const newText = indentedLines.join('\n');
          const newValue = value.slice(0, start) + newText + value.slice(end);
          
          onChange(newValue);
          
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = start;
              textareaRef.current.selectionEnd = start + newText.length;
            }
          }, 0);
        }
      }
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          handleTab(e);
          handleKeyDown(e);
        }}
        placeholder={placeholder}
        className={className}
        spellCheck={false}
      />
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';