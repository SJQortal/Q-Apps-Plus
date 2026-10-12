/** A header button that copies a `qortal://APP/Q-Mintership+/…` link to this page. */
import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { appLink, copyText } from '../../../utils/links';

export function CopyLinkButton({ path, what = 'this page' }: { path: string; what?: string }) {
  const [copied, setCopied] = useState(false);
  const label = copied ? 'Link copied' : `Copy a link to ${what}`;
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={async () => {
          if (await copyText(appLink(path))) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        sx={{ width: 44, height: 44 }}
      >
        {copied ? <CheckOutlinedIcon /> : <LinkOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
