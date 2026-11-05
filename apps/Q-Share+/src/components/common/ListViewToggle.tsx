import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useAppSettings, writeSettings, type ListView } from "../../utils/settings";

/** Which layout setting a list follows: Home and profiles, or collections (a grid by default). */
export type LayoutSetting = "listView" | "collectionView";

/** The list layout the user chose (Settings, or this toggle on a list). */
export function useListView(setting: LayoutSetting = "listView"): ListView {
  return useAppSettings()[setting];
}

/**
 * Switches share lists between rows and a grid of cards. The choice is a
 * setting: Home and profiles follow one, collections and folders another.
 */
export function ListViewToggle({ setting = "listView" }: { setting?: LayoutSetting }) {
  const phone = usePhoneLayout();
  const view = useListView(setting);
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={view}
      onChange={(_e, next: ListView | null) => next && writeSettings({ [setting]: next })}
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
