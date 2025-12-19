const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    roomNumber: Number,
    capacity: Number,
    occupied: {
        type: Number,
        default: 0,
    },
    totalrating: {
        type: Number,
        default: 0
    },
    ratingcount: {
        type: Number,
        default: 0
    },
    personalreview: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
        default: []   // 🔥 VERY IMPORTANT
    }]
    ,


    hoteltype: {
        type: String,
        enum: [
            "Standard-Single", "Standard-Double", "Twin-Room", "Triple-Room",
            "Family-Room", "Deluxe-Room", "Super-Deluxe-Room",
            "Executive-Room", "Suite"
        ],
    },
    flattype: {
        type: String,
        enum: ["1Rk", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK"],
    },
    roomtype: {
        type: String,
        enum: ["Single", "Double", "Triple"]
    },
    renttype: {
        type: String,
        enum: ["Flat-Rent", "Room-Rent"]
    },
    type: {
        type: String,
        enum: ["Single", "Double", "Triple"],
    },
    occupiedRentalRoom: {
        type: Number,
        default: 0,
    },
    occupiedRentalRoom: {
        type: Number,
        default: 0,
    },
    city: {
        type: String,
        index: true  // 🔥 fast room search by city
    },

    count: {
        type: Number,
        default: 0,
    },

    verified: {
        type: Boolean,
        default: false,
        index: true   // 🔥 filter verified rooms
    },

    description: {
        type: String,
        default: ""
    },
    comment: {
        type: String,
        default: ""
    },

    notAllowed: [
        {
            type: String,
            enum: ["Smoking", "Alcohol", "Pets", "Visitors", "Loud Music"]
        }
    ],

    rules: [
        {
            type: String,
            enum: [
                "Keep room clean",
                "No loud music",
                "Maintain hygiene",
                "No outside guests",
                "Respect timings"
            ]
        }
    ],

    allowedFor: {
        type: String,
        enum: ["Boys", "Girls", "Family", "Anyone"],
        default: "Anyone",
        index: true  // 🔥 gender-based room filtering
    },

    furnishedType: {
        type: String,
        enum: ["Fully Furnished", "Semi Furnished", "Unfurnished"],
        index: true
    },

    vacant: {
        type: Number,
        default: 0,
        index: true
    },

    availabilityStatus: {
        type: String,
        enum: ["Available", "Occupied"],
        default: "Available",
        index: true
    },

    toPublish: {
        status: { type: Boolean, default: false, index: true },
        date: { type: Date },
    },

    price: {
        type: Number,
        index: true  // 🔥 price filtering
    },

    rentperday: Number,
    rentperhour: Number,
    rentperNight: Number,

    category: {
        type: String,
        enum: ["Pg", "Rented-Room", "Hotel"],
        default: "Pg",
        index: true // 🔥 filter for Pg / Rooms / Hotels
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "branchmanager",
        index: true
    },

    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyBranch",
        index: true  // 🔥 fast branch-wise rooms
    },


    roomImages: [{ type: String }],

    facilities: [
        {
            type: String,
            enum: [
                "AC", "Non-AC", "Bathroom", "WiFi", "Power Backup",
                "Laundry", "CCTV", "Parking", "Refrigerator", "24x7 Electricity",
            ]
        }
    ]
});

// ⭐ Composite index: Best for filters
RoomSchema.index({
    city: 1,
    category: 1,
    availabilityStatus: 1,
    price: 1
});


// ------------------- PROPERTY BRANCH SCHEMA -------------------

const propertyBranchSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Signup", required: true, index: true },
    branchmanager: { type: mongoose.Schema.Types.ObjectId, ref: "branchmanager", index: true },
    name: { type: String, index: true },
    address: { type: String, required: true, index: true },
    city: { type: String, index: true },
    streetAdress: { type: String },
    landmark: { type: String },
    state: { type: String, index: true },
    pincode: { type: Number, index: true },

    totelhotelroom: { type: Number, default: 0 },
    occupiedhotelroom: { type: Number, default: 0 },
    occupiedRentalRoom: { type: Number, default: 0 },
    totalrentalRoom: { type: Number, default: 0 },

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: { type: [Number] }, // [lng, lat]
    },

    lat: { type: Number },
    long: { type: Number },

    totalBeds: { type: Number, default: 0 },
    facilities: { type: [String] },
    roomNumbers: { type: [Number], required: true },
    advanced: { type: Number, default: 0 },
    dues: { type: Number, default: 0 },
    rent: { type: Number, default: 0 },
    rooms: [RoomSchema],
    occupiedRoom: [{ type: Number }],

    status: {
        type: String,
        enum: ["Active", "InActive", "maintenance", "coming-Soon"],
        default: "Active",
        index: true
    },

    Propertyphoto: { type: [String] },
}, { timestamps: true });


propertyBranchSchema.index({ location: "2dsphere" });


propertyBranchSchema.index({
    city: 1,
    status: 1,
    owner: 1
});


propertyBranchSchema.index({ name: "text", address: "text", city: "text" });


module.exports = mongoose.model("PropertyBranch", propertyBranchSchema);
