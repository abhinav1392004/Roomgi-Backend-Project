const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
  
        index: true
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Signup",
        required: true,
        index: true
    }
}, { timestamps: true });


propertySchema.index({ owner: 1, name: 1 });  

module.exports = mongoose.model("Property", propertySchema);
