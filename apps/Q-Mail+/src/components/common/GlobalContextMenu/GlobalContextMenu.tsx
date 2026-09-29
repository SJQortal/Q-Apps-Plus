import React, { useState, useEffect } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { CopyToClipboard } from 'react-copy-to-clipboard';

interface MousePosition {
  mouseX: number;
  mouseY: number;
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
      <CopyToClipboard text={textToCopy} onCopy={handleClose}>
        <MenuItem>Copy</MenuItem>
      </CopyToClipboard>
    </Menu>
  );
};

