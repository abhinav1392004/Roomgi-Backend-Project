const mongoose = require("mongoose");

const SignupSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  }, phone: {
    type: Number,
   
  },
  role: {
    type: [String],
    enum: ["owner", "branch-manager", "tenant", "user"],
    required: true
  },
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "PropertyBranch",
  }],
  username: {
    type: String,
    required: true,
    unique: true,
  },
  resetLink: {
    type: String
  },
  walletBalance:{
    type:Number,
    default:100,
  },
  resetSession: { type: String },
  password: {
    type: String,
    required: true,
  },
  photourl: {
    type: String,
    required: false,
  }

});

module.exports = mongoose.model("Signup", SignupSchema);
