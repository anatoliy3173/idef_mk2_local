export interface ExampleXml {
  id: string
  title: string
  description: string
  xml: string
}

export const EXAMPLE_XMLS: ExampleXml[] = [
  {
    id: 'flight-booking',
    title: 'Flight Booking System',
    description: 'Multi-agent system for handling flight bookings, user inquiries, and order management.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<agentSystem xmlns="https://agent-diagram.app/schema/v1">
  <metadata>
    <title>Flight Booking Multi-Agent System</title>
    <author>System Designer</author>
    <version>1.0</version>
    <description>Orchestrated agent system for handling flight bookings, user inquiries, and order management.</description>
  </metadata>
  <userJourney>
    <scenario>User wants to book a flight from Moscow to Kuala Lumpur</scenario>
    <initialContext>
      <context key="userPhone">+7-XXX-XXX-XXXX</context>
    </initialContext>
    <expectedOutcome>Flight booked successfully with confirmation sent to user</expectedOutcome>
  </userJourney>
  <orchestrator id="orch-main">
    <name>Main Orchestrator</name>
    <description>Central reasoning engine that analyzes user intent, delegates to specialized agents, and synthesizes responses.</description>
    <reasoning>
      <capability>Analyze user intent and extract key entities</capability>
      <capability>Select optimal agent(s) for delegation</capability>
      <capability>Coordinate multi-agent workflows</capability>
      <capability>Synthesize agent outputs into coherent response</capability>
      <capability>Manage conversation state and context</capability>
    </reasoning>
    <inputs>
      <input source="user" type="string">
        <name>User Message</name>
        <description>Current user query or command</description>
      </input>
      <input source="context" type="object">
        <name>Conversation History</name>
        <description>Previous messages and collected data</description>
      </input>
    </inputs>
    <outputs>
      <output target="user" type="string">
        <name>Response Message</name>
        <description>Natural language response to user</description>
      </output>
      <output target="context" type="object">
        <name>Updated Context</name>
        <description>New data to add to conversation memory</description>
      </output>
    </outputs>
  </orchestrator>
  <agents>
    <agent id="agent-001" category="data-collection">
      <name>User Insight Agent</name>
      <purpose>Retrieve and analyze user profile data from CRM systems</purpose>
      <inputs>
        <input source="context" type="string" required="true">
          <name>User Phone Number</name>
          <description>Phone number to lookup in CRM</description>
        </input>
        <input source="orchestrator" type="object" required="false">
          <name>Data Requirements</name>
          <description>Specific fields requested by orchestrator</description>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-crm-bio">
          <name>CRM API - Get User Bio</name>
          <endpoint>https://crm.company.com/api/v1/users/{phone}/bio</endpoint>
          <method>GET</method>
          <authentication>Bearer Token</authentication>
        </tool>
        <tool type="api" id="tool-crm-loyalty">
          <name>CRM API - Get Loyalty Data</name>
          <endpoint>https://crm.company.com/api/v1/users/{phone}/loyalty</endpoint>
          <method>GET</method>
          <authentication>Bearer Token</authentication>
        </tool>
      </tools>
      <reasoning>
        <strategy>Determine which user data fields are relevant to current query</strategy>
        <strategy>Minimize API calls by fetching only necessary data</strategy>
        <strategy>Handle missing data gracefully with defaults</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>User Profile</name>
          <description>Structured user data including bio and loyalty info</description>
        </output>
      </outputs>
    </agent>
    <agent id="agent-002" category="action">
      <name>Flight Search Agent</name>
      <purpose>Search and retrieve available flights based on user criteria</purpose>
      <inputs>
        <input source="user/orchestrator" type="string" required="true">
          <name>Origin City</name>
        </input>
        <input source="user/orchestrator" type="string" required="true">
          <name>Destination City</name>
        </input>
        <input source="user/orchestrator" type="string" required="false">
          <name>Departure Date</name>
        </input>
        <input source="agent-001" type="object" required="false">
          <name>User Preferences</name>
          <description>Preferred airline, class from user profile</description>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-flight-search">
          <name>Flight System API - Search</name>
          <endpoint>https://flights.api.com/v2/search</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>If dates missing, ask orchestrator to clarify with user</strategy>
        <strategy>Apply user preferences to filter results</strategy>
        <strategy>Return top 5 options sorted by price and convenience</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Flight Options</name>
        </output>
      </outputs>
    </agent>
    <agent id="agent-003" category="action">
      <name>Order Booking Agent</name>
      <purpose>Execute flight booking and handle payment processing</purpose>
      <inputs>
        <input source="agent-002" type="object" required="true">
          <name>Selected Flight</name>
        </input>
        <input source="user" type="string" required="true">
          <name>Full Name</name>
        </input>
        <input source="agent-001" type="object" required="false">
          <name>Loyalty Account</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-booking">
          <name>Flight System API - Book</name>
          <endpoint>https://flights.api.com/v2/bookings</endpoint>
          <method>POST</method>
        </tool>
        <tool type="api" id="tool-payment">
          <name>Payment Gateway API</name>
          <endpoint>https://payments.api.com/v1/charge</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Validate all required passenger information</strategy>
        <strategy>Process payment before finalizing booking</strategy>
        <strategy>Apply loyalty discounts if applicable</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Booking Confirmation</name>
        </output>
      </outputs>
      <structuredOutputs>
        <field type="string" required="true">
          <name>booking_id</name>
          <description>Unique booking reference number</description>
        </field>
        <field type="string" required="true">
          <name>status</name>
          <description>Booking status: confirmed, pending, failed</description>
        </field>
        <field type="number" required="true">
          <name>total_price</name>
          <description>Total charged amount in base currency</description>
        </field>
        <field type="string" required="false">
          <name>loyalty_points_earned</name>
          <description>Loyalty points earned from this booking</description>
        </field>
      </structuredOutputs>
    </agent>
    <agent id="agent-004" category="knowledge">
      <name>Flight Knowledge RAG Agent</name>
      <purpose>Answer user questions about flights, rules, luggage policies</purpose>
      <inputs>
        <input source="user" type="string" required="true">
          <name>User Question</name>
        </input>
        <input source="context" type="object" required="false">
          <name>Current Flight Context</name>
          <description>If asking about specific flight already discussed</description>
        </input>
      </inputs>
      <tools>
        <tool type="vector-search" id="tool-knowledge-base">
          <name>Flight Knowledge Vector Database</name>
          <description>Embeddings of flight policies, FAQs, regulations</description>
          <provider>Pinecone</provider>
        </tool>
        <tool type="llm" id="tool-answer-generation">
          <name>LLM Answer Generator</name>
          <model>GPT-4</model>
        </tool>
      </tools>
      <reasoning>
        <strategy>Retrieve top 5 relevant knowledge chunks via vector search</strategy>
        <strategy>Use LLM to synthesize answer from retrieved context</strategy>
        <strategy>Cite sources when providing policy information</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Knowledge Response</name>
        </output>
      </outputs>
    </agent>
  </agents>
</agentSystem>`,
  },
  {
    id: 'customer-support',
    title: 'Customer Support System',
    description: 'AI-powered customer support with ticket routing, FAQ answering, and escalation.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<agentSystem xmlns="https://agent-diagram.app/schema/v1">
  <metadata>
    <title>Customer Support Multi-Agent System</title>
    <author>System Designer</author>
    <version>1.0</version>
    <description>Intelligent customer support system with automated routing and resolution.</description>
  </metadata>
  <orchestrator id="orch-support">
    <name>Support Orchestrator</name>
    <description>Routes customer inquiries to appropriate agents and manages escalation.</description>
    <reasoning>
      <capability>Classify customer intent (billing, technical, general)</capability>
      <capability>Route to appropriate specialist agent</capability>
      <capability>Determine if escalation to human is needed</capability>
      <capability>Track resolution status</capability>
    </reasoning>
    <inputs>
      <input source="user" type="string">
        <name>Customer Message</name>
        <description>Customer inquiry or complaint</description>
      </input>
      <input source="context" type="object">
        <name>Ticket History</name>
        <description>Previous interactions for this ticket</description>
      </input>
    </inputs>
    <outputs>
      <output target="user" type="string">
        <name>Support Response</name>
        <description>Response to customer</description>
      </output>
    </outputs>
  </orchestrator>
  <agents>
    <agent id="agent-billing" category="data-collection">
      <name>Billing Agent</name>
      <purpose>Handle billing inquiries, refunds, and payment issues</purpose>
      <inputs>
        <input source="orchestrator" type="string" required="true">
          <name>Customer ID</name>
        </input>
        <input source="orchestrator" type="string" required="true">
          <name>Billing Query</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-billing-api">
          <name>Billing System API</name>
          <endpoint>https://billing.internal/api/v1</endpoint>
          <method>GET</method>
        </tool>
        <tool type="api" id="tool-refund-api">
          <name>Refund Processing API</name>
          <endpoint>https://billing.internal/api/v1/refunds</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Look up customer billing history</strategy>
        <strategy>Determine if refund is warranted based on policy</strategy>
        <strategy>Process approved refunds automatically</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Billing Resolution</name>
        </output>
      </outputs>
      <structuredOutputs>
        <field type="string" required="true">
          <name>resolution_type</name>
          <description>Type of resolution: refund, credit, explanation, escalation</description>
        </field>
        <field type="boolean" required="true">
          <name>resolved</name>
          <description>Whether the billing issue was fully resolved</description>
        </field>
        <field type="number" required="false">
          <name>refund_amount</name>
          <description>Refund amount if applicable</description>
        </field>
      </structuredOutputs>
    </agent>
    <agent id="agent-technical" category="knowledge">
      <name>Technical Support Agent</name>
      <purpose>Resolve technical issues using knowledge base and diagnostics</purpose>
      <inputs>
        <input source="orchestrator" type="string" required="true">
          <name>Technical Issue</name>
        </input>
        <input source="context" type="object" required="false">
          <name>Device Info</name>
        </input>
      </inputs>
      <tools>
        <tool type="vector-search" id="tool-tech-kb">
          <name>Technical Knowledge Base</name>
          <provider>Weaviate</provider>
        </tool>
        <tool type="api" id="tool-diagnostics">
          <name>System Diagnostics API</name>
          <endpoint>https://diag.internal/api/check</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Search knowledge base for known solutions</strategy>
        <strategy>Run diagnostics if issue is system-related</strategy>
        <strategy>Escalate if unable to resolve after 2 attempts</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Technical Resolution</name>
        </output>
      </outputs>
    </agent>
    <agent id="agent-escalation" category="clarification">
      <name>Escalation Agent</name>
      <purpose>Prepare and route complex issues to human agents</purpose>
      <inputs>
        <input source="orchestrator" type="object" required="true">
          <name>Unresolved Issue</name>
        </input>
        <input source="context" type="object" required="true">
          <name>Full Conversation</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-ticket-system">
          <name>Ticket Management System</name>
          <endpoint>https://tickets.internal/api/v1/escalate</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Summarize issue and attempted resolutions</strategy>
        <strategy>Assign priority based on customer tier</strategy>
        <strategy>Route to appropriate human team</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Escalation Ticket</name>
        </output>
      </outputs>
    </agent>
  </agents>
  <sharedResources>
    <resource id="res-ticket-db" type="database">
      <name>Ticket Database</name>
      <description>Central database for all support tickets</description>
      <technology>PostgreSQL</technology>
      <accessPattern>read-write</accessPattern>
      <accessBy>orchestrator,agent-billing,agent-technical,agent-escalation</accessBy>
    </resource>
  </sharedResources>
</agentSystem>`,
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce Assistant',
    description: 'Shopping assistant with product search, recommendations, and order tracking.',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<agentSystem xmlns="https://agent-diagram.app/schema/v1">
  <metadata>
    <title>E-Commerce Shopping Assistant</title>
    <author>System Designer</author>
    <version>1.0</version>
    <description>Multi-agent shopping assistant for product discovery and purchasing.</description>
  </metadata>
  <orchestrator id="orch-shop">
    <name>Shopping Orchestrator</name>
    <description>Manages shopping conversations, product discovery, and purchase flows.</description>
    <reasoning>
      <capability>Understand product search intent</capability>
      <capability>Manage cart and checkout flow</capability>
      <capability>Provide personalized recommendations</capability>
    </reasoning>
    <inputs>
      <input source="user" type="string">
        <name>User Query</name>
        <description>Shopping-related query</description>
      </input>
      <input source="context" type="object">
        <name>Shopping Session</name>
        <description>Cart contents and browsing history</description>
      </input>
    </inputs>
    <outputs>
      <output target="user" type="string">
        <name>Assistant Response</name>
        <description>Product info, recommendations, or order status</description>
      </output>
    </outputs>
  </orchestrator>
  <agents>
    <agent id="agent-search" category="data-collection">
      <name>Product Search Agent</name>
      <purpose>Search product catalog based on user criteria</purpose>
      <inputs>
        <input source="orchestrator" type="string" required="true">
          <name>Search Query</name>
        </input>
        <input source="orchestrator" type="object" required="false">
          <name>Filters</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-catalog">
          <name>Product Catalog API</name>
          <endpoint>https://api.store.com/v2/products/search</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Parse natural language into structured search filters</strategy>
        <strategy>Rank results by relevance and popularity</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Product Results</name>
        </output>
      </outputs>
    </agent>
    <agent id="agent-recommend" category="knowledge">
      <name>Recommendation Agent</name>
      <purpose>Provide personalized product recommendations</purpose>
      <inputs>
        <input source="context" type="object" required="true">
          <name>User Profile</name>
        </input>
        <input source="agent-search" type="object" required="false">
          <name>Current Search Results</name>
        </input>
      </inputs>
      <tools>
        <tool type="vector-search" id="tool-rec-engine">
          <name>Recommendation Engine</name>
          <provider>Custom ML Model</provider>
        </tool>
      </tools>
      <reasoning>
        <strategy>Analyze purchase history and preferences</strategy>
        <strategy>Cross-reference with trending products</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Recommendations</name>
        </output>
      </outputs>
    </agent>
    <agent id="agent-order" category="action">
      <name>Order Management Agent</name>
      <purpose>Handle cart operations, checkout, and order tracking</purpose>
      <inputs>
        <input source="orchestrator" type="object" required="true">
          <name>Order Action</name>
        </input>
        <input source="context" type="object" required="true">
          <name>Cart Contents</name>
        </input>
      </inputs>
      <tools>
        <tool type="api" id="tool-cart">
          <name>Cart API</name>
          <endpoint>https://api.store.com/v2/cart</endpoint>
          <method>POST</method>
        </tool>
        <tool type="api" id="tool-checkout">
          <name>Checkout API</name>
          <endpoint>https://api.store.com/v2/checkout</endpoint>
          <method>POST</method>
        </tool>
      </tools>
      <reasoning>
        <strategy>Validate cart items availability</strategy>
        <strategy>Apply applicable discounts and promotions</strategy>
        <strategy>Process secure checkout</strategy>
      </reasoning>
      <outputs>
        <output type="object">
          <name>Order Confirmation</name>
        </output>
      </outputs>
    </agent>
  </agents>
</agentSystem>`,
  },
]
