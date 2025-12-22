// queue.js
const { Queue } = require("bullmq");
const redis = require("./utils/a");

const paymentQueue = new Queue("paymentQueue", { connection: redis });
const duesQueue = new Queue("dues", { connection: redis });
const paymentRentQueue = new Queue("adjust-rent", { connection: redis });
const refundQueue = new Queue("REFUND_PROCESSING", { connection: redis });
const refundverifyQueue = new Queue("REFUND_VERIFY", { connection: redis });



module.exports = { paymentQueue,
    duesQueue,
    refundverifyQueue,
    refundQueue,
    paymentRentQueue };