# 🔗 Shrinkr — High-Performance URL Shortener

A production-grade URL shortener built with **read/write split architecture**, designed for high read throughput (90%+ reads), sub-10ms redirects, and real-time analytics.

> Built with Node.js, Express, TypeScript, PostgreSQL, Redis, RabbitMQ, and Next.js.

---

## 📐 Architecture Overview

### System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser / Mobile App]
    end

    subgraph "API Gateway"
        B[Nginx - Reverse Proxy]
    end

    subgraph "Application Layer"
        C[Express API Server]
        D[URL Service]
        E[Analytics Service]
        F[Auth Service]
    end

    subgraph "Caching Layer"
        G["Redis 7 (Cache + Rate Limiting)"]
    end

    subgraph "Data Layer — Read/Write Split"
        H[("PostgreSQL Primary<br/>WRITES ONLY")]
        H2[("PostgreSQL Replica<br/>READS ONLY")]
    end

    subgraph "Message Queue"
        J[RabbitMQ]
    end

    subgraph "Background Workers"
        K[Analytics Worker]
        L[Expiration Worker]
    end

    A --> B
    B --> C
    C --> D
    C --> E
    C --> F
    D -->|"Cache Lookup (sub-ms)"| G
    D -->|"Writes Only"| H
    D -->|"Reads (90% traffic)"| H2
    H -->|"Streaming Replication"| H2
    E --> J
    J --> K
    K --> H
    L --> H
    G -.->|"Cache Miss"| H2
```

### Read/Write Split — Why It Matters

URL shorteners have a **~100:1 read-to-write ratio**. For every URL created, it gets clicked hundreds of times. This architecture separates the hot read path from writes:

| Path | Traffic | Database | Latency |
|------|---------|----------|---------|
| **Writes** (create/update/delete) | ~10% | PostgreSQL Primary | ~10ms |
| **Reads** (redirect lookups) | ~90% | Redis → Replica → Primary fallback | <10ms |

---

### Three-Tier Redirect Flow

The redirect endpoint is the **most latency-sensitive** path. Every millisecond counts.

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Redis
    participant Replica as PG Read Replica
    participant Primary as PG Primary
    participant Queue as RabbitMQ

    Client->>API: GET /aB3xZ9
    API->>Redis: GET url:aB3xZ9

    alt ✅ Tier 1: Cache HIT (~95% of requests)
        Redis-->>API: original_url
    else ❌ Cache MISS
        API->>Replica: SELECT FROM urls WHERE short_code = 'aB3xZ9'
        alt ✅ Tier 2: Replica HIT (~4.9%)
            Replica-->>API: url record
        else ❌ Replica MISS (replication lag)
            API->>Primary: SELECT FROM urls WHERE short_code = 'aB3xZ9'
            Primary-->>API: url record
            Note over API,Primary: Tier 3: Primary Fallback (~0.1%)
        end
        API->>Redis: SET url:aB3xZ9 (TTL: 24h)
    end

    API->>Queue: Publish click event (async, non-blocking)
    API-->>Client: 302 Redirect → original_url
```

> **Why 3 tiers?** Redis absorbs ~95% of reads (sub-ms). The replica handles ~4.9% (cache misses). The primary is only touched for writes and the rare replication-lag edge case (<0.1% of reads).

---

### Layered Architecture (Controller → Service → Repository)

Each module follows a strict layered pattern with clean separation of concerns:

```mermaid
graph LR
    A["Controller<br/>(HTTP concerns)"] -->|"Request/Response"| B["Service<br/>(Business Logic)"]
    B -->|"Data Operations"| C["Repository<br/>(Data Access)"]
    C -->|"Prisma ORM"| D[("Database")]
    B -->|"Cache Ops"| E["Redis"]

    style A fill:#4CAF50,color:white
    style B fill:#2196F3,color:white
    style C fill:#FF9800,color:white
    style D fill:#9C27B0,color:white
    style E fill:#e74c3c,color:white
```

| Layer | Responsibility | Knows About |
|-------|---------------|-------------|
| **Controller** | Parse request, send response, HTTP status codes | Service only |
| **Service** | Business logic, validation, orchestration | Repository + Cache |
| **Repository** | Database queries, data mapping | Prisma ORM |

> Each layer depends only on the layer below it — **Dependency Inversion Principle**.

---

### Async Analytics Pipeline

Click events are **never** written synchronously during redirects. They flow through RabbitMQ for decoupled processing:

```mermaid
graph LR
    A[Redirect Handler] -->|"fire-and-forget"| B[RabbitMQ]
    B --> C[Analytics Worker]
    C -->|"batch writes"| D[("PostgreSQL")]

    style A fill:#2ecc71,color:white
    style B fill:#f39c12,color:white
    style C fill:#3498db,color:white
    style D fill:#9b59b6,color:white
```

---

### Short Code Generation Strategy

Uses **Base62 encoding of auto-increment IDs** with XOR obfuscation:

```
Database ID → XOR with secret key → Base62 encode → Short code
     42     →     99385214410      →   CkWPWCeY   → http://localhost:3000/CkWPWCeY
```

| Property | Value |
|----------|-------|
| **Algorithm** | Base62(XOR(auto-increment ID)) |
| **Character set** | `a-z`, `A-Z`, `0-9` (62 chars) |
| **Min length** | 6 characters |
| **Collision risk** | **Zero** — each DB ID is unique |
| **Guessability** | Non-sequential due to XOR obfuscation |

---

### Database Schema

```mermaid
erDiagram
    USERS {
        bigint id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar tier
        timestamp created_at
        timestamp updated_at
    }

    URLS {
        bigint id PK
        varchar short_code UK
        text original_url
        bigint user_id FK
        boolean is_custom
        timestamp expires_at
        bigint click_count
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    USERS ||--o{ URLS : "owns"
```

### PostgreSQL Replication Topology

```mermaid
graph LR
    subgraph "Write Path (10%)"
        W["API: Create/Update/Delete"] -->|"Writes"| P[("Primary")]
    end

    subgraph "Replication"
        P -->|"WAL Streaming"| R1[("Replica")]
    end

    subgraph "Read Path (90%)"
        R["API: Redirect Lookup"] -->|"Cache Miss"| R1
    end

    style P fill:#e74c3c,color:white
    style R1 fill:#2ecc71,color:white
```

---

## 🛠 Tech Stack

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Node.js 20+ | Non-blocking I/O — ideal for I/O-bound redirect workloads |
| **Framework** | Express.js | Mature, minimal, extensible middleware support |
| **Language** | TypeScript | Type safety, self-documenting code, better refactoring |
| **Validation** | Zod | Schema-first validation with TypeScript inference |
| **ORM** | Prisma | Type-safe DB access, migrations, excellent DX |
| **Auth** | JWT + bcrypt | Industry-standard token auth with secure hashing |
| **Logging** | Pino | Fastest Node.js logger, structured JSON output |

### Frontend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 16 | SSR/SSG, App Router, React ecosystem |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **Theme** | Dark mode + Glassmorphism | Premium, modern look |

### Infrastructure

| Layer | Technology | Why |
|-------|-----------|-----|
| **Primary DB** | PostgreSQL 16 | ACID, battle-tested, handles all writes |
| **Read Replica** | PostgreSQL 16 (Streaming Replication) | Absorbs 90% read traffic |
| **Cache** | Redis 7 | Sub-ms URL lookups, rate limiting |
| **Message Queue** | RabbitMQ | Async analytics pipeline |
| **Containerization** | Docker + Docker Compose | Consistent dev/prod environments |
| **Reverse Proxy** | Nginx | TLS termination, load balancing |

---

## 🏗 Project Structure

```
url-shortener/
├── apps/
│   ├── api/                          # Backend API (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── config/               # Configuration loader + logger
│   │   │   ├── modules/              # Feature-based modules (SRP)
│   │   │   │   ├── url/              # URL shortening (Controller → Service → Repository)
│   │   │   │   │   └── __tests__/    # Unit tests (hashGenerator, urlValidator, urlService)
│   │   │   │   ├── auth/             # JWT authentication
│   │   │   │   │   └── __tests__/    # Unit tests (authService)
│   │   │   │   └── analytics/        # Click analytics
│   │   │   ├── middleware/            # Auth, rate limiting, validation, error handling
│   │   │   ├── common/               # Errors, utils, constants, types
│   │   │   ├── infrastructure/        # DB clients, Redis, RabbitMQ
│   │   │   ├── workers/              # Analytics + expiration background workers
│   │   │   ├── app.ts                # Express application setup
│   │   │   └── server.ts             # Entry point with graceful shutdown
│   │   ├── tests/                     # Cross-cutting unit tests
│   │   │   ├── authMiddleware.test.ts
│   │   │   ├── errorHandler.test.ts
│   │   │   ├── errors.test.ts
│   │   │   ├── responseHelper.test.ts
│   │   │   └── validateRequest.test.ts
│   │   └── prisma/                    # Schema + migrations
│   │
│   └── web/                           # Frontend (Next.js 16)
│       └── src/
│           ├── app/
│           │   ├── page.tsx           # Landing page + shorten form
│           │   ├── dashboard/         # URL management dashboard
│           │   ├── analytics/[code]/  # Per-link analytics
│           │   └── auth/              # Login + Register
│           └── lib/
│               └── api.ts             # Typed API client
│
├── infra/                             # Infrastructure
│   ├── docker-compose.dev.yml         # PostgreSQL, Redis, RabbitMQ
│   └── nginx/nginx.conf              # Reverse proxy config
│
└── package.json                       # npm workspaces root
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Start Infrastructure

```bash
# Start PostgreSQL (primary + replica), Redis, and RabbitMQ
npm run docker:dev
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
# The defaults work with the Docker Compose setup
```

### 4. Run Database Migrations

```bash
cd apps/api && npx prisma migrate dev --name init
```

### 5. Start Servers

```bash
# Terminal 1: Backend API (port 3000)
npm run dev:api

# Terminal 2: Frontend (port 3001)
npm run dev:web
```

Open `http://localhost:3001` in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/urls` | Create short URL | Optional |
| `GET` | `/:code` | Redirect to original URL | No |
| `GET` | `/api/v1/urls` | List user's URLs (paginated) | Required |
| `GET` | `/api/v1/urls/:code` | Get URL details | Required |
| `PATCH` | `/api/v1/urls/:code` | Update URL | Required |
| `DELETE` | `/api/v1/urls/:code` | Soft-delete URL | Required |
| `POST` | `/api/v1/auth/register` | Register | No |
| `POST` | `/api/v1/auth/login` | Login | No |
| `GET` | `/api/v1/analytics/:code` | Click analytics | Required |
| `GET` | `/health` | Health check | No |

### Example Usage

```bash
# Create a short URL
curl -X POST http://localhost:3000/api/v1/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/very/long/path"}'

# Response — 201 Created
{
  "success": true,
  "data": {
    "shortCode": "CkWPWCeY",
    "shortUrl": "http://localhost:3000/CkWPWCeY",
    "originalUrl": "https://github.com/very/long/path",
    "clickCount": 0,
    "createdAt": "2026-02-28T08:41:36Z"
  }
}

# Redirect
curl -L http://localhost:3000/CkWPWCeY
# → 302 Redirect → https://github.com/very/long/path
```

---

## 🧪 Testing

### Run All Tests (88 tests, 9 suites)

```bash
cd apps/api && npm test
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| **URL Service** | 21 | Three-tier reads, CRUD, cache invalidation, expiry |
| **Auth Service** | 9 | Register, login, bcrypt, anti-enumeration |
| **Hash Generator** | 11 | Base62 encode/decode, round-trip, edge cases |
| **URL Validator** | 6 | Protocols, self-reference, blocked domains |
| **Error Classes** | 12 | AppError hierarchy, status codes |
| **Error Handler** | 6 | Operational vs unexpected, no detail leaks |
| **Auth Middleware** | 8 | JWT parsing, BigInt conversion, optional auth |
| **Validate Request** | 5 | Zod validation, field-level errors |
| **Response Helpers** | 9 | All response shapes, pagination |

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| **Input Validation** | Zod schemas on all endpoints |
| **Rate Limiting** | Redis sliding window (10 req/min on create) |
| **JWT Auth** | Token-based with configurable expiry |
| **Password Hashing** | bcrypt with 10 salt rounds |
| **XSS Prevention** | URL protocol validation (blocks `javascript:`, `data:`) |
| **Anti-Enumeration** | Same error message for wrong email vs wrong password |
| **Security Headers** | Helmet middleware |
| **No Detail Leaks** | Generic 500 for unexpected errors |

---

## 🧱 Design Principles

This project follows industry best practices:

- **SOLID**: Single Responsibility (module-per-feature), Open/Closed (middleware chain), Dependency Inversion (constructor injection)
- **Clean Architecture**: Controller → Service → Repository separation
- **DRY**: Shared error classes, response helpers, validation middleware
- **Separation of Concerns**: HTTP concerns in controllers, business logic in services, data access in repositories
- **Error Handling**: Operational vs programmer error distinction with global handler
- **Graceful Shutdown**: SIGTERM/SIGINT handling with connection cleanup

---

## 📊 Performance Characteristics

| Metric | Target | How |
|--------|--------|-----|
| **Redirect latency** | < 10ms (cache hit) | Redis sub-ms lookups |
| **Redirect throughput** | 10K+ req/sec | Read replicas + Redis |
| **Create latency** | < 50ms | Direct write to primary |
| **Cache hit rate** | ~95% | 24h TTL on URL mappings |
| **Uptime** | 99.99% | Health checks, graceful shutdown |

---

## License

MIT
