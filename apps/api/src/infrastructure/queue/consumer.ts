import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { config } from '../../config';
import { logger } from '../../config/logger';

/**
 * Generic message consumer for RabbitMQ queues.
 * Used by background workers to process messages.
 */
export class QueueConsumer {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;

    constructor(private readonly queueUrl: string = config.queue.url) { }

    /**
     * Connect to RabbitMQ and start consuming messages from a queue.
     * @param queue - Queue name to consume from
     * @param handler - Async function to process each message
     * @param prefetch - Number of messages to prefetch (concurrency)
     */
    async consume(
        queue: string,
        handler: (data: Record<string, unknown>) => Promise<void>,
        prefetch: number = 10,
    ): Promise<void> {
        try {
            this.connection = await amqplib.connect(this.queueUrl);
            this.channel = await this.connection.createChannel();

            await this.channel.assertQueue(queue, { durable: true });
            await this.channel.prefetch(prefetch);

            logger.info({ queue, prefetch }, 'Consumer started, waiting for messages...');

            await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
                if (!msg) return;

                try {
                    const data = JSON.parse(msg.content.toString());
                    await handler(data);
                    this.channel?.ack(msg);
                } catch (error) {
                    logger.error({ error, queue }, 'Failed to process message');
                    // Negative acknowledge — requeue the message
                    this.channel?.nack(msg, false, true);
                }
            });

            this.connection.on('error', (error) => {
                logger.error({ error }, 'Consumer connection error');
            });
        } catch (error) {
            logger.error({ error, queue }, 'Failed to start consumer');
            throw error;
        }
    }

    /**
     * Gracefully close the consumer connection.
     */
    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            logger.info('Consumer connection closed');
        } catch (error) {
            logger.error({ error }, 'Error closing consumer connection');
        }
    }
}
