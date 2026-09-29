import React, { useEffect, useImperativeHandle, useState } from "react";
import { Autocomplete, SxProps, Theme } from "@mui/material";
import { CustomInputField } from "../PublishIssue/PublishIssue-styles.tsx";
import { log } from "../../constants/Misc.ts";

interface AutoCompleteQappNamesProps {
  namesList?: string[];
  afterChange?: (selectedName: string) => void;
  sx?: SxProps<Theme>;
  required?: boolean;
  initialSelection?: string;
}

export type QappNamesRef = {
  getSelectedValue: () => string;
  setSelectedValue: (selectedValue: string) => void;
  getQappNameFetchString: () => string;
};

export const AutocompleteQappNames = React.forwardRef<
  QappNamesRef,
  AutoCompleteQappNamesProps
>(
  (
    {
      namesList,
      afterChange,
      sx,
      required = true,
      initialSelection = null,
    }: AutoCompleteQappNamesProps,
    ref
  ) => {
    const [QappNamesList, setQappNamesList] = useState<string[]>([]);

    const [selectedQappName, setSelectedQappName] = useState<string>(
      initialSelection || null
    );

    if (log) console.log("initial selection: ", initialSelection);
    useEffect(() => {
      if (namesList) {
        if (log) console.log("prop namesList: ", namesList);
        setQappNamesList(namesList);
        return;
      }

      getPublishedQappNames().then((names: string[]) => {
        setQappNamesList(names);
        if (log) console.log("QappNames set manually");
      });
    }, []);

    useEffect(() => {
      setSelectedQappName(initialSelection || null);
    }, [initialSelection]);

    useImperativeHandle(ref, () => ({
      getSelectedValue: () => {
        return selectedQappName;
      },
      setSelectedValue: (selectedValue: string) => {
        setSelectedQappName(selectedValue);
      },
      getQappNameFetchString: () => {
        return getQappNameFetchString(selectedQappName);
      },
    }));
    return (
      <Autocomplete
        options={QappNamesList}
        value={selectedQappName}
        onChange={(e, newValue) => {
          setSelectedQappName(newValue);
          if (afterChange) afterChange(newValue || null);
        }}
        sx={{ height: "100px", ...sx }}
        renderInput={params => (
          <CustomInputField
            {...params}
            label={"Q-App/Website Name"}
            value={selectedQappName}
            variant={"filled"}
            required={required}
          />
        )}
      />
    );
  }
);

export interface MetaData {
  title: string;
  description: string;
  tags: string[];
  mimeType: string;
}

export interface SearchResourcesResponse {
  name: string;
  service: string;
  identifier: string;
  metadata?: MetaData;
  size: number;
  created: number;
  updated: number;
}

const searchService = (service: string) => {
  return qortalRequest({
    action: "SEARCH_QDN_RESOURCES",
    service: service,
    limit: 0,
  });
};

export const getPublishedQappNames = async () => {
  const QappList: Promise<SearchResourcesResponse[]> = searchService("APP");
  const siteList: Promise<SearchResourcesResponse[]> = searchService("WEBSITE");

  const responses = await Promise.all([QappList, siteList]);
  const processedQappList = responses[0].map(value => value.name);
  const processedWebsiteList = responses[1].map(value => value.name);

  const removedDuplicates = Array.from(
    new Set<string>([...processedQappList, ...processedWebsiteList])
  );
  return removedDuplicates.sort((a, b) => {
    return a.localeCompare(b);
  });
};

export const getQappNameFetchString = (selectedQappName: string) => {
  return selectedQappName ? `Qapp:${selectedQappName};` : "";
};
