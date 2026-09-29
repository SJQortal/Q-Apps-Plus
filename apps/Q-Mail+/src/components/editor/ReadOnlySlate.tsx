import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createEditor, Descendant, Editor } from 'slate';
import { withReact, Slate, Editable, RenderElementProps, RenderLeafProps  } from 'slate-react';
import { renderElement, renderLeaf } from './BlogEditor';

interface ReadOnlySlateProps {
  content: any
  mode?: string
}
const ReadOnlySlate: React.FC<ReadOnlySlateProps> = ({ content, mode }) => {
  const [load, setLoad] = useState(false)
  const editor = useMemo(() => withReact(createEditor()), [])
  const value = useMemo(() => content, [content])

  const performUpdate = useCallback(async()=> {
    setLoad(true)
    await new Promise<void>((res)=> {
      setTimeout(() => {
          res()
      }, 250);
    })
    setLoad(false)
  }, [])
  useEffect(()=> {

  


    performUpdate()
  }, [value])

  if(load) return null

  return (
    <Slate editor={editor} value={value} onChange={() => {}}>
      <Editable
        readOnly
        renderElement={(props) => renderElement({ ...props, mode })}
        renderLeaf={renderLeaf}
      />
    </Slate>
  )
}

export default ReadOnlySlate;