import type { ValidationError, ValidationWarning } from '@/types/agentSystem'

/**
 * Sets Monaco editor markers (squiggles) from our validation errors and warnings.
 * Uses the monaco global from @monaco-editor/react.
 */
export function setValidationMarkers(
  monacoInstance: typeof import('monaco-editor'),
  model: import('monaco-editor').editor.ITextModel | null,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!model) return

  const markers: import('monaco-editor').editor.IMarkerData[] = []

  for (const err of errors) {
    const line = err.line ?? 1
    markers.push({
      severity: monacoInstance.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: model.getLineMaxColumn(line),
    })
  }

  for (const warn of warnings) {
    // Warnings don't have line numbers; place on line 1
    markers.push({
      severity: monacoInstance.MarkerSeverity.Warning,
      message: warn.message,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: model.getLineMaxColumn(1),
    })
  }

  monacoInstance.editor.setModelMarkers(model, 'xml-validation', markers)
}
