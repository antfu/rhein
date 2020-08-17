const EOL = '\n'
const SPACE = ' '
const OPTIONS_COMMON = {
  lineWrapping: false,
  tabSize: 2,
  lineSeparator: EOL,
  indentWithTabs: false,
  extraKeys: {
    Tab: (cm) => cm.execCommand('indentMore'),
    'Shift-Tab': (cm) => cm.execCommand('indentLess'),
    Enter: onEnterPressed,
    Backspace: onBackspacePressed('backspace'),
    Delete: onBackspacePressed('delete'),
  },
}
const FONT_HEIGHT = 12
const FONT_WIDTH = 6
const STORE_TEXT = 'rhein-editor'
const STORE_CURSOR = 'rhein-editor-cursor'
const DEFAULT = `
   rhein.
`
const START_CURSOR = JSON.parse(
  localStorage.getItem(STORE_CURSOR) || '{ "line": 3, "ch": 8 }'
)

const load = () => localStorage.getItem(STORE_TEXT) || DEFAULT
const save = (value) =>
  localStorage.setItem(
    STORE_TEXT,
    value
      .trimEnd()
      .split(EOL)
      .map((i) => i.trimEnd())
      .join(EOL)
  )

const cm = CodeMirror(document.getElementById('editor'), {
  ...OPTIONS_COMMON,
  value: fill(load()),
})
const updateFillNow = () => {
  set(cm, fill(cm.getValue()))
}
const updateFill = throttle(updateFillNow)

function set(cm, v) {
  const selections = cm.listSelections()
  cm.setValue(v)
  cm.setSelections(selections)
}
function onEnterPressed(cm) {
  const { line, ch } = cm.getCursor()
  const text = cm.getRange({ line, ch: 0 }, { line, ch })
  let space = 0
  let targetCh = ch
  for (let i = ch; i >= 0; i--) {
    if (text[i] === SPACE) {
      space++
      if (space === 2) {
        targetCh = i + 2
        break
      }
    } else {
      space = 0
    }
  }
  cm.setCursor({ line: line + 1, ch: targetCh })
}
function isSamePos(a, b) {
  return a.line === b.line && a.ch === b.ch
}
function sortedSelection({ anchor, head }) {
  if (anchor.line === head.line) {
    if (anchor.ch < head.ch) return { anchor: head, head: anchor }
  } else {
    if (anchor.line < head.line) return { anchor: head, head: anchor }
  }
  return { anchor, head }
}
function onBackspacePressed(type) {
  return (cm, a) => {
    const selections = cm.listSelections()
    for (const selection of selections) {
      const { anchor, head } = sortedSelection(selection)
      if (isSamePos(anchor, head)) {
        const { line, ch } = anchor
        cm.replaceRange(
          SPACE,
          { line, ch: ch + (type === 'delete' ? 1 : -1) },
          anchor
        )
        cm.setCursor({ line, ch: ch + (type === 'delete' ? 0 : -1) })
      } else {
        let space = ''
        if (anchor.line === head.line)
          space = new Array(anchor.ch - head.ch).fill(SPACE).join('')
        else
          space =
            new Array(anchor.line - head.line + 1).fill('').join(EOL) +
            new Array(anchor.ch).fill(SPACE).join('')

        cm.replaceRange(space, head, anchor)
        cm.setCursor(head)
        updateFillNow()
      }
    }
  }
}
function throttle(func, delay = 1000) {
  let timer
  return () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func()
    }, delay)
  }
}

function fill(text) {
  const lines = 90
  const columns = 300
  const textLines = text.split(EOL)

  const result = []
  for (let l = 0; l < Math.max(lines, textLines.length); l++) {
    const tLine = (textLines[l] || '').trimEnd()
    let line = ''
    for (let c = 0; c < Math.max(columns, tLine.length); c++) {
      line += tLine[c] || SPACE
    }
    result.push(line)
  }

  return result.join(EOL)
}

cm.setSize('100%', '100%')
cm.toggleOverwrite(true)

cm.on('change', (_, { origin }) => {
  if (origin === 'setValue') {
    return
  }

  save(cm.getValue())
  updateFill()
})

cm.on('cursorActivity', () => {
  localStorage.setItem(STORE_CURSOR, JSON.stringify(cm.getCursor()))
})

cm.setCursor(START_CURSOR)
cm.focus()
