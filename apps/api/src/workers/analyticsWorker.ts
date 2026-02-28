import { QueueConsumer } from '../infrastructure/queue/consumer';
import { UrlRepository } from '../modules/url/url.repository';
import { config } from '../config';
import { logger } from '../config/logger';

/**
 * Analytics Worker — Background process.
 *
 * Consumes click events from RabbitMQ and:
 * 1. Increments the denormalized click_count in Postgres (PRIMARY)
 * 2. In production, would also batch-insert into ClickHouse
 *
 * Runs as a separate process (not in the API server).
 */
export class AnalyticsWorker {
    private consumer: QueueConsumer;
    private urlRepository: UrlRepository;

    /** Buffer for batching click count updates */
    private clickBuffer: Map<string, number> = new Map();
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.consumer = new QueueConsumer();
        this.urlRepository = new UrlRepository();
    }

    /**
     * Start the analytics worker.
     */
    async start(): Promise<void> {
        logger.info('Starting analytics worker...');

        // Flush accumulated click counts every 5 seconds
        this.flushInterval = setInterval(() => this.flushClickCounts(), 5000);

        await this.consumer.consume(
            config.queue.analyticsQueue,
            async (data) => {
                const shortCode = data.shortCode as string;

                // Accumulate clicks in buffer (batched writes)
                const current = this.clickBuffer.get(shortCode) || 0;
                this.clickBuffer.set(shortCode, current + 1);

                logger.debug({ shortCode, ip: data.ipAddress }, 'Click event received');
            },
            20, // Process up to 20 messages concurrently
        );
    }

    /**
     * Flush accumulated click counts to the database.
     * Writes to PRIMARY in batches rather than per-event.
     */
    private async flushClickCounts(): Promise<void> {
        if (this.clickBuffer.size === 0) return;

        const entries = Array.from(this.clickBuffer.entries());
        this.clickBuffer.clear();

        logger.info({ count: entries.length }, 'Flushing click counts to database');

        for (const [shortCode, increment] of entries) {
            try {
                await this.urlRepository.incrementClickCount(shortCode, increment);
            } catch (error) {
                logger.error({ error, shortCode, increment }, 'Failed to update click count');
                // Re-add to buffer for retry on next flush
                const current = this.clickBuffer.get(shortCode) || 0;
                this.clickBuffer.set(shortCode, current + increment);
            }
        }
    }

    /**
     * Gracefully stop the worker.
     */
    async stop(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }

        // Final flush before shutting down
        await this.flushClickCounts();
        await this.consumer.close();

        logger.info('Analytics worker stopped');
    }
}

// ─── Run as standalone process ───
if (require.main === module) {
    const worker = new AnalyticsWorker();

    worker.start().catch((error) => {
        logger.error({ error }, 'Analytics worker failed to start');
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        await worker.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        await worker.stop();
        process.exit(0);
    });
}
