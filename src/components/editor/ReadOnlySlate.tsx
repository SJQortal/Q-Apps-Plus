/**
 * Renders the legacy Slate document format (`textContent` in mail JSON
 * written by Q-Mail before textContentV2 HTML) without slate-react, which
 * uses findDOMNode and cannot run on React 19. The element and mark types
 * are exactly the ones the old BlogEditor produced: paragraph, heading-2,
 * heading-3, block-quote, code-block, code-line and link elements, and
 * bold, italic, underline and link marks.
 */
import React from 'react'
import { linkPolicy } from '../common/TextEditor/DisplayHtml'

type SlateText = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  code?: boolean
  link?: string
}

type SlateElement = {
  type?: string
  url?: string
  textAlign?: React.CSSProperties['textAlign']
  children?: SlateNode[]
}

export type SlateNode = SlateText | SlateElement

interface ReadOnlySlateProps {
  content: SlateNode[] | unknown
  mode?: string
}

const isText = (node: SlateNode): node is SlateText =>
  typeof (node as SlateText).text === 'string'

const nodeText = (nodes: SlateNode[] | undefined): string =>
  (Array.isArray(nodes) ? nodes : [])
    .map((node) => (!node || typeof node !== 'object' ? '' : isText(node) ? node.text : nodeText(node.children)))
    .join('')

/**
 * A sender-written link, through the same policy as HTML bodies
 * (DisplayHtml.linkPolicy): qortal:// links stay links; web, mail and phone
 * links can't open in Hub, so they show as text with their target; anything
 * else (relative, same-origin, data:) is plain text, because it would load
 * another page, such as another Q-App, inside the Q-Mail+ frame.
 */
const renderLink = (href: string | undefined, children: React.ReactNode, text: string, key?: React.Key) => {
  const decision = linkPolicy(typeof href === 'string' ? href : '')
  if (decision.kind === 'qortal') {
    return (
      <a key={key} href={decision.href}>
        {children}
      </a>
    )
  }
  if (decision.kind === 'copy') {
    const target = decision.copy.text
    return (
      <span key={key} title={target}>
        {children}
        {text.includes(target) ? null : ` (${target})`}
      </span>
    )
  }
  return <React.Fragment key={key}>{children}</React.Fragment>
}

const renderLeaf = (leaf: SlateText, key: React.Key) => {
  let el: React.ReactNode = leaf.text
  if (leaf.bold) el = <strong>{el}</strong>
  if (leaf.italic) el = <em>{el}</em>
  if (leaf.underline) el = <u>{el}</u>
  if (leaf.code) el = <code>{el}</code>
  if (leaf.link) el = renderLink(leaf.link, el, leaf.text)
  return <span key={key}>{el}</span>
}

const renderNodes = (nodes: SlateNode[] | undefined, mode?: string): React.ReactNode =>
  (Array.isArray(nodes) ? nodes : []).map((node, index) => {
    if (!node || typeof node !== 'object') return null
    if (isText(node)) return renderLeaf(node, index)
    const children = renderNodes(node.children, mode)
    const style = node.textAlign ? { textAlign: node.textAlign } : undefined
    switch (node.type) {
      case 'block-quote':
        return <blockquote key={index}>{children}</blockquote>
      case 'heading-2':
        return (
          <h2 key={index} className="h2" style={style}>
            {children}
          </h2>
        )
      case 'heading-3':
        return (
          <h3 key={index} className="h3" style={style}>
            {children}
          </h3>
        )
      case 'code-block':
        return (
          <pre key={index} className="code-block">
            <code>{children}</code>
          </pre>
        )
      case 'code-line':
        return <div key={index}>{children}</div>
      case 'link':
        return renderLink(node.url, children, nodeText(node.children), index)
      default:
        return (
          <p key={index} className={`paragraph${mode ? `-${mode}` : ''}`} style={style}>
            {children}
          </p>
        )
    }
  })

const ReadOnlySlate = ({ content, mode }: ReadOnlySlateProps) => {
  if (!Array.isArray(content)) return null
  return <div className="slate-readonly">{renderNodes(content as SlateNode[], mode)}</div>
}

export default ReadOnlySlate
