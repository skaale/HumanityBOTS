<template>
  <div class="live-code-editor rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden flex flex-col min-h-0 shadow-[var(--shadow-card)]">
    <div ref="editorHost" class="flex-1 min-h-[200px] overflow-auto"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { EditorState, StateField, StateEffect } from '@codemirror/state'
import { EditorView, lineNumbers, keymap, gutter, GutterMarker, Decoration, ViewPlugin } from '@codemirror/view'
import { python } from '@codemirror/lang-python'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'

const AGENT_PALETTE = [
  '#7dd3fc', '#86efac', '#fcd34d', '#f9a8d4', '#a5b4fc', '#f472b6', '#67e8f9', '#bef264'
]

function getAgentColor(agentId: string, agentColors?: Record<string, string>): string {
  if (agentColors?.[agentId]) return agentColors[agentId]
  let h = 0
  for (let i = 0; i < agentId.length; i++) h = (h << 5) - h + agentId.charCodeAt(i)
  return AGENT_PALETTE[Math.abs(h) % AGENT_PALETTE.length]
}

class AgentGutterMarker extends GutterMarker {
  constructor(
    public label: string,
    public title: string,
    public color: string
  ) {
    super()
  }
  eq(other: AgentGutterMarker) {
    return other instanceof AgentGutterMarker && other.label === this.label && other.color === this.color
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'agent-gutter-cell'
    el.textContent = this.label
    el.title = this.title
    el.style.borderLeft = `3px solid ${this.color}`
    el.style.paddingLeft = '4px'
    return el
  }
}

export type AttributionMap = Record<number, { agentId: string; agentName: string }>

const props = withDefaults(
  defineProps<{
    modelValue: string
    lineAttribution?: AttributionMap
    agentColors?: Record<string, string>
    readOnly?: boolean
  }>(),
  { readOnly: true }
)

const editorHost = ref<HTMLElement | null>(null)
let view: EditorView | null = null
const agentColorsRef = ref<Record<string, string>>(props.agentColors ?? {})

const setAttributionEffect = StateEffect.define<AttributionMap>()
const attributionField = StateField.define<AttributionMap>({
  create: () => ({}),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setAttributionEffect)) return e.value
    return value
  }
})

function createEditor() {
  if (!editorHost.value) return
  agentColorsRef.value = props.agentColors ?? {}
  const agentLinePlugin = ViewPlugin.fromClass(
    class {
      decorations: import('@codemirror/view').DecorationSet
      constructor(readonly view: EditorView) {
        this.decorations = this.buildDecos(view)
      }
      update(update: import('@codemirror/view').ViewUpdate) {
        if (update.docChanged || update.state.field(attributionField) !== update.startState.field(attributionField))
          this.decorations = this.buildDecos(update.view)
      }
      buildDecos(view: EditorView) {
        const attr = view.state.field(attributionField)
        const doc = view.state.doc
        const text = doc.toString()
        const lines = text.split('\n')
        const colors = agentColorsRef.value
        const ranges: { from: number; to: number; value: ReturnType<typeof Decoration.line> }[] = []
        let pos = 0
        for (let i = 0; i < lines.length; i++) {
          const a = attr[i]
          if (a) {
            const color = getAgentColor(a.agentId, colors)
            const lineDeco = Decoration.line({ attributes: { style: `border-left: 2px solid ${color}; padding-left: 4px; box-sizing: border-box;` } })
            ranges.push({ from: pos, to: pos + lines[i].length, value: lineDeco })
          }
          pos += lines[i].length + 1
        }
        return Decoration.set(ranges.map((r) => r.value.range(r.from, r.from)))
      }
    },
    { decorations: (v) => v.decorations }
  )
  const extensions = [
    lineNumbers(),
    attributionField,
    python(),
    EditorView.lineWrapping,
    EditorView.editable.of(!props.readOnly),
    EditorState.readOnly.of(props.readOnly),
    keymap.of([...defaultKeymap, indentWithTab]),
    gutter({
      class: 'agent-gutter',
      lineMarker: (v, line, _otherMarkers) => {
        const attr = v.state.field(attributionField)
        const lineNo = v.state.doc.lineAt(line.from).number
        const a = attr[lineNo - 1]
        if (!a) return null
        const name = a.agentName || a.agentId
        const color = getAgentColor(a.agentId, agentColorsRef.value)
        return new AgentGutterMarker(name.slice(0, 2), `Written by ${name}`, color)
      },
      lineMarkerChange: (update) =>
        update.state.field(attributionField) !== update.startState.field(attributionField)
    }),
    EditorView.theme({
      '&': { fontSize: '13px' },
      '.cm-scroller': { fontFamily: 'var(--font-mono), "JetBrains Mono", Consolas, monospace' },
      '.cm-content': { padding: '12px 0', minHeight: '100px' },
      '.cm-line': { padding: '0 12px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-gutters': {
        backgroundColor: '#252526',
        borderRight: '1px solid var(--border-subtle)',
        minWidth: '32px'
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px', minWidth: '28px' },
      '.agent-gutter': { minWidth: '28px' },
      '.agent-gutter-cell': {
        fontSize: '10px',
        opacity: 0.95,
        padding: '0 4px'
      }
    }),
    agentLinePlugin
  ]
  const state = EditorState.create({
    doc: props.modelValue || '# Code will appear here as agents write (Python)…',
    extensions
  })
  view = new EditorView({ state, parent: editorHost.value })
  if (props.lineAttribution && Object.keys(props.lineAttribution).length > 0) {
    view.dispatch({ effects: setAttributionEffect.of(props.lineAttribution) })
  }
}

function updateDoc(content: string) {
  if (!view) return
  const current = view.state.doc.toString()
  if (current === content) return
  view.dispatch({
    changes: { from: 0, to: current.length, insert: content || '# Code will appear here as agents write (Python)…' }
  })
}

function setAttribution(attr: AttributionMap) {
  if (!view) return
  view.dispatch({ effects: setAttributionEffect.of(attr || {}) })
}

onMounted(() => createEditor())

watch(
  () => props.modelValue,
  (v) => updateDoc(v ?? ''),
  { immediate: true }
)

watch(
  () => props.lineAttribution,
  (attr) => attr && setAttribution(attr),
  { deep: true }
)

watch(
  () => props.agentColors,
  (v) => {
    agentColorsRef.value = v ?? {}
    view?.dispatch({})
  },
  { deep: true }
)

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>
