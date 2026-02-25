import { describe, it, expect } from 'vitest'
import { parseXml } from './xmlService'

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<agentSystem xmlns="https://agent-diagram.app/schema/v1">
  <metadata>
    <title>Test System</title>
    <author>Tester</author>
    <version>1.0</version>
    <description>A test agent system</description>
  </metadata>
  <orchestrator id="orch-main">
    <name>Main Orchestrator</name>
    <description>Central reasoning engine</description>
    <reasoning>
      <capability>Analyze user intent</capability>
      <capability>Select agents</capability>
    </reasoning>
    <inputs>
      <input source="user" type="string">
        <name>User Message</name>
        <description>Current query</description>
      </input>
    </inputs>
    <outputs>
      <output target="user" type="string">
        <name>Response</name>
      </output>
    </outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="data-collection">
      <name>Data Agent</name>
      <purpose>Collect user data</purpose>
      <inputs>
        <input source="orchestrator" type="string" required="true">
          <name>Query</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-api-1">
          <name>Test API</name>
          <endpoint>https://api.test.com/v1</endpoint>
          <method>GET</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Fetch relevant data</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>User Data</name>
        </output>
      </outputs>
    </agent>
  </agents>
</agentSystem>`

const MULTI_AGENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<agentSystem xmlns="https://agent-diagram.app/schema/v1">
  <metadata>
    <title>Multi Agent System</title>
  </metadata>
  <orchestrator id="orch-main">
    <name>Orchestrator</name>
    <description>Main orchestrator</description>
    <reasoning>
      <capability>Route tasks</capability>
    </reasoning>
    <inputs>
      <input source="user" type="string">
        <name>Message</name>
      </input>
    </inputs>
    <outputs>
      <output target="user" type="string">
        <name>Response</name>
      </output>
    </outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="data-collection">
      <name>Data Agent</name>
      <purpose>Fetch data</purpose>
      <inputs>
        <input source="orchestrator" type="string" required="true">
          <name>Query</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-1">
          <name>API 1</name>
        </tool>
      </tools>
      <reasoning>
        <strategy>Fetch data</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Data</name>
        </output>
      </outputs>
    </agent>
    <agent id="agent-002" category="action">
      <name>Action Agent</name>
      <purpose>Execute actions</purpose>
      <inputs>
        <input source="agent-001" type="object" required="true">
          <name>Input Data</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-2">
          <name>Action API</name>
        </tool>
      </tools>
      <reasoning>
        <strategy>Execute based on data</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Result</name>
        </output>
      </outputs>
    </agent>
  </agents>
</agentSystem>`

describe('xmlService', () => {
  describe('parseXml', () => {
    it('should parse valid XML successfully', () => {
      const result = parseXml(VALID_XML)
      expect(result.data).not.toBeNull()
      expect(result.errors).toHaveLength(0)
      expect(result.data?.metadata.title).toBe('Test System')
      expect(result.data?.orchestrator.name).toBe('Main Orchestrator')
      expect(result.data?.agents).toHaveLength(1)
    })

    it('should extract orchestrator data correctly', () => {
      const result = parseXml(VALID_XML)
      const orch = result.data?.orchestrator
      expect(orch?.id).toBe('orch-main')
      expect(orch?.reasoning.capabilities).toHaveLength(2)
      expect(orch?.inputs).toHaveLength(1)
      expect(orch?.outputs).toHaveLength(1)
    })

    it('should extract agent data correctly', () => {
      const result = parseXml(VALID_XML)
      const agent = result.data?.agents[0]
      expect(agent?.id).toBe('agent-001')
      expect(agent?.category).toBe('data-collection')
      expect(agent?.name).toBe('Data Agent')
      expect(agent?.tools).toHaveLength(1)
      expect(agent?.tools[0]?.name).toBe('Test API')
      expect(agent?.inputs).toHaveLength(1)
      expect(agent?.outputs).toHaveLength(1)
    })

    it('should handle multiple agents', () => {
      const result = parseXml(MULTI_AGENT_XML)
      expect(result.data?.agents).toHaveLength(2)
      expect(result.data?.agents[0]?.id).toBe('agent-001')
      expect(result.data?.agents[1]?.id).toBe('agent-002')
    })

    it('should return empty result for empty string', () => {
      const result = parseXml('')
      expect(result.data).toBeNull()
      expect(result.errors).toHaveLength(0)
    })

    it('should return empty result for whitespace', () => {
      const result = parseXml('   \n  ')
      expect(result.data).toBeNull()
      expect(result.errors).toHaveLength(0)
    })

    it('should return error for invalid XML syntax', () => {
      const result = parseXml('<invalid><xml>')
      expect(result.data).toBeNull()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should return error for XML without agentSystem root', () => {
      const result = parseXml('<?xml version="1.0"?><notAgentSystem><test/></notAgentSystem>')
      expect(result.data).toBeNull()
      expect(result.errors.some((e) => e.message.includes('agentSystem'))).toBe(true)
    })

    it('should return error for XML without metadata', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning><inputs/><outputs/></orchestrator>
  <agents><agent id="a-1" category="action"><name>A</name><purpose>P</purpose><inputs><input source="user" type="string"><name>I</name></input></inputs><tools/><reasoning><strategy>S</strategy></reasoning><outputs><output type="string"><name>O</name></output></outputs></agent></agents>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.data).toBeNull()
      expect(result.errors.some((e) => e.message.includes('metadata'))).toBe(true)
    })

    it('should return error for XML without agents', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <metadata><title>Test</title></metadata>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning><inputs/><outputs/></orchestrator>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.data).toBeNull()
      expect(result.errors.some((e) => e.message.includes('agents'))).toBe(true)
    })

    it('should detect duplicate agent IDs', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <metadata><title>Test</title></metadata>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning>
    <inputs><input source="user" type="string"><name>M</name></input></inputs>
    <outputs><output target="user" type="string"><name>R</name></output></outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="action"><name>A1</name><purpose>P</purpose>
      <inputs><input source="orchestrator" type="string" required="true"><name>I</name></input></inputs>
      <tools><tool type="api" id="t1"><name>T</name></tool></tools>
      <reasoning><strategy>S</strategy></reasoning>
      <outputs><output type="string"><name>O</name></output></outputs>
    </agent>
    <agent id="agent-001" category="data-collection"><name>A2</name><purpose>P</purpose>
      <inputs><input source="orchestrator" type="string" required="true"><name>I</name></input></inputs>
      <tools><tool type="api" id="t2"><name>T2</name></tool></tools>
      <reasoning><strategy>S</strategy></reasoning>
      <outputs><output type="string"><name>O2</name></output></outputs>
    </agent>
  </agents>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.errors.some((e) => e.message.includes('Duplicate agent ID'))).toBe(true)
    })

    it('should detect invalid input source references', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <metadata><title>Test</title></metadata>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning>
    <inputs><input source="user" type="string"><name>M</name></input></inputs>
    <outputs><output target="user" type="string"><name>R</name></output></outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="action"><name>A1</name><purpose>P</purpose>
      <inputs><input source="agent-999" type="string" required="true"><name>I</name></input></inputs>
      <tools><tool type="api" id="t1"><name>T</name></tool></tools>
      <reasoning><strategy>S</strategy></reasoning>
      <outputs><output type="string"><name>O</name></output></outputs>
    </agent>
  </agents>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.errors.some((e) => e.message.includes('invalid source'))).toBe(true)
    })

    it('should warn about knowledge agents without vector-search tool', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <metadata><title>Test</title></metadata>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning>
    <inputs><input source="user" type="string"><name>M</name></input></inputs>
    <outputs><output target="user" type="string"><name>R</name></output></outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="knowledge"><name>RAG Agent</name><purpose>Answer questions</purpose>
      <inputs><input source="user" type="string" required="true"><name>Question</name></input></inputs>
      <tools><tool type="api" id="t1"><name>Some API</name></tool></tools>
      <reasoning><strategy>Search and answer</strategy></reasoning>
      <outputs><output type="string"><name>Answer</name></output></outputs>
    </agent>
  </agents>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.warnings.some((w) => w.message.includes('vector-search'))).toBe(true)
    })

    it('should parse shared resources correctly', () => {
      const xml = `<?xml version="1.0"?>
<agentSystem>
  <metadata><title>Test</title></metadata>
  <orchestrator id="orch"><name>O</name><reasoning><capability>C</capability></reasoning>
    <inputs><input source="user" type="string"><name>M</name></input></inputs>
    <outputs><output target="user" type="string"><name>R</name></output></outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="action"><name>A1</name><purpose>P</purpose>
      <inputs><input source="orchestrator" type="string" required="true"><name>I</name></input></inputs>
      <tools><tool type="api" id="t1"><name>T</name></tool></tools>
      <reasoning><strategy>S</strategy></reasoning>
      <outputs><output type="string"><name>O</name></output></outputs>
    </agent>
  </agents>
  <sharedResources>
    <resource id="res-1" type="memory">
      <name>Context Store</name>
      <description>Shared context</description>
      <technology>Redis</technology>
      <accessPattern>read-write</accessPattern>
      <accessBy>orchestrator,agent-001</accessBy>
    </resource>
  </sharedResources>
</agentSystem>`
      const result = parseXml(xml)
      expect(result.data?.sharedResources).toHaveLength(1)
      expect(result.data?.sharedResources?.[0]?.name).toBe('Context Store')
      expect(result.data?.sharedResources?.[0]?.accessBy).toEqual(['orchestrator', 'agent-001'])
    })
  })
})
