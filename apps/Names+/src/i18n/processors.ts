import type { PostProcessorModule } from 'i18next';

export const capitalizeAll: PostProcessorModule = {
  type: 'postProcessor',
  name: 'capitalizeAll',
  process: (value: string) => value.toUpperCase(),
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
