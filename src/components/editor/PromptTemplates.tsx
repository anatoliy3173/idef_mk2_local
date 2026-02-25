import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/uiStore'
import { useDiagramStore } from '@/stores/diagramStore'
import { CREATE_NEW_PROMPT, getModifyPrompt } from '@/lib/promptTemplates'
import { EXAMPLE_XMLS, type ExampleXml } from '@/lib/exampleXmls'
import { Copy, Check, FileText, Sparkles } from 'lucide-react'

export function PromptTemplates() {
  const { setShowPromptTemplates } = useUIStore()
  const { setXmlContent, parseAndBuild, xmlContent } = useDiagramStore()
  const [copied, setCopied] = useState<string | null>(null)

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard denied
    }
  }

  function loadExample(example: ExampleXml) {
    setXmlContent(example.xml)
    parseAndBuild()
    setShowPromptTemplates(false)
  }

  return (
    <Dialog open={true} onOpenChange={(open: boolean) => !open && setShowPromptTemplates(false)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Prompt Templates & Examples</DialogTitle>
          <DialogDescription>
            Use these prompts with any LLM to generate or modify agent system XML.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">Create New</TabsTrigger>
            <TabsTrigger value="modify" className="flex-1">Modify Existing</TabsTrigger>
            <TabsTrigger value="examples" className="flex-1">Examples</TabsTrigger>
          </TabsList>

          {/* Create New Tab */}
          <TabsContent value="create" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <button
                type="button"
                className="w-full flex items-center gap-2 p-2.5 rounded-md border border-dashed border-[#d97757]/40 bg-[#d97757]/5 hover:bg-[#d97757]/10 transition-colors text-left cursor-pointer"
                onClick={() => {
                  setShowPromptTemplates(false)
                  useUIStore.getState().setShowGenerateDialog(true)
                }}
              >
                <Sparkles className="w-4 h-4 text-[#d97757] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#d97757]">Generate with AI</p>
                  <p className="text-[11px] text-muted-foreground">Use the built-in Gemini integration to generate XML directly</p>
                </div>
              </button>
              <p className="text-sm text-muted-foreground">
                Or copy this prompt and paste it into ChatGPT, Claude, or any LLM. Then describe your agent system.
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-xs max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                  {CREATE_NEW_PROMPT}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(CREATE_NEW_PROMPT, 'create')}
                >
                  {copied === 'create' ? (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  {copied === 'create' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Modify Existing Tab */}
          <TabsContent value="modify" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              {xmlContent.trim() ? (
                <>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 p-2.5 rounded-md border border-dashed border-[#d97757]/40 bg-[#d97757]/5 hover:bg-[#d97757]/10 transition-colors text-left cursor-pointer"
                    onClick={() => {
                      setShowPromptTemplates(false)
                      useUIStore.getState().setShowGenerateDialog(true)
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-[#d97757] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#d97757]">Modify with AI</p>
                      <p className="text-[11px] text-muted-foreground">Use the built-in Gemini integration to modify your XML directly</p>
                    </div>
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Or copy this prompt (includes your current XML) and tell the LLM what to change.
                  </p>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-md text-xs max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                      {getModifyPrompt(xmlContent)}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(getModifyPrompt(xmlContent), 'modify')}
                    >
                      {copied === 'modify' ? (
                        <Check className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 mr-1" />
                      )}
                      {copied === 'modify' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                  <p className="text-sm">No XML loaded yet.</p>
                  <p className="text-xs mt-1">Load an example or paste XML first to use the modify prompt.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Load a pre-built example to see how the XML schema works.
              </p>
              <div className="space-y-2">
                {EXAMPLE_XMLS.map((example: ExampleXml) => (
                  <div
                    key={example.id}
                    className="p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => loadExample(example)}
                  >
                    <h4 className="text-sm font-medium">{example.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {example.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
