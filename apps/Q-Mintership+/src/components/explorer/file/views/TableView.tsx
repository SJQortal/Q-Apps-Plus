/**
 * A CSV or TSV file as a table (rules/explorer/fileText.ts parseTable): its
 * first row as the header, the first 500 rows, scrolling both ways inside
 * the viewer; "Show as text" for the file as written.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { parseTable } from '../../../../rules/explorer/fileText';
import { formatCount } from '../../../../utils/format';
import { TextView } from './TextView';
import { PartNote } from './PartNote';

/** Rows shown in the table. */
export const TABLE_ROWS = 500;

export function TableView({
  text,
  label,
  shown,
  size,
  more,
}: {
  text: string;
  label: string;
  shown: number;
  size: number | null;
  more: boolean;
}) {
  const [asText, setAsText] = useState(false);
  const table = useMemo(
    () => parseTable(text, { maxRows: TABLE_ROWS + 1, partial: more }),
    [text, more]
  );
  if (asText || table.rows.length < 2)
    return (
      <TextView
        text={text}
        label={label}
        shown={shown}
        size={size}
        more={more}
        extra={
          table.rows.length >= 2 ? (
            <Button onClick={() => setAsText(false)} sx={{ minHeight: 44 }}>
              Show as a table
            </Button>
          ) : undefined
        }
      />
    );
  const [header, ...body] = table.rows;
  const rows = body.slice(0, TABLE_ROWS);
  const width = Math.max(...table.rows.map((row) => row.length));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 200px' }}>
          {formatCount(rows.length)} {rows.length === 1 ? 'row' : 'rows'} under its header
          {table.truncated && !more ? `, the first ${formatCount(TABLE_ROWS)}` : ''}.
        </Typography>
        <Button onClick={() => setAsText(true)} sx={{ minHeight: 44 }}>
          Show as text
        </Button>
      </Box>
      <Box
        role="region"
        tabIndex={0}
        aria-label={label}
        sx={(theme) => ({
          flex: 1,
          minHeight: 160,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}
      >
        <Box
          component="table"
          sx={(theme) => ({
            borderCollapse: 'collapse',
            minWidth: '100%',
            fontSize: 14,
            '& th, & td': {
              px: 1.25,
              py: 0.75,
              textAlign: 'left',
              verticalAlign: 'top',
              borderBottom: `1px solid ${theme.palette.divider}`,
              whiteSpace: 'pre-wrap',
              maxWidth: 320,
              overflowWrap: 'anywhere',
            },
            '& th': {
              position: 'sticky',
              top: 0,
              bgcolor: 'background.paper',
              fontWeight: 700,
              zIndex: 1,
            },
          })}
        >
          <thead>
            <tr>
              {Array.from({ length: width }, (_, i) => (
                <th key={i} scope="col">
                  {header[i] ?? ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: width }, (_, i) => (
                  <td key={i}>{row[i] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      <PartNote shown={shown} size={size} more={more} />
    </Box>
  );
}
