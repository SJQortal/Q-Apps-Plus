import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useAppSettings, writeSettings, type ListView } from "../../utils/settings";

/** The list layout the user chose (Settings, or this toggle on a list). */
export function useListView(): ListView {
  return useAppSettings().listView;
}

/**
 * Switches every share list between rows and a grid of cards. The choice is
 * a setting, so Home, profiles and collections follow it together.
 */
export function ListViewToggle() {
  const phone = usePhoneLayout();
  const view = useListView();
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={view}
      onChange={(_e, next: ListView | null) => next && writeSettings({ listView: next })}
      aria-label="Layout"
      sx={{ "& .MuiToggleButton-root": { minHeight: phone ? 44 : 40, minWidth: phone ? 44 : 40, px: 1 } }}
    >
      {/* ToggleButtonGroup clones its direct children, so no Tooltip wrappers: a title does the job. */}
      <ToggleButton value="list" aria-label="List" title="List">
        <ViewAgendaOutlinedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="grid" aria-label="Grid" title="Grid">
        <GridViewOutlinedIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
