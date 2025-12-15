const mongoose = require("mongoose");

const SignupSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  role: {
    type: String,
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
