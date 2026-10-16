/** Grid or list, for an Explorer list (Names, Groups): two 44 px toggle buttons. */
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import type { ListView } from './useListView';

export function ViewToggle({
  view,
  onView,
  label,
}: {
  view: ListView;
  onView: (view: ListView) => void;
  /** What the buttons lay out: "Show the names as". */
  label: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={view}
      onChange={(_, value: ListView | null) => {
        if (value) onView(value);
      }}
      aria-label={label}
      sx={{ ml: 'auto' }}
    >
      <ToggleButton value="grid" aria-label="Grid" sx={{ width: 44, height: 44 }}>
        <GridViewOutlinedIcon />
      </ToggleButton>
      <ToggleButton value="list" aria-label="List" sx={{ width: 44, height: 44 }}>
        <ViewListOutlinedIcon />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
