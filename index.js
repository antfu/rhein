const EOL = '\n'
const SPACE = ' '
const OPTIONS_COMMON = {
  lineWrapping: false,
  tabSize: 2,
  lineSeparator: EOL,
  indentWithTabs: false,
  scrollbarStyle: null,
  extraKeys: CodeMirror.normalizeKeyMap({
    Tab: (cm) => cm.execCommand('indentMore'),
    'Shift-Tab': (cm) => cm.execCommand('indentLess'),
    'Shift-Space': onShiftSpace,
    Enter: onEnterPressed,
    Backspace: onBackspacePressed('backspace'),
    Delete: onBackspacePressed('delete'),
    'Ctrl-D': onBackspacePressed('backspace'),
    'Cmd-D': onBackspacePressed('backspace'),
    'Ctrl-X': onCut,
    'Cmd-X': onCut,
  }),
}
const FONT_HEIGHT = 12
const FONT_WIDTH = 6
const STORE_TEXT = 'rhein-editor'
const STORE_CURSOR = 'rhein-editor-cursor'
const HTML = document.documentElement
const START_CURSOR = JSON.parse(
  localStorage.getItem(STORE_CURSOR) || '{ "line": 3, "ch": 8 }'
)
const DEFAULT_CONFIG = () => ({
  schema: null,
  font: 'Fira Code Retina',
  size: '14',
})
const DEFAULT_VALUE = `
   rhein.
`
let configs = DEFAULT_CONFIG()

const load = () => localStorage.getItem(STORE_TEXT) || DEFAULT_VALUE
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
  readConfigs()
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
  return (cm) => {
    const selections = cm.listSelections()
    for (const selection of selections.reverse()) {
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
      }
    }
    updateFillNow()
  }
}
function onCut(cm) {
  navigator.clipboard.writeText(cm.getSelections().join('\n'))
  onBackspacePressed('backspace')(cm)
}
function onShiftSpace(cm) {
  cm.replaceRange(SPACE, cm.getCursor(), cm.getCursor())
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

function squareRanges({ head, anchor }) {
  const l_start = Math.min(head.line, anchor.line)
  const l_end = Math.max(head.line, anchor.line)
  const c_start = Math.min(head.ch, anchor.ch)
  const c_end = Math.max(head.ch, anchor.ch)
  const result = []
  for (let line = l_start; line <= l_end; line++) {
    result.push({
      head: { line: line, ch: c_start },
      anchor: { line: line, ch: c_end },
    })
  }
  return result
}
function getLastMatch(value, re) {
  const result = Array.from(value.matchAll(re))
  if (!result?.length) return null
  return result[result.length - 1][1]
}
function getSystemSchema() {
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}
function readConfigs(value) {
  value = value || cm.getValue()
  configs = DEFAULT_CONFIG()

  configs.schema =
    getLastMatch(value, / r\.schema (dark|light|auto) /g) || 'auto'
  configs.font = `'${getLastMatch(value, / r\.font (.+?)  /g) || configs.font}'`
  configs.size = `${Math.max(
    12,
    +(getLastMatch(value, / r\.size ([\d.]+?) /g) || configs.size)
  )}px`

  updateConfigs()
}
function updateConfigs() {
  HTML.style = `
  --config-font: ${configs.font};
  --config-size: ${configs.size};
`
  HTML.className =
    configs.schema === 'dark'
      ? 'dark'
      : configs.schema === 'light'
      ? 'light'
      : getSystemSchema()
  cm.refresh()
}

cm.setSize('100%', '100%')
cm.toggleOverwrite(true)
cm.on('beforeChange', (_, { origin, text, cancel }) => {
  if (origin === 'setValue') {
    return
  } else if (origin === 'paste') {
    cancel()
    const { line, ch } = cm.getCursor()
    text.forEach((t, i) => {
      cm.replaceRange(
        t,
        { line: line + i, ch },
        { line: line + i, ch: ch + t.length }
      )
    })
    cm.setCursor({ line, ch })
  }
})
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
cm.on('beforeSelectionChange', (_, e) => {
  const { ranges } = e
  if (ranges.length) {
    const head = sortedSelection(ranges[0]).head
    const anchor = sortedSelection(ranges[ranges.length - 1]).anchor

    e.update(squareRanges({ head, anchor }))
  }
})

cm.setCursor(START_CURSOR)
cm.focus()

readConfigs()
