// src/customTypes.ts
import { BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';

export type CustomText = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  code?: boolean
}

export type HeadingElement = {
  type: 'heading'
  children: CustomText[]
}

export type BlockQuoteElement = {
  type: 'block-quote'
  children: CustomText[]
}

export type ParagraphElement = {
  type: 'paragraph'
  children: CustomText[]
}

export type CodeBlockElement = {
  type: 'code-block'
  children: CustomText[]
}

export type CustomElement =
  | HeadingElement
  | BlockQuoteElement
  | ParagraphElement
  | CodeBlockElement

export type FormatMark = 'bold' | 'italic' | 'underline' | 'code'

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
