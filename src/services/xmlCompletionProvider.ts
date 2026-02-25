/**
 * Registers a Monaco completion item provider for the agentSystem XML schema.
 * Context-aware: suggests elements and attributes based on cursor position within the XML tree.
 */

interface SchemaElement {
  children: string[]
  attributes: Record<string, string[]> // attribute name -> possible values (empty = free text)
  snippet?: string // full snippet for element insertion
}

const SCHEMA: Record<string, SchemaElement> = {
  agentSystem: {
    children: ['metadata', 'userJourney', 'orchestrator', 'agents', 'sharedResources', 'exampleFlow'],
    attributes: { 'xmlns': ['https://agent-diagram.app/schema/v1'] },
  },
  metadata: {
    children: ['title', 'author', 'version', 'created', 'description'],
    attributes: {},
  },
  userJourney: {
    children: ['scenario', 'initialContext', 'expectedOutcome'],
    attributes: {},
  },
  initialContext: {
    children: ['context'],
    attributes: {},
  },
  context: {
    children: [],
    attributes: { key: [] },
  },
  orchestrator: {
    children: ['name', 'description', 'reasoning', 'inputs', 'outputs'],
    attributes: { id: [] },
    snippet: '<orchestrator id="$1">\n  <name>$2</name>\n  <description>$3</description>\n  <reasoning>\n    <capability>$4</capability>\n  </reasoning>\n  <inputs>\n    <input source="user" type="string" required="true">\n      <name>$5</name>\n    </input>\n  </inputs>\n  <outputs>\n    <output type="string">\n      <name>$6</name>\n    </output>\n  </outputs>\n</orchestrator>',
  },
  agents: {
    children: ['agent'],
    attributes: {},
  },
  agent: {
    children: ['name', 'purpose', 'model', 'inputs', 'tools', 'reasoning', 'outputs', 'structuredOutputs'],
    attributes: {
      id: [],
      category: ['data-collection', 'action', 'knowledge', 'clarification'],
    },
    snippet: '<agent id="$1" category="$2">\n  <name>$3</name>\n  <purpose>$4</purpose>\n  <model>$5</model>\n  <inputs>\n    <input source="$6" type="string" required="true">\n      <name>$7</name>\n    </input>\n  </inputs>\n  <tools>\n    <tool id="$8" type="api">\n      <name>$9</name>\n    </tool>\n  </tools>\n  <reasoning>\n    <strategy>$10</strategy>\n  </reasoning>\n  <outputs>\n    <output type="string">\n      <name>$11</name>\n    </output>\n  </outputs>\n</agent>',
  },
  inputs: {
    children: ['input'],
    attributes: {},
  },
  input: {
    children: ['name', 'description', 'default'],
    attributes: {
      source: ['user', 'orchestrator', 'context'],
      type: ['string', 'object', 'array', 'boolean', 'number'],
      required: ['true', 'false'],
    },
  },
  outputs: {
    children: ['output'],
    attributes: {},
  },
  output: {
    children: ['name', 'description'],
    attributes: {
      target: [],
      type: ['string', 'object', 'array', 'boolean', 'number'],
    },
  },
  tools: {
    children: ['tool'],
    attributes: {},
  },
  tool: {
    children: ['name', 'endpoint', 'method', 'authentication', 'description', 'provider', 'model'],
    attributes: {
      id: [],
      type: ['api', 'vector-search', 'llm', 'database', 'function'],
    },
  },
  reasoning: {
    children: ['strategy', 'capability', 'outputSchema'],
    attributes: {},
  },
  structuredOutputs: {
    children: ['field'],
    attributes: {},
  },
  field: {
    children: ['name', 'description'],
    attributes: {
      type: ['string', 'number', 'boolean', 'array', 'object'],
      required: ['true', 'false'],
    },
  },
  sharedResources: {
    children: ['resource'],
    attributes: {},
  },
  resource: {
    children: ['name', 'description', 'technology', 'accessPattern', 'accessBy'],
    attributes: {
      id: [],
      type: ['database', 'cache', 'api', 'queue', 'storage', 'memory', 'knowledge'],
    },
  },
  exampleFlow: {
    children: ['step'],
    attributes: {},
  },
  step: {
    children: [],
    attributes: {
      order: [],
      agent: [],
    },
  },
}

// Simple stack-based XML context parser to determine current element at cursor
function getXmlContext(text: string): string[] {
  const stack: string[] = []
  // Match opening and closing tags
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g
  let match: RegExpExecArray | null = tagRegex.exec(text)
  while (match !== null) {
    const fullMatch = match[0]
    const tagName = match[1]
    if (fullMatch.startsWith('</')) {
      // Closing tag
      if (stack.length > 0 && stack[stack.length - 1] === tagName) {
        stack.pop()
      }
    } else if (fullMatch.endsWith('/>')) {
      // Self-closing -- doesn't affect stack
    } else {
      // Opening tag
      stack.push(tagName)
    }
    match = tagRegex.exec(text)
  }
  return stack
}

// Check if cursor is inside an opening tag (for attribute suggestions)
function isInsideOpeningTag(textBeforeCursor: string): string | null {
  // Find the last '<' that hasn't been closed by '>'
  const lastOpen = textBeforeCursor.lastIndexOf('<')
  if (lastOpen === -1) return null
  const afterOpen = textBeforeCursor.substring(lastOpen)
  if (afterOpen.includes('>')) return null
  // Extract tag name
  const tagMatch = afterOpen.match(/^<([a-zA-Z][a-zA-Z0-9]*)/)
  if (!tagMatch) return null
  return tagMatch[1]
}

let registered = false

export function registerXmlCompletionProvider(monacoInstance: typeof import('monaco-editor')): void {
  if (registered) return
  registered = true

  monacoInstance.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<', '"'],
    provideCompletionItems(model, position) {
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      }

      const suggestions: import('monaco-editor').languages.CompletionItem[] = []

      // Check if we're inside an opening tag (for attribute suggestions)
      const insideTag = isInsideOpeningTag(textBeforeCursor)
      if (insideTag) {
        const schema = SCHEMA[insideTag]
        if (schema) {
          // Check if we're inside a quoted attribute value
          const afterLastQuote = textBeforeCursor.split('"')
          const isInAttributeValue = afterLastQuote.length % 2 === 0
          if (isInAttributeValue) {
            // Find which attribute we're filling
            const beforeQuote = afterLastQuote.slice(0, -1).join('"')
            const attrMatch = beforeQuote.match(/([a-zA-Z_-]+)\s*=\s*$/)
            if (attrMatch) {
              const attrName = attrMatch[1]
              const values = schema.attributes[attrName]
              if (values && values.length > 0) {
                for (const val of values) {
                  suggestions.push({
                    label: val,
                    kind: monacoInstance.languages.CompletionItemKind.Value,
                    insertText: val,
                    range,
                  })
                }
              }
            }
          } else {
            // Suggest attributes
            for (const [attrName, values] of Object.entries(schema.attributes)) {
              const insertText = values.length > 0
                ? `${attrName}="\${1|${values.join(',')}|}"`
                : `${attrName}="$1"`
              suggestions.push({
                label: attrName,
                kind: monacoInstance.languages.CompletionItemKind.Property,
                insertText,
                insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: values.length > 0 ? `Values: ${values.join(', ')}` : 'Free text',
                range,
              })
            }
          }
        }
        return { suggestions }
      }

      // We're in element content — suggest child elements
      const contextStack = getXmlContext(textBeforeCursor)
      const currentElement = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null

      if (currentElement && SCHEMA[currentElement]) {
        const parentSchema = SCHEMA[currentElement]
        for (const childName of parentSchema.children) {
          const childSchema = SCHEMA[childName]
          // Use full snippet if available, otherwise simple element
          const insertText = childSchema?.snippet
            ? childSchema.snippet
            : childSchema && childSchema.children.length > 0
              ? `<${childName}>\n  $1\n</${childName}>`
              : `<${childName}>$1</${childName}>`
          suggestions.push({
            label: childName,
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText,
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `Child of <${currentElement}>`,
            range,
          })
        }
      } else if (currentElement === null) {
        // Root level — suggest agentSystem
        suggestions.push({
          label: 'agentSystem',
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          insertText: '<agentSystem xmlns="https://agent-diagram.app/schema/v1">\n  $0\n</agentSystem>',
          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Root element',
          range,
        })
      }

      return { suggestions }
    },
  })
}
