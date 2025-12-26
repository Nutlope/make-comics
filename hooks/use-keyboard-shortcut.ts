import { useEffect } from 'react';

export function useKeyboardShortcut(
  callback: () => void,
  options: {
    ctrlOrCmd?: boolean;
    shift?: boolean;
    key?: string;
    disabled?: boolean;
  } = {}
) {
  const {
    ctrlOrCmd = true,
    shift = false,
    key = 'Enter',
    disabled = false,
  } = options;

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyPressed = e.key === key;
      const isModifierPressed = ctrlOrCmd
        ? (e.ctrlKey || e.metaKey) // Ctrl on Windows/Linux, Cmd on Mac
        : shift
        ? e.shiftKey
        : false;

      if (isKeyPressed && isModifierPressed) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callback, ctrlOrCmd, shift, key, disabled]);
}