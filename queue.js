// queue.js
const { Queue } = require("bullmq");
const redis = require("./utils/a");

const paymentQueue = new Queue("paymentQueue", { connection: redis });
const duesQueue = new Queue("CALCULATE_DUES", { connection: redis });
const paymentRentQueue = new Queue("adjust-rent", { connection: redis });


module.exports = { paymentQueue,duesQueue,paymentRentQueue }; // ✅ export as object
