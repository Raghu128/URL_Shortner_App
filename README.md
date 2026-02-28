# 🔗 URL Shortener

A high-performance URL shortener built with modern best practices and production-grade architecture.

## Architecture

- **Backend**: Node.js + Express + TypeScript
- **Primary DB**: PostgreSQL 16 (writes only)
- **Read Replicas**: PostgreSQL 16 (reads — streaming replication)
- **Cache**: Redis 7 (URL mappings, rate limiting)
- **Message Queue**: RabbitMQ (async analytics pipeline)
- **Connection Pool**: PgBouncer (for read replicas)

## Quick Start

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

### 3. Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start the API Server

```bash
npm run dev
```

The API will be running at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/urls` | Create short URL | Optional |
| GET | `/:code` | Redirect to original URL | No |
| GET | `/api/v1/urls` | List user's URLs | Required |
| GET | `/api/v1/urls/:code` | Get URL details | Required |
| PATCH | `/api/v1/urls/:code` | Update URL | Required |
| DELETE | `/api/v1/urls/:code` | Soft-delete URL | Required |
| POST | `/api/v1/auth/register` | Register | No |
| POST | `/api/v1/auth/login` | Login | No |
| GET | `/api/v1/analytics/:code` | Click analytics | Required |
| GET | `/health` | Health check | No |

## Example Usage

```bash
# Create a short URL
curl -X POST http://localhost:3000/api/v1/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/very/long/path"}'

# Response
{
  "success": true,
  "data": {
    "shortCode": "aB3xZ9k",
    "shortUrl": "http://localhost:3000/aB3xZ9k",
    "originalUrl": "https://github.com/very/long/path",
    "clickCount": 0,
    "createdAt": "2026-02-28T08:41:36Z"
  }
}

# Redirect
curl -L http://localhost:3000/aB3xZ9k
```

## Project Structure

```
url-shortener/
├── apps/api/                    # Backend API
│   ├── src/
│   │   ├── config/              # Configuration loader
│   │   ├── modules/             # Feature modules (URL, Auth, Analytics)
│   │   │   ├── url/             # Controller → Service → Repository
│   │   │   ├── auth/
│   │   │   └── analytics/
│   │   ├── middleware/          # Auth, rate limiting, error handling
│   │   ├── common/              # Errors, utils, constants, types
│   │   ├── infrastructure/      # DB, cache, queue clients
│   │   ├── workers/             # Analytics & expiration workers
│   │   ├── app.ts               # Express setup
│   │   └── server.ts            # Entry point
│   └── prisma/                  # Schema & migrations
├── infra/                       # Docker Compose, Nginx, K8s
└── docs/                        # Architecture docs
```

## Running Tests

```bash
cd apps/api
npm test
```

## License

MIT
