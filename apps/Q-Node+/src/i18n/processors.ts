import type { PostProcessorModule } from 'i18next';

export const capitalizeAll: PostProcessorModule = {
  type: 'postProcessor',
  name: 'capitalizeAll',
  process: (value: string) => value.toUpperCase(),
};

export const capitalizeEachFirstChar: PostProcessorModule = {
  type: 'postProcessor',
  name: 'capitalizeEachFirstChar',
  process: (value: string) => {
    if (!value?.trim()) return value;

    const leadingSpaces = value.match(/^\s*/)?.[0] || '';
    const trailingSpaces = value.match(/\s*$/)?.[0] || '';

    const core = value
      .trim()
      .split(/\s+/)
      .map(
        (word) =>
          word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()
      )
      .join(' ');

    return leadingSpaces + core + trailingSpaces;
  },
};

export const capitalizeFirstChar: PostProcessorModule = {
  type: 'postProcessor',
  name: 'capitalizeFirstChar',
  process: (value: string) => value.charAt(0).toUpperCase() + value.slice(1),
};

export const capitalizeFirstWord: PostProcessorModule = {
  type: 'postProcessor',
  name: 'capitalizeFirstWord',
  process: (value: string) => {
    if (!value?.trim()) return value;

    const trimmed = value.trimStart();
    const firstSpaceIndex = trimmed.indexOf(' ');

    if (firstSpaceIndex === -1) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    const firstWord = trimmed.slice(0, firstSpaceIndex);
    const restOfString = trimmed.slice(firstSpaceIndex);
    const trailingSpaces = value.slice(trimmed.length);

    return firstWord.toUpperCase() + restOfString + trailingSpaces;
  },
};
