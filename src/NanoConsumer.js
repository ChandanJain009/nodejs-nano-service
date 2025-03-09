require("dotenv").config();
const amqp = require("amqplib");
const NanoServiceMessage = require("./NanoServiceMessage");

class NanoConsumer {
  constructor(event) {
    this.connection = null;
    this.channel = null;
    this.event = event;
    this.queue = `${process.env.AMQP_PROJECT}.${event}`;
    this.exchange = `${process.env.AMQP_PROJECT}.bus`;
  }

  async getConnection() {
    if (!this.connection) {
      this.connection = await amqp.connect({
        protocol: "amqp",
        hostname: process.env.AMQP_HOST,
        port: process.env.AMQP_PORT,
        username: process.env.AMQP_USER,
        password: process.env.AMQP_PASS,
        vhost: process.env.AMQP_VHOST,
      });
    }
    return this.connection;
  }

  async getChannel() {
    if (!this.channel) {
      const conn = await this.getConnection();
      this.channel = await conn.createChannel();
    }
    return this.channel;
  }

  async consume(callback) {
    const channel = await this.getChannel();
    await channel.assertExchange(this.exchange, "x-delayed-message", {
      durable: true,
      arguments: { "x-delayed-type": "topic" }, // Preserve topic routing
    });
    await channel.assertQueue(this.queue, { durable: true });
    await channel.bindQueue(this.queue, this.exchange, this.queue);
    console.log(
      `Subscribed to event: ${this.event} in exchange: ${this.exchange}`
    );

    channel.consume(this.queue, (msg) => {
      if (msg !== null) {
        const message = NanoServiceMessage.fromJson(msg.content.toString());
        callback(message);
        channel.ack(msg);
      }
    });
  }
}

module.exports = NanoConsumer;
