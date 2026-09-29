// src/components/BlogEditor.tsx
// @ts-nocheck

import React, { useMemo, useState, useCallback } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range } from 'slate'
import SvgIcon from '@material-ui/core/SvgIcon'
import {
  Slate,
  Editable,
  withReact,
  RenderElementProps,
  RenderLeafProps,
  useSlate
} from 'slate-react'
import { styled } from '@mui/system'
import { CustomElement, CustomText, FormatMark } from './customTypes'
import './BlogEditor.css'
import { Modal, Box, TextField, Button } from '@mui/material'

import { AlignCenterSVG } from '../../assets/svgs/AlignCenterSVG'
import { BoldSVG } from '../../assets/svgs/BoldSVG'
import { ItalicSVG } from '../../assets/svgs/ItalicSVG'
import { UnderlineSVG } from '../../assets/svgs/UnderlineSVG'
import { H2SVG } from '../../assets/svgs/H2SVG'
import { H3SVG } from '../../assets/svgs/H3SVG'
import { AlignLeftSVG } from '../../assets/svgs/AlignLeftSVG'
import { AlignRightSVG } from '../../assets/svgs/AlignRightSVG'
import { CodeBlockSVG } from '../../assets/svgs/CodeBlockSVG'
import { LinkSVG } from '../../assets/svgs/LinkSVG'

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: 'Start writing your blog post...' }]
  }
]

interface MyComponentProps {
  addPostSection?: (value: any) => void
  editPostSection?: (value: any, section: any) => void
  defaultValue?: any
  section?: any
  value: any
  setValue: (value: any) => void
  editorKey?: number
  mode?: string
}

const ModalBox = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[5],
  padding: theme.spacing(2, 4, 3),
  gap: '15px',
  borderRadius: '5px',
  alignItems: 'center',
  display: 'flex',
  flex: 0
}))

const BlogEditor: React.FC<MyComponentProps> = ({
  addPostSection,
  editPostSection,
  defaultValue,
  section,
  value,
  setValue,
  editorKey,
  mode
}) => {
  const editor = useMemo(() => withReact(createEditor()), [])

  // const [value, setValue] = useState(defaultValue || initialValue);
  const isTextAlignmentActive = (editor: Editor, alignment: string) => {
    const [match] = Editor.nodes(editor, {
      match: (n) => {
        return n?.textAlign === alignment?.replace(/^align-/, '')
      }
    })
    return !!match
  }

  const toggleTextAlignment = (editor: Editor, alignment: string) => {
    const isActive = isTextAlignmentActive(editor, alignment)
    Transforms.setNodes(
      editor,
      { style: { textAlign: isActive ? 'inherit' : alignment } },
      { match: (n) => Editor.isBlock(editor, n) }
    )
  }

  const toggleMark = (editor: Editor, format: FormatMark) => {
    if (
      format === 'align-left' ||
      format === 'align-center' ||
      format === 'align-right'
    ) {
      toggleTextAlignment(editor, format)
    } else {
      const isActive = Editor?.marks(editor)?.[format] === true
      if (isActive) {
        Editor?.removeMark(editor, format)
      } else {
        Editor?.addMark(editor, format, true)
      }
    }
  }

  const newValue = useMemo(() => [...(value || initialValue)], [value])

  const types = ['paragraph', 'heading-2', 'heading-3']

  const setTextAlignment = (editor, alignment) => {
    const isActive = isTextAlignmentActive(editor, alignment)
    const alignmentType = ''
    Transforms?.setNodes(
      editor,
      {
        textAlign: isActive ? null : alignment
      },
      {
        match: (n) =>
          n.type === 'heading-2' ||
          n.type === 'heading-3' ||
          n.type === 'paragraph'
      }
    )
  }

  const ToolbarButton: React.FC<{
    format: FormatMark | string
    label: string
    editor: Editor
    children: React.ReactNode
  }> = ({ format, label, editor, children }) => {
    useSlate()

    let onClick = () => {
      if (format === 'heading-2' || format === 'heading-3') {
        toggleBlock(editor, format)
      } else if (
        format === 'bold' ||
        format === 'italic' ||
        format === 'underline' ||
        format === ''
      ) {
        toggleMark(editor, format)
      } else if (
        format === 'align-left' ||
        format === 'align-center' ||
        format === 'align-right'
      ) {
        setTextAlignment(editor, format?.replace(/^align-/, ''))
      }
    }

    let isActive = false

    try {
      if (
        format === 'align-left' ||
        format === 'align-center' ||
        format === 'align-right'
      ) {
        isActive = isTextAlignmentActive(editor, format)
      } else if (format === 'heading-2' || format === 'heading-3') {
        isActive = isBlockActive(editor, format)
      } else if (
        format === 'bold' ||
        format === 'italic' ||
        format === 'underline' ||
        format === ''
      ) {
        isActive = Editor?.marks(editor)?.[format] === true
      }
    } catch (error) {}

    return (
      <button
        className={`toolbar-button ${isActive ? 'active' : ''}`}
        onMouseDown={(event) => {
          event.preventDefault()
          onClick()
        }}
      >
        {children ? children : label}
      </button>
    )
  }

  const ToolbarButtonCodeBlock: React.FC<{
    format: FormatMark | string
    label: string
    editor: Editor
    children: React.ReactNode
  }> = ({ format, label, editor, children }) => {
    const editor2 = useSlate()

    let onClick = () => {
      if (format === 'code-block') {
        toggleBlock(editor, 'code-block')
      }
    }
    let isActive = false
    try {
      if (format === 'code-block') {
        isActive = isBlockActive(editor, format)
      }
    } catch (error) {}

    return (
      <button
        className={`toolbar-button ${isActive ? 'active' : ''}`}
        onMouseDown={(event) => {
          event.preventDefault()
          onClick()
        }}
      >
        {children ? children : label}
      </button>
    )
  }

  const ToolbarButtonAlign: React.FC<{
    format: string
    label: string
    editor: Editor
  }> = ({ format, label, editor }) => {
    const isActive =
      Editor?.nodes(editor, {
        match: (n) => n?.align === format
      })?.length > 0

    return (
      <button
        className={`toolbar-button ${isActive ? 'active' : ''}`}
        onMouseDown={(event) => {
          event.preventDefault()
          Transforms?.setNodes(
            editor,
            { align: format },
            { match: (n) => Editor?.isBlock(editor, n) }
          )
        }}
      >
        {label}
      </button>
    )
  }

  const ToolbarButtonCodeLink: React.FC<{
    format: FormatMark | string
    label: string
    editor: Editor
    children: React.ReactNode
  }> = ({ format, label, editor, children }) => {
    useSlate()

    let isActive = false
    try {
      if (format === 'link') {
        isActive = !!Editor?.marks(editor)?.link
      }
    } catch (error) {}

    return (
      <button
        className={`toolbar-button ${isActive ? 'active' : ''}`}
        onMouseDown={(event) => {
          event.preventDefault()
          const isActive2 = !!Editor?.marks(editor)?.link
          if (isActive2) {
            Editor?.removeMark(editor, 'link')
            return
          }
          // const url = window.prompt('Enter the URL of the link:')
          setOpen(true)
        }}
      >
        {children ? children : label}
      </button>
    )
  }

  // Create a toggleBlock function and an isBlockActive function to handle block elements
  const toggleBlock = (editor: Editor, format: string) => {
    const isActive = isBlockActive(editor, format)
    Transforms?.unwrapNodes(editor, {
      match: (n) => Editor?.isBlock(editor, n),
      split: true
    })

    if (isActive) {
      Transforms?.setNodes(editor, { type: 'paragraph' })
    } else {
      Transforms?.setNodes(editor, { type: format })
    }
  }

  const isBlockActive = (editor: Editor, format: string) => {
    const [match] = Editor?.nodes(editor, {
      match: (n) => n?.type === format
    })
    return !!match
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && isBlockActive(editor, 'code-block')) {
      event.preventDefault()
      editor?.insertText('\n')
    }

    if (event.key === 'ArrowDown' && isBlockActive(editor, 'code-block')) {
      event.preventDefault()
      Transforms?.insertNodes(editor, {
        type: 'paragraph',
        children: [{ text: '' }]
      })
    }
  }

  const handleChange = (newValue: Descendant[]) => {
    setValue(newValue)
  }

  const toggleLink = (editor: Editor, url: string) => {
    const { selection } = editor

    if (selection && !Range.isCollapsed(selection)) {
      const isLink = Editor?.marks(editor)?.link === true
      const isInsideLink = isLinkActive(editor)

      if (isLink) {
        Editor?.removeMark(editor, 'link')
      } else if (url) {
        Editor?.addMark(editor, 'link', url)
      }
    }
  }

  const [open, setOpen] = useState(false)

  const initialValue = 'qortal://'
  const [inputValue, setInputValue] = useState(initialValue)

  const handleChangeLink = (event) => {
    const newValue = event?.target?.value
    if (newValue?.startsWith(initialValue)) {
      setInputValue(newValue)
    }
  }
  const isLinkActive = (editor: Editor) => {
    const [link] = Editor?.nodes(editor, {
      match: (n) => n?.type === 'link'
    })
    return !!link
  }
  const handleSaveClick = () => {
    const marks = Editor?.marks(editor)
    const isLink = marks?.link === true

    if (isLink) {
      Editor?.removeMark(editor, 'link')
      return // Return early to skip the rest of the function
    }
    toggleLink(editor, inputValue)
    setOpen(false)
  }

  const onClose = () => {
    setOpen(false)
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault()
    const text = event?.clipboardData?.getData('text/plain')
    const isCodeBlock = isBlockActive(editor, 'code-block')

    if (isCodeBlock) {
      const lines = text?.split('\n')
      const fragment: Descendant[] = [
        {
          type: 'code-block',
          children: lines?.map((line) => ({
            type: 'code-line',
            children: [{ text: line }]
          }))
        }
      ]

      Transforms?.insertFragment(editor, fragment)
    } else if (text) {
      const fragment = text?.split('\n').map((line) => ({
        type: 'paragraph',
        children: [{ text: line }]
      }))

      Transforms?.insertFragment(editor, fragment)
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        border: '1px solid',
        borderRadius: '5px',
        marginTop: '20px',
        padding: '10px'
      }}
    >
      <Slate
        editor={editor}
        value={newValue}
        onChange={(newValue) => handleChange(newValue)}
        key={editorKey || 1}
      >
        <div className="toolbar">
          <ToolbarButton format="bold" label="B" editor={editor}>
            <BoldSVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="italic" label="I" editor={editor}>
            <ItalicSVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="underline" label="U" editor={editor}>
            <UnderlineSVG height="24px" width="auto" />
          </ToolbarButton>

          <ToolbarButton format="heading-2" label="H2" editor={editor}>
            <H2SVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="heading-3" label="H3" editor={editor}>
            <H3SVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="align-left" label="L" editor={editor}>
            <AlignLeftSVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="align-center" label="C" editor={editor}>
            <AlignCenterSVG height="24px" width="auto" />
          </ToolbarButton>
          <ToolbarButton format="align-right" label="R" editor={editor}>
            <AlignRightSVG height="24px" width="auto" />
          </ToolbarButton>

          <ToolbarButtonCodeBlock
            format="code-block"
            label="Code"
            editor={editor}
          >
            <CodeBlockSVG height="24px" width="auto" />
          </ToolbarButtonCodeBlock>
          <ToolbarButtonCodeLink format="link" label="Link" editor={editor}>
            <LinkSVG height="24px" width="auto" />
          </ToolbarButtonCodeLink>
        </div>
        <Editable
          className="blog-editor"
          renderElement={(props) => renderElement({ ...props, mode })}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          mode={mode}
        />
      </Slate>
      <Modal open={open} onClose={onClose}>
        <ModalBox>
          <TextField
            label="Link"
            value={inputValue}
            onChange={handleChangeLink}
          />
          <Button variant="contained" onClick={handleSaveClick}>
            Save
          </Button>
        </ModalBox>
      </Modal>
      {editPostSection && (
        <Button onClick={() => editPostSection(value, section)}>
          Edit Section
        </Button>
      )}
    </Box>
  )
}

export default BlogEditor

type ExtendedRenderElementProps = RenderElementProps & { mode?: string }

export const renderElement = ({
  attributes,
  children,
  element,
  mode
}: ExtendedRenderElementProps) => {
  switch (element.type) {
    case 'block-quote':
      return <blockquote {...attributes}>{children}</blockquote>
    case 'heading-2':
      return (
        <h2
          className="h2"
          {...attributes}
          style={{ textAlign: element.textAlign }}
        >
          {children}
        </h2>
      )
    case 'heading-3':
      return (
        <h3
          className="h3"
          {...attributes}
          style={{ textAlign: element.textAlign }}
        >
          {children}
        </h3>
      )
    case 'code-block':
      return (
        <pre {...attributes} className="code-block">
          <code>{children}</code>
        </pre>
      )
    case 'code-line':
      return <div {...attributes}>{children}</div>
    case 'link':
      return (
        <a href={element.url} {...attributes}>
          {children}
        </a>
      )
    default:
      return (
        <p
          className={`paragraph${mode ? `-${mode}` : ''}`}
          {...attributes}
          style={{ textAlign: element.textAlign }}
        >
          {children}
        </p>
      )
  }
}


export const renderLeaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  let el = children

  if (leaf.bold) {
    el = <strong>{el}</strong>
  }

  if (leaf.italic) {
    el = <em>{el}</em>
  }

  if (leaf.underline) {
    el = <u>{el}</u>
  }

  if (leaf.link) {
    el = (
      <a href={leaf.link} {...attributes}>
        {el}
      </a>
    )
  }

  return <span {...attributes}>{el}</span>
}