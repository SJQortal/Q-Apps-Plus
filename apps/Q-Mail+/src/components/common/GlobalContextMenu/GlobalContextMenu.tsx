import React, { useState, useEffect } from 'react';
import { Menu, MenuItem } from '@mui/material';

interface MousePosition {
  mouseX: number;
  mouseY: number;
}

/** Copies `text` with the Clipboard API, falling back to execCommand in older WebViews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export const GlobalContextMenu: React.FC = () => {
  const [mousePosition, setMousePosition] = useState<MousePosition | null>(null);
  const [textToCopy, setTextToCopy] = useState<string>('');

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const selection = window.getSelection()?.toString();
    if (selection) {
      setTextToCopy(selection);
      setMousePosition({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
      });
    }
  };

  const handleClose = () => {
    setMousePosition(null);
  };

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu as any);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu as any);
    };
  }, []);

  return (
    <Menu
      open={mousePosition !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mousePosition !== null
          ? { top: mousePosition.mouseY, left: mousePosition.mouseX }
          : undefined
      }
    >
      <MenuItem
        sx={{ minHeight: 44 }}
        onClick={() => {
          void copyText(textToCopy);
          handleClose();
        }}
      >
        Copy
      </MenuItem>
    </Menu>
  );
};
