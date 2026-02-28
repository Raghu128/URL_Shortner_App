import amqplib, { Channel, ChannelModel } from 'amqplib';
import { config } from '../../config';
import { logger } from '../../config/logger';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

/**
 * Connect to RabbitMQ and set up the analytics queue.
 */
export async function connectQueue(): Promise<void> {
    try {
        connection = await amqplib.connect(config.queue.url);
        channel = await connection.createChannel();

        // Ensure the analytics queue exists
        await channel.assertQueue(config.queue.analyticsQueue, {
            durable: true, // Survives broker restart
        });

        logger.info('✅ Connected to RabbitMQ');

        connection.on('error', (error) => {
            logger.error({ error }, 'RabbitMQ connection error');
        });

        connection.on('close', () => {
            logger.warn('RabbitMQ connection closed');
            channel = null;
            connection = null;
        });
    } catch (error) {
        logger.error({ error }, '❌ Failed to connect to RabbitMQ');
        // Don't throw — analytics is non-critical, app should still work
    }
}

/**
 * Publish a message to a queue.
 * Fire-and-forget: returns false if publish fails, never throws.
 */
export function publishToQueue(queue: string, data: Record<string, unknown>): boolean {
    if (!channel) {
        logger.warn('RabbitMQ channel not available, skipping publish');
        return false;
    }

    try {
        const message = Buffer.from(JSON.stringify(data));
        return channel.sendToQueue(queue, message, {
            persistent: true, // Message survives broker restart
            contentType: 'application/json',
        });
    } catch (error) {
        logger.error({ error, queue }, 'Failed to publish message to queue');
        return false;
    }
}

/**
 * Publish a click event to the analytics queue.
 * This is the primary interface used by the analytics service.
 */
export function publishClickEvent(data: {
    shortCode: string;
    ipAddress: string;
    userAgent: string;
    referrer: string;
    clickedAt: string;
}): boolean {
    return publishToQueue(config.queue.analyticsQueue, data);
}

/**
 * Disconnect from RabbitMQ.
 * Called during graceful shutdown.
 */
export async function disconnectQueue(): Promise<void> {
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
        logger.info('RabbitMQ connection closed');
    } catch (error) {
        logger.error({ error }, 'Error closing RabbitMQ connection');
    }
}

export function getChannel(): Channel | null {
    return channel;
}
