import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) props.command({ id: item.id, label: item.label })
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    }
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[200px]">
      {props.items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-400">Aucun résultat</div>
      ) : (
        props.items.map((item: any, index: number) => (
          <div
            key={item.id}
            onClick={() => selectItem(index)}
            className={`px-3 py-1.5 text-sm cursor-pointer rounded ${
              index === selectedIndex
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-800 hover:bg-gray-50'
            }`}
          >
            @{item.label}
          </div>
        ))
      )}
    </div>
  )
})
MentionList.displayName = 'MentionList'
export default MentionList