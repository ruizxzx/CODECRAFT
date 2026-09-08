import { Article } from '../types';

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'article-1',
    slug: 'end-of-monolithic-frontend-bundlers-vite-rolldown',
    title: 'The End of Monolithic Frontend Bundlers: How Vite & Rolldown Redefined Web Architecture',
    excerpt: 'Webpack built modern web development, but its reliance on whole-graph bundling hit a performance wall. Here is an architectural deep-dive into native ES modules, Rust-based tooling, and the death of 90-second cold starts.',
    category: 'Web Development',
    tags: ['JavaScript', 'Vite', 'Rust', 'Build Tools', 'Performance'],
    publishedAt: '2026-08-28',
    readingTimeMinutes: 7,
    featured: true,
    trending: true,
    viewsCount: 14280,
    clapsCount: 432,
    coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Abstract terminal code view with vibrant brutalist lighting',
    coverImageCaption: 'Fig 1.1 — Compiling hundreds of megabytes of JavaScript into single-digit millisecond hot reloads.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'For almost a decade, JavaScript build tools treated every frontend application as a closed graph that had to be analyzed, traversed, and packed into monolithic output chunks before a developer could inspect a single pixel on localhost.'
      },
      {
        type: 'paragraph',
        content: 'When single-page applications grew from 20 modules to 20,000 modules, our development feedback loops crawled to a halt. We accepted 90-second cold boots and 8-second hot updates as inevitable friction. Today, that entire paradigm is obsolete.'
      },
      {
        type: 'heading2',
        content: 'The Native ESM Revolution'
      },
      {
        type: 'paragraph',
        content: 'Vite took a radically different gamble: what if the dev server does almost zero bundling at boot time? Modern browsers already understand ES Module imports natively (`import { format } from "/src/utils.js"`). By delegating module resolution directly to the browser runtime, cold start time is strictly decoupled from total codebase size.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'typescript',
          filename: 'vite.config.ts',
          code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});`
        }
      },
      {
        type: 'callout',
        calloutType: 'insight',
        calloutTitle: 'Architectural Lesson',
        content: 'Never do work during dev server boot that can be lazily deferred until an HTTP request actually touches that specific module.'
      },
      {
        type: 'heading2',
        content: 'Why Rolldown & Rust are the Next Frontier'
      },
      {
        type: 'paragraph',
        content: 'The dual-engine dilemma was Vite’s primary tradeoff: fast esbuild in development, but standard Rollup in production. Rolldown eliminates this split by implementing Rollup compatibility in Rust, unifying dev and prod compilation with 10x-30x throughput improvements.'
      },
      {
        type: 'quote',
        content: 'Performance is not an afterthought; it dictates whether engineering teams can stay in creative flow or get lost in compile-latency purgatory.',
        quoteAuthor: 'Krish — KRISHFICIENT Manifesto'
      },
      {
        type: 'takeaways',
        items: [
          'Native browser ESM shifts graph traversal from server boot to on-demand browser HTTP requests.',
          'Pre-bundling dependencies via native binaries (esbuild/Rust) solves the 1,000-request waterfall.',
          'Rolldown bridges the gap between Rollup plugin flexibility and low-level Rust execution speed.'
        ]
      }
    ]
  },
  {
    id: 'article-2',
    slug: 'building-local-first-ai-agents-small-language-models',
    title: 'Building Local-First AI Agents: Structured Outputs with Small Language Models',
    excerpt: 'Cloud LLMs are powerful but introduce latency, cost, and privacy vulnerabilities. Here is how to architect reliable deterministic agents using quantized local models and constrained JSON schemas.',
    category: 'Artificial Intelligence',
    tags: ['AI', 'LLM', 'Local-First', 'Python', 'System Architecture'],
    publishedAt: '2026-08-20',
    readingTimeMinutes: 9,
    featured: true,
    trending: true,
    viewsCount: 21900,
    clapsCount: 681,
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Modern neo-brutalist generative art representation of neural computing',
    coverImageCaption: 'Fig 2.1 — Constraining token logits via context-free grammar to guarantee 100% JSON schema validity.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'When software engineers first began building LLM features, they relied on natural language prompts and crossed their fingers that the model would output parsable markdown code fences. In 2026, production software cannot gamble on string parsing.'
      },
      {
        type: 'paragraph',
        content: 'Local SLMs (Small Language Models like Gemma 2 9B, Llama 3.2, and Phi-3.5) running directly via ONNX, WebGPU, or Apple Silicon Metal are transforming how we think about agentic tooling.'
      },
      {
        type: 'heading2',
        content: 'The Mechanism: Context-Free Grammar Masking'
      },
      {
        type: 'paragraph',
        content: 'Rather than letting the neural network output arbitrary probability tokens across its 128k vocabulary, structured inference masks the token probability logits at generation time according to a strict grammar state machine.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'python',
          filename: 'agent_schema.py',
          code: `from pydantic import BaseModel, Field
from typing import Literal, List

class ToolInvocation(BaseModel):
    tool_name: Literal['git_commit', 'database_query', 'deploy_lambda']
    parameters: dict = Field(..., description="Strongly-typed arguments")
    safety_level: Literal['safe', 'requires_approval']

class AgentDecision(BaseModel):
    thought_trace: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    actions: List[ToolInvocation]`
        }
      },
      {
        type: 'callout',
        calloutType: 'warning',
        calloutTitle: 'Zero Hallucination Parsing',
        content: 'Grammar sampling guarantees syntactic compliance with your Pydantic or JSON schema. It does not prevent semantic hallucinations, so runtime verification assertions remain mandatory.'
      },
      {
        type: 'heading2',
        content: 'Zero Network Latency & True Privacy'
      },
      {
        type: 'paragraph',
        content: 'By packaging quantized 4-bit weights with your local desktop application or mobile client, response times drop from seconds of cloud network latency to sub-15ms first-token generation with complete air-gapped isolation.'
      },
      {
        type: 'takeaways',
        items: [
          'Quantized 4-bit and 8-bit weights deliver 90%+ of full-precision reasoning at 1/10th the memory footprint.',
          'Logit masking forces language model decoders into rigorous mathematical state machines.',
          'Local execution enables offline computing, zero API subscription costs, and uncompromising user data sovereignty.'
        ]
      }
    ]
  },
  {
    id: 'article-3',
    slug: 'database-indexing-deep-dive-b-trees-to-lsm-trees',
    title: 'Database Indexing from Scratch: B-Trees, LSM-Trees, and Storage Engine Mechanics',
    excerpt: 'Why do Postgres and MySQL choose B+ Trees while Cassandra, RocksDB, and SQLite WAL choose Log-Structured Merge Trees? A breakdown of disk I/O, write amplification, and index page alignment.',
    category: 'Computer Science',
    tags: ['Database', 'PostgreSQL', 'Computer Science', 'Distributed Systems', 'Performance'],
    publishedAt: '2026-08-11',
    readingTimeMinutes: 11,
    featured: false,
    trending: true,
    viewsCount: 18450,
    clapsCount: 512,
    coverImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Physical hardware storage plates and brutalist circuitry',
    coverImageCaption: 'Fig 3.1 — Disk block layout and random I/O vs sequential append costs in memory hierarchies.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'Database queries run fast when data fits in RAM. But the instant data exceeds main memory and spills onto NVMe or spinning magnetic media, physical storage laws dictate software performance.'
      },
      {
        type: 'paragraph',
        content: 'Understanding the mathematical dichotomy between B+ Trees (optimized for point reads and range scans) and LSM-Trees (optimized for write throughput) is the dividing line between mediocre and world-class system engineers.'
      },
      {
        type: 'heading2',
        content: 'The Anatomy of a B+ Tree'
      },
      {
        type: 'paragraph',
        content: 'Unlike standard binary trees where each node holds only one or two keys, a B+ Tree node is sized to match exact operating system disk pages (typically 4KB, 8KB, or 16KB). Each node can hold hundreds of keys, keeping tree height incredibly shallow.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'sql',
          filename: 'explain_analyze.sql',
          code: `-- Verifying B-Tree index scan performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, amount, created_at
FROM transactions
WHERE user_id = 'usr_991823'
  AND created_at >= '2026-01-01'
ORDER BY created_at DESC
LIMIT 50;`
        }
      },
      {
        type: 'callout',
        calloutType: 'tip',
        calloutTitle: 'Index Ordering Matters',
        content: 'In composite indexes (A, B), an index can satisfy queries on (A) or (A, B), but cannot serve queries on (B) alone. Left-to-right cardinality is critical.'
      },
      {
        type: 'heading2',
        content: 'Why LSM Trees Dominate Write-Heavy Architectures'
      },
      {
        type: 'paragraph',
        content: 'Log-Structured Merge Trees turn random writes into sequential writes by writing first to an in-memory MemTable (typically a Red-Black tree or SkipList) and an append-only Write-Ahead Log (WAL). Later, background compaction passes merge sorted string tables (SSTables).'
      },
      {
        type: 'takeaways',
        items: [
          'B+ Trees place all values in leaf nodes connected by pointers for blazing range scans.',
          'Random in-place page writes in B-Trees cause write amplification and SSD wear.',
          'LSM-Trees trade read latency (mitigated by Bloom filters) for blistering sequential write throughput.'
        ]
      }
    ]
  },
  {
    id: 'article-4',
    slug: 'the-terminal-as-an-operating-system-cli-toolkit',
    title: 'The Terminal as an Operating System: Constructing a High-Leverage CLI Toolkit',
    excerpt: 'Ditching bloated GUIs for a keyboard-first terminal workflow. How modern CLI utilities like tmux, fzf, ripgrep, and customized zsh scripts multiply daily developer velocity tenfold.',
    category: 'Developer Tools',
    tags: ['CLI', 'Developer Tools', 'Productivity', 'Linux', 'Neovim'],
    publishedAt: '2026-08-04',
    readingTimeMinutes: 6,
    featured: false,
    trending: false,
    viewsCount: 9810,
    clapsCount: 395,
    coverImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Monochromatic terminal screen with sharp monospace typography',
    coverImageCaption: 'Fig 4.1 — Zero-distraction keyboard navigation across dozens of remote and local sessions.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'The average software developer switches context between their browser, an IDE, an API client, a database GUI, and Slack up to 400 times a day. Every context switch incurs a measurable cognitive penalty.'
      },
      {
        type: 'paragraph',
        content: 'When you treat your terminal not merely as an afterthought prompt, but as your primary interactive workspace, computing becomes immediate, scriptable, and composable.'
      },
      {
        type: 'heading2',
        content: 'The Four Pillars of High-Velocity Terminal Ergonomics'
      },
      {
        type: 'paragraph',
        content: 'Modern CLI tools have completely outclassed their POSIX predecessors written in the 1970s. By combining ripgrep, fzf, fd, and bat, fuzzy searching a million lines of code is sub-second.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'bash',
          filename: '.zshrc',
          code: `# Fuzzy search git branches and checkout with preview
fbr() {
  local branches branch
  branches=$(git branch --all | grep -v HEAD) &&
  branch=$(echo "$branches" |
           fzf-tmux -d $(( 2 + $(wc -l <<< "$branches") )) +m) &&
  git checkout $(echo "$branch" | sed "s/.* //" | sed "s#remotes/[^/]*/##")
}`
        }
      },
      {
        type: 'quote',
        content: 'Text is the universal interface. Any tool that exposes a clean stdout/stdin stream can be composed with every other tool written on UNIX.',
        quoteAuthor: 'The Unix Philosophy'
      },
      {
        type: 'takeaways',
        items: [
          'Replace grep with ripgrep (rg), find with fd, and cat with bat.',
          'Use tmux session managers to preserve project context across terminal reboots.',
          'Automate repetitive git workflows with small, composable shell functions.'
        ]
      }
    ]
  },
  {
    id: 'article-5',
    slug: 'typescript-const-type-parameters-and-zero-cost-abstractions',
    title: 'TypeScript 5.x Deep Cut: Const Type Parameters, Template Literals, and Zero-Cost Type Safety',
    excerpt: 'Move beyond basic interface declarations. Learn how const type parameters, branded types, and recursive mapped types allow you to catch complex system invariants at compile time without paying any runtime penalty.',
    category: 'Software Engineering',
    tags: ['TypeScript', 'JavaScript', 'Type Systems', 'Best Practices'],
    publishedAt: '2026-07-22',
    readingTimeMinutes: 8,
    featured: false,
    trending: false,
    viewsCount: 12100,
    clapsCount: 440,
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Laptop displaying modern TypeScript code editor with clean brutalist desk setup',
    coverImageCaption: 'Fig 5.1 — Compile-time validation eliminates entire classes of runtime nil pointer and payload errors.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'Many teams use TypeScript as glorified autocomplete: adding `: string` or `: any` whenever the compiler objects. But TypeScript is a Turing-complete meta-programming engine that can enforce domain boundaries at compile-time.'
      },
      {
        type: 'heading2',
        content: 'Const Type Parameters: Eliminating "as const"'
      },
      {
        type: 'paragraph',
        content: 'Prior to TypeScript 5.0, passing an object literal to a generic function widened string literals to `string` unless the caller appended `as const`. With the `const` modifier on type parameters, literal inference is preserved automatically.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'typescript',
          filename: 'routes.ts',
          code: `// The 'const T' modifier preserves precise literal tuple values
function defineRoutes<const T extends readonly { path: string; method: 'GET' | 'POST' }[]>(routes: T) {
  return routes;
}

const apiRoutes = defineRoutes([
  { path: '/api/v1/articles', method: 'GET' },
  { path: '/api/v1/publish', method: 'POST' }
]);

// Type is inferred as exact literal union, NOT string!`
        }
      },
      {
        type: 'callout',
        calloutType: 'tip',
        calloutTitle: 'Branded Types for IDs',
        content: 'Never pass bare `string` for database IDs. Use nominal branding (`type UserId = string & { readonly __brand: unique symbol }`) to prevent passing an ArticleId where a UserId was expected.'
      },
      {
        type: 'takeaways',
        items: [
          'Const type parameters infer object and array shapes as readonly deep literals.',
          'Template literal types turn route path strings into type-safe parameter extractors.',
          'Type definitions vanish at compile-time, delivering pure verification at zero runtime byte overhead.'
        ]
      }
    ]
  },
  {
    id: 'article-6',
    slug: 'event-driven-microservices-idempotency-outbox-patterns',
    title: 'Event-Driven Systems Without the Chaos: The Transactional Outbox & Idempotency Keys',
    excerpt: 'Dual-writes between SQL databases and message brokers (Kafka, RabbitMQ) silently corrupt distributed data. Here is the canonical pattern for atomic domain events and resilient message delivery.',
    category: 'System Design',
    tags: ['System Design', 'Kafka', 'Architecture', 'Microservices', 'Distributed Systems'],
    publishedAt: '2026-07-09',
    readingTimeMinutes: 10,
    featured: false,
    trending: true,
    viewsCount: 16700,
    clapsCount: 580,
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
    coverImageAlt: 'Matrix of illuminated network fibers and distributed server racks',
    coverImageCaption: 'Fig 6.1 — Guaranteeing at-least-once delivery without distributed two-phase commits.',
    author: {
      name: 'Krish',
      role: 'Founder & Software Architect',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      bio: 'Writing about distributed systems, modern web runtimes, and engineering craft at KRISHFICIENT.'
    },
    content: [
      {
        type: 'paragraph',
        content: 'The most dangerous anti-pattern in modern cloud development is the simple sequence: `db.save(user)` followed by `kafka.publish("user_created", user)`. If the database commits but the network blinks before the Kafka ACK, your systems will diverge permanently.'
      },
      {
        type: 'heading2',
        content: 'The Transactional Outbox Pattern'
      },
      {
        type: 'paragraph',
        content: 'Instead of making two remote network calls across disparate protocols, you write both your business state and your outgoing event into the SAME ACID transaction in your primary database.'
      },
      {
        type: 'code',
        codeBlock: {
          language: 'sql',
          filename: 'outbox_table.sql',
          code: `CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

-- Transaction: Both mutate user AND insert event atomically
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 'acc_123';
  INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('account', 'acc_123', 'AccountDebited', '{"amount": 100}');
COMMIT;`
        }
      },
      {
        type: 'callout',
        calloutType: 'insight',
        calloutTitle: 'Change Data Capture (CDC)',
        content: 'A background worker or Debezium tailing the PostgreSQL write-ahead log (WAL) reads from `outbox_events` and streams to Kafka with zero loss.'
      },
      {
        type: 'takeaways',
        items: [
          'Dual writes without distributed transactions guarantee silent eventual data inconsistency.',
          'The Transactional Outbox leverages relational ACID semantics to guarantee event durability.',
          'Consumers must maintain idempotency tables to safely process duplicate messages.'
        ]
      }
    ]
  }
];

export const CATEGORIES = [
  'All Posts',
  'Web Development',
  'Artificial Intelligence',
  'Software Engineering',
  'Computer Science',
  'Developer Tools',
  'System Design'
] as const;
