const Property = require("../model/property")
const redisClient = require("../utils/redis");
const PropertyBranch = require("../model/propertyBranch")
const Signup = require("../model/user")
const branchmanager = require("../model/branchmanager")
const bcrypt = require("bcrypt")
const Uploadmedia = require("../utils/cloudinary.js")
const deletemedia = require("../utils/cloudinary.js")
const axios = require('axios')

async function AllProperty(id) {
    const Allproprty = await Property.find({ owner: id }).populate({
        path: "owner",
        select: "username email "
    });
    return Allproprty;
}





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////






//branch //








/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

















// Centralized error handler
const handleError = (res, error, message = "Internal Server Error") => {
  console.error(error);
  return res.status(500).json({ success: false, message, error: error.message });
};

// ----------------------
// Get All Branches
// ----------------------
exports.GetAllBranch = async (req, res) => {
  try {
    const userId = req.user._id;

    const manager = await branchmanager.findById(userId).select("_id propertyId");
    if (!manager) return res.status(404).json({ success: false, message: "Manager not found" });

    const cachedKey = `branches-${manager.propertyId}-allbranch`;

    if (redisClient) {
      const cached = await redisClient.get(cachedKey);
      if (cached) return res.status(200).json({ success: true, message: "From cache", allbranch: JSON.parse(cached) });
    }

    const allbranch = await PropertyBranch.find({ branchmanager: userId }).lean();
    console.log("allbranch",allbranch)

    if (redisClient) await redisClient.setEx(cachedKey, 3600, JSON.stringify(allbranch));

    return res.status(200).json({ success: true, message: "All branches retrieved", allbranch });
  } catch (error) {
    return handleError(res, error, "Failed to get branches");
  }
};

// ----------------------
// Edit Branch
// ----------------------
exports.EditBranch = async (req, res) => {
  try {
    const userId = req.user._id;
    const { branchId } = req.params;

    const foundBranch = await PropertyBranch.findById(branchId).select("_id owner");
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (!foundBranch.owner.equals(userId))
      return res.status(403).json({ success: false, message: "Unauthorized" });

    const payload = {};
    ["address", "city", "state", "pincode", "status"].forEach(f => { if (req.body[f] !== undefined) payload[f] = req.body[f]; });

    const updatedBranch = await PropertyBranch.findByIdAndUpdate(branchId, payload, { new: true });

    // Efficient Redis cache invalidation
    if (redisClient) {
      const patterns = ["branches-*", "room-*", "rooms-all", `branchManagerComplaints-${branchId}`, `branchComplaints-${branchId}`];
      const pipeline = redisClient.pipeline();
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        keys.forEach(k => pipeline.del(k));
      }
      await pipeline.exec();
    }

    return res.status(200).json({ success: true, message: "Branch updated", branch: updatedBranch });
  } catch (error) {
    return handleError(res, error, "Failed to edit branch");
  }
};

// ----------------------
// Delete Branch
// ----------------------
exports.DeleteBranch = async (req, res) => {
  try {
    const userId = req.user._id;
    const { branchId } = req.body;

    const foundBranch = await PropertyBranch.findById(branchId).select("owner occupiedRoom");
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (!foundBranch.owner.equals(userId))
      return res.status(403).json({ success: false, message: "Unauthorized" });

    if (foundBranch.occupiedRoom.length > 0)
      return res.status(400).json({ success: false, message: "Some rooms are occupied" });

    await foundBranch.deleteOne();

    if (redisClient) {
      const patterns = ["branches-*", `room-${branchId}*`, "rooms-all", `branchManagerComplaints-${branchId}`, `branchComplaints-${branchId}`];
      const pipeline = redisClient.pipeline();
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        keys.forEach(k => pipeline.del(k));
      }
      await pipeline.exec();
    }

    return res.status(200).json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    return handleError(res, error, "Failed to delete branch");
  }
};

// ----------------------
// Add Branch
// ----------------------
exports.AddBranch = async (req, res) => {
  try {
    const userId = req.user._id;
    const imageFiles = req.files || [];

    const foundProperty = await Signup.findById(userId);
    if (!foundProperty) return res.status(404).json({ success: false, message: "Property not found" });

    const { address, city, state, pincode, name, streetAdress, landmark } = req.body;
    if (!address || !city || !state || !pincode || !streetAdress || !landmark || !name)
      return res.status(400).json({ success: false, message: "Missing required fields" });

    // Parallel image upload
    const uploadImages = await Promise.all(
      imageFiles.map(file => Uploadmedia.Uploadmedia(file.path).then(res => res.secure_url))
    );

    // Geocode address
    const fullAddress = `${streetAdress}, ${landmark}, ${address}, ${city}, ${state}, ${pincode}`;
    const geo = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { address: fullAddress, key: process.env.GOOGLE_API_KEY },
    });

    if (!(geo.data.status === "OK" && geo.data.results.length > 0))
      return res.status(400).json({ success: false, message: "Unable to fetch latitude and longitude" });

    const { lat, lng } = geo.data.results[0].geometry.location;

    const createdBranch = await PropertyBranch.create({
      city, name, address, state, pincode, streetAdress, landmark,
      owner: userId,
      property: foundProperty._id,
      Propertyphoto: uploadImages,
      location: { type: "Point", coordinates: [lng, lat] },
      lat, long: lng,
    });

    if (redisClient) await redisClient.del(`branches-${foundProperty._id}-allbranch`);

    return res.status(200).json({ success: true, message: "Branch created successfully", createdBranch });
  } catch (error) {
    return handleError(res, error, "Failed to add branch");
  }
};





































































exports.GetAllBranchByBranchId = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch branches only for the current branch manager
    const branches = await PropertyBranch.find({ branchmanager: userId })
      .select("name city address rooms category verified availabilityStatus")
      .lean();

    return res.status(200).json({
      success: true,
      message: "All branches fetched successfully",
      allbranch: branches,
    });
  } catch (error) {
    console.error("GetAllBranchByBranchId Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.appointBranchManager = async (req, res) => {
  try {
    const userId = req.user._id; // admin/owner id
    const branchId = req.params.id;
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "Please fill all the fields" });
    }

    const foundBranch = await PropertyBranch.findById(branchId).select("_id branchmanager");
    if (!foundBranch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    // Step 1️⃣: Create user (Signup)
    const password = "1234"; // temporary password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Signup.create({
      email,
      role: "branch-manager",
      username: name,
      password: hashedPassword,
    });

    // Step 2️⃣: Create branch manager with the same _id
    const manager = await branchmanager.create({
      _id: user._id, // same id as Signup
      propertyId: userId, // admin/owner id
      name,
      email,
      phone,
    });

    // Step 3️⃣: Attach manager to branch
    foundBranch.branchmanager = manager._id;
    await foundBranch.save();

    // ✅ Redis cache invalidation
    if (redisClient) {
      const roomPattern = `room-${branchId}-*`;
      const branchPattern = await redisClient.del(`branches-${branchId}-*`);


      const roomKeys = await redisClient.keys(roomPattern);
      if (roomKeys.length) await redisClient.del(roomKeys);

      const branchKeys = await redisClient.keys(branchPattern);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({
      success: true,
      message: "Branch manager created successfully",
      branchmanager: manager,
      branch: foundBranch,
    });
  } catch (error) {
    console.error("appointBranchManager Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};






////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

exports.changebranchpassword = async (req, res) => {
  try {
    const { id, password, confirmPassword } = req.body;

    if (!id || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password and confirm password do not match" });
    }

    if (password.length < 6 || password.length > 10) {
      return res.status(400).json({ success: false, message: "Password must be 6-10 characters long" });
    }

    const branchManager = await branchmanager.findById(id);
    if (!branchManager) {
      return res.status(404).json({ success: false, message: "Branch manager not found" });
    }

    const branchUser = await Signup.findById(id);
    if (!branchUser) {
      return res.status(404).json({ success: false, message: "User not found in Signup collection" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    branchManager.pwdchanged = true;
    await branchManager.save();

    branchUser.password = hashedPassword;
    await branchUser.save();

    return res.status(200).json({
      success: true,
      message: "Branch manager password updated successfully",
    });
  } catch (error) {
    console.error("changebranchpassword Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

exports.getAllBranchManager = async (req, res) => {
  try {
    const userId = req.user._id;
    const branches = await PropertyBranch.find({ owner: userId }).populate("branchmanager");

    const managers = branches.map(branch => branch.branchmanager).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Fetched all branch managers",
      branchManagers: managers,
    });
  } catch (error) {
    console.error("getAllBranchManager Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

exports.GetAllBranchOwner = async (req, res) => {
  try {
    const userId = req.user._id;
    const cachedKey = `branches-${userId}`;

    // Check Redis cache
    if (redisClient) {
      const cached = await redisClient.get(cachedKey);
      if (cached) {
        return res.status(200).json({ success: true, message: "Branches from cache", allbranch: JSON.parse(cached) });
      }
    }

    const allbranch = await PropertyBranch.find({ owner: userId }).populate('branchmanager');

    if (!allbranch.length) {
      return res.status(200).json({ success: false, message: "No branches found" });
    }

    // Cache result
    if (redisClient) {
      await redisClient.setEx(cachedKey, 3600, JSON.stringify(allbranch));
    }

    return res.status(200).json({ success: true, message: "All branches", allbranch });
  } catch (error) {
    console.error("GetAllBranchOwner Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







//property//





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////








exports.CreateProperty = async (req, res) => {


    try {

        const userId = req.user._id;
        const { name } = req.body;


        if (!name) {
            return res.status(400).json({
                success: false,
                message: "please Filled  the name  And Upload"
            })
        }

        const allproperty = AllProperty(userId);
        if (allproperty.length > 0) {
            return res.status(400).json({
                success: false,
                message: "User have the property Listed"
            })
        }
        const newProperty = await Property.create({
            name,
            owner: userId
        })
        return res.status(200).json({
            success: "true",
            message: "property created Successfully",
            newProperty
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Internal server Error"
        })

    }
}
exports.DeleteProperty = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if branch manager exists
        const foundBranchManager = await branchmanager.findOne({ propertyId: id });

        if (foundBranchManager) {
            foundBranchManager.status = "In-Active";
            await foundBranchManager.save();
        }

        // Delete property
        const deletedProperty = await PropertyBranch.findByIdAndDelete(id);

        if (!deletedProperty) {
            return res.status(404).json({
                success: false,
                message: "Property not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Property deleted successfully",
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};






////////////////////////////////////////////////////////////////////////////////////


//ROOM COTROLLER//


////////////////////////////////////////////////////////////////////////////////////






// ---------------------------
// ADD ROOM
// ---------------------------
exports.AddRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const imageFiles = req.files?.images;

    if (req.user.role !== "branch-manager") {
      return res.status(403).json({ success: false, message: "You are not authorised to add a room" });
    }

    const {
      branch, roomNumber, type, price, facilities, description, notAllowed, rules,
      furnishedType, allowedFor, availabilityStatus, rentperday, rentperhour,
      rentperNight, category, city, hoteltype, roomtype, renttype, flattype
    } = req.body;

    if (!branch || !roomNumber || !category) {
      return res.status(400).json({ success: false, message: "Please fill all required fields" });
    }

    if ((category !== "Hotel") && !price) {
      return res.status(400).json({ success: false, message: "Price is required for PG or Rented-Room" });
    }

    if (category === "Hotel" && !rentperday && !rentperhour && !rentperNight) {
      return res.status(400).json({ success: false, message: "At least one rent (per day/hour/night) is required for Hotel" });
    }

    const foundBranch = await PropertyBranch.findById(branch);
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

    const roomExists = foundBranch.rooms.some(r => r.roomNumber == roomNumber);
    if (roomExists) return res.status(400).json({ success: false, message: "Room Number Already Exists" });

    // Upload images
    const uploadedImages = [];
    if (imageFiles?.length > 0) {
      for (let file of imageFiles) {
        const uploadRes = await Uploadmedia.Uploadmedia(file.path);
        uploadedImages.push(uploadRes.secure_url);
      }
    }

    const newRoom = {
      roomNumber,
      allowedFor,
      renttype: category === "Rented-Room" ? renttype : undefined,
      flattype: renttype === "Flat-Rent" ? flattype : undefined,
      roomtype: renttype === "Room-Rent" ? roomtype : undefined,
      hoteltype: category === "Hotel" ? hoteltype : undefined,
      type: category === "Pg" ? type : undefined,
      price: category !== "Hotel" ? price : undefined,
      rentperday: category === "Hotel" ? rentperday : undefined,
      rentperhour: category === "Hotel" ? rentperhour : undefined,
      rentperNight: category === "Hotel" ? rentperNight : undefined,
      facilities: Array.isArray(facilities) ? facilities : facilities ? [facilities] : [],
      description: description || "",
      notAllowed: Array.isArray(notAllowed) ? notAllowed : notAllowed ? [notAllowed] : [],
      rules: Array.isArray(rules) ? rules : rules ? [rules] : [],
      furnishedType: furnishedType || "Semi Furnished",
      vacant:  type === "Double" ? 2 : type === "Triple" ? 3 : 1,
      availabilityStatus: availabilityStatus || "Available",
      category,
      city: city || foundBranch.city,
      createdBy: userId,
      branch: foundBranch._id,
      roomImages: uploadedImages,
      capacity:type==="Double"?2:type==="Triple"?3:1
    };

    foundBranch.rooms.push(newRoom);
    await foundBranch.save();
    console.log(newRoom)

    // Redis cache invalidation
    if (redisClient) {
      const roomKeys = await redisClient.keys(`room-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Room added successfully", ROOM: newRoom });
  } catch (error) {
    console.error("Error Adding Room:", error);
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// ---------------------------
// GET ALL ROOMS
// ---------------------------
exports.AllRooms = async (req, res) => {
  try {
    const branch = await PropertyBranch.findOne({ branchmanager: req.user._id });
    if (!branch) return res.status(400).json({ success: false, message: "No Branches Are Found" });

    const cachedKey = `room-${branch._id}`;
    if (redisClient) {
      const cached = await redisClient.get(cachedKey);
      if (cached) return res.status(200).json({ success: true, message: "Rooms from cache", rooms: JSON.parse(cached) });
    }

    const proprtybranch = await PropertyBranch.find({ branchmanager: req.user._id });
    const allrooms = proprtybranch.flatMap(b => b.rooms);

    if (redisClient) await redisClient.setEx(cachedKey, 3600, JSON.stringify(allrooms));

    return res.status(200).json({ success: true, totalRooms: allrooms.length, rooms: allrooms });
  } catch (error) {
    console.error("AllRooms Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

// ---------------------------
// DELETE ROOM
// ---------------------------
exports.DeleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) return res.status(400).json({ success: false, message: "Branch not found for this room" });

    const room = foundBranch.rooms.id(id);
    if (!room) return res.status(400).json({ success: false, message: "Room not found" });

    if (room.occupied !== 0 || room.occupiedhotelroom !== 0 || room.occupiedRentalRoom !== 0) {
      return res.status(400).json({ success: false, message: "Someone has already occupied this room" });
    }

    foundBranch.rooms.pull(id);

    if (room.verified) {
      if (room.category === "Pg") {
        foundBranch.totalBeds = Math.max(0, foundBranch.totalBeds - (room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3));
      } else if (room.category === "Rented-Room") {
        foundBranch.totalrentalRoom = Math.max(0, foundBranch.totalrentalRoom - 1);
      } else if (room.category === "Hotel") {
        foundBranch.totelhotelroom = Math.max(0, foundBranch.totelhotelroom - 1);
      }
    }

    await foundBranch.save();

    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Room Deleted Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ---------------------------
// UPDATE ROOM
// ---------------------------
exports.UpdateRoom = async (req, res) => {
  try {
    const { Id } = req.params;
    const updateData = req.body;
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": Id });
    if (!foundBranch) return res.status(400).json({ success: false, message: "Branch not found for this room" });

    const room = foundBranch.rooms.id(Id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const oldCategory = room.category;
    const oldType = room.type;

    const allowedFields = [
      "roomNumber","capacity","hoteltype","flattype","roomtype","renttype","type","city",
      "count","verified","description","notAllowed","rules","allowedFor","furnishedType",
      "vacant","availabilityStatus","toPublish","price","rentperday","rentperhour","rentperNight",
      "category","roomImages","facilities"
    ];

    allowedFields.forEach(field => { if (updateData[field] !== undefined) room[field] = updateData[field]; });

    if (oldCategory !== updateData.category || oldType !== updateData.type) {
      if (room.verified) {
        if (oldCategory === "Pg") room.type === "Single" ? foundBranch.totalBeds-- : room.type === "Double" ? foundBranch.totalBeds-=2 : foundBranch.totalBeds-=3;
        if (oldCategory === "Rented-Room") foundBranch.totalrentalRoom--;
        if (oldCategory === "Hotel") foundBranch.totelhotelroom--;
      }
      if (updateData.verified) {
        if (updateData.category === "Pg") updateData.type === "Single" ? foundBranch.totalBeds++ : updateData.type === "Double" ? foundBranch.totalBeds+=2 : foundBranch.totalBeds+=3;
        if (updateData.category === "Rented-Room") foundBranch.totalrentalRoom++;
        if (updateData.category === "Hotel") foundBranch.totelhotelroom++;
      }
    }

    await foundBranch.save();

    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Room Updated Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ---------------------------
// ADD ROOM IMAGES
// ---------------------------
exports.addRoomImages = async (req, res) => {
  try {
    const { id } = req.body;
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) return res.status(404).json({ success: false, message: "Room not found" });

    const room = foundBranch.rooms.id(id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found inside branch" });

    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No images selected" });

    const uploadedUrls = [];
    for (let file of req.files) {
      const uploadResp = await Uploadmedia.Uploadmedia(file.path || file.buffer, { folder: "room_images" });
      uploadedUrls.push(uploadResp.secure_url);
    }

    room.roomImages.push(...uploadedUrls);
    await foundBranch.save();

    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Images added successfully", roomImages: room.roomImages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error", error: err.message });
  }
};











////////////////////////////////////////////////////////////////////////////////////


//FILTER COTROLLER//


////////////////////////////////////////////////////////////////////////////////////





// ---------------------------
// APPLY ALL FILTERS
// ---------------------------
exports.AppliedAllFilters = async (req, res) => {
  try {
    const {
      city = "",
      min = 0,
      max = 999999,
      category = "any",
      type = "any",
      hoteltype = "any",
      Rented_Room_type = "any",
      flattype = "any",
      roomtype = "any",
      pg = "any",
      facilities = []
    } = req.body;

    // Fetch only rooms from all branches
    const branches = await PropertyBranch.find({}, "rooms").lean();

    let rooms = branches.flatMap(branch => branch.rooms);

    // ---------------------------
    // 🔥 APPLY FILTERS
    // ---------------------------

    // 🌍 City filter (partial match, case-insensitive)
    if (city.trim()) {
      const cityRegex = new RegExp(city.slice(0, 4), "i");
      rooms = rooms.filter(r => r.city && cityRegex.test(r.city));
    }

    // 💸 Price & Category filters
    if (category !== "any") rooms = rooms.filter(r => r.category?.toLowerCase() === category.toLowerCase());

    if (category === "Hotel") {
      if (hoteltype !== "any") rooms = rooms.filter(r => r.hoteltype?.toLowerCase() === hoteltype.toLowerCase());
      rooms = rooms.filter(r => r.rentperday >= min && r.rentperday <= max);
    } else {
      rooms = rooms.filter(r => r.price >= min && r.price <= max);
    }

    // 🏘 Rented-Room type filters
    if (category === "Rented-Room") {
      if (Rented_Room_type !== "any") rooms = rooms.filter(r => r.renttype === Rented_Room_type);
      if (Rented_Room_type === "Flat-Rent" && flattype !== "any") rooms = rooms.filter(r => r.flattype === flattype);
      if (Rented_Room_type === "Room-Rent" && roomtype !== "any") rooms = rooms.filter(r => r.roomtype === roomtype);
    }

    // 🛏 PG Room type
    if (category === "Pg" && pg !== "any") rooms = rooms.filter(r => r.type === pg);

    // 🚹 Universal type filter (Boys/Girls/Co-ed)
    if (type !== "any") rooms = rooms.filter(r => r.type?.toLowerCase() === type.toLowerCase());

    // 🛠 Facilities filter (all selected facilities must exist)
    if (facilities.length > 0) {
      rooms = rooms.filter(r => r.facilities && facilities.every(f => r.facilities.includes(f)));
    }

    return res.status(200).json({ success: true, count: rooms.length, data: rooms });

  } catch (error) {
    console.error("Filter Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ---------------------------
// APPLY FILTERS BASED ON CITY
// ---------------------------
exports.AppliedFilters = async (req, res) => {
  try {
    const { cityFromQuery } = req.params;
    if (!cityFromQuery) return res.status(400).json({ success: false, message: "City is required" });

    const cityRegex = new RegExp(`^${cityFromQuery.slice(0, 5)}`, "i");

    const allBranches = await PropertyBranch.find({}, "rooms").lean();
    if (!allBranches.length) return res.status(400).json({ success: false, message: "No Rooms Are Available" });

    const availableRooms = allBranches.flatMap(branch =>
      branch.rooms.filter(room => room.city && cityRegex.test(room.city))
    );

    return res.status(200).json({ success: true, data: availableRooms });
  } catch (error) {
    console.error("AppliedFilters Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ---------------------------
// GET ROOM DETAILS
// ---------------------------
exports.getdetails = async (req, res) => {
  try {
    const { id } = req.params;

    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id }).lean();
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch containing the room not found" });

    const room = foundBranch.rooms.find(r => r._id.toString() === id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const cacheKey = `room-${foundBranch._id}-getdetails`;
    if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(room));

    return res.status(200).json({ success: true, message: "Room details fetched successfully", room });
  } catch (error) {
    console.error("getdetails Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};







////


exports.deleteimage = async (req, res) => {
  try {
    const { id, imageurl } = req.body;

    if (!id || !imageurl) {
      return res.status(400).json({
        success: false,
        message: "Room ID and image URL are required",
      });
    }

    // Find the branch containing the room
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const room = foundBranch.rooms.id(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found inside branch",
      });
    }

    // Delete image from cloud
    const response = await deletemedia.deletemedia(imageurl);
    if (!response) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete the image from cloud",
      });
    }

    // Remove image URL from DB array
    room.roomImages.pull(imageurl);
    await foundBranch.save();

    // Invalidate Redis cache for this room
    const cacheKey = `room-${foundBranch._id}-image`;
    if (redisClient) {
      await redisClient.del(cacheKey);
    }

    return res.status(200).json({
      success: true,
      message: "Room image deleted successfully",
    });

  } catch (error) {
    console.error("deleteimage Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};






/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





//allpg//








///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// Get all published PG rooms (with caching)
exports.getAllPg = async (req, res) => {
  try {
    const cachedKey = "all-pg";
    let cached = redisClient ? await redisClient.get(cachedKey) : null;

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "PGs from cache",
        allrooms: JSON.parse(cached),
      });
    }

    const branches = await PropertyBranch.find({}, null, { strictPopulate: false })
      .lean()
      .populate({
        path: "rooms.branch",
        model: "PropertyBranch",
        select: "-rooms -__v -createdAt -updatedAt",
      });

    const allrooms = branches.flatMap(branch =>
      branch.rooms.filter(room => room.toPublish?.status === true && room.verified === true)
    );

    if (redisClient) {
      await redisClient.setEx(cachedKey, 3600, JSON.stringify(allrooms));
    }

    return res.status(200).json({
      success: true,
      message: "Got all PG successfully",
      allrooms,
    });

  } catch (error) {
    console.error("getAllPg Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all listed and unlisted rooms
exports.getalllistedandunlisted = async (req, res) => {
  try {
    const branches = await PropertyBranch.find({}, null, { strictPopulate: false })
      .populate({
        path: "rooms.branch",
        model: "PropertyBranch",
        select: "-rooms -__v -createdAt -updatedAt"
      })
      .exec();

    const listedRooms = branches.flatMap(branch =>
      branch.rooms.filter(room => room.toPublish?.status === true)
    );

    const unlistedRooms = branches.flatMap(branch =>
      branch.rooms.filter(room => room.toPublish?.status === false)
    );

    return res.status(200).json({
      success: true,
      message: "Fetched listed and unlisted rooms successfully",
      listedRooms,
      unlistedRooms
    });

  } catch (error) {
    console.error("getalllistedandunlisted Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// List or unlist a PG/Hotel/Rented-Room
exports.listPgRoom = async (req, res) => {
  try {
    const { branchId, roomId, comment } = req.body;

    if (!branchId || !roomId) {
      return res.status(400).json({
        success: false,
        message: "branchId and roomId are required"
      });
    }

    const branch = await PropertyBranch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    const room = branch.rooms.id(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const toggleRoomStatus = (vacantCountField = 0) => {
      if (!room.toPublish.status) {
        // Make live
        room.toPublish.status = true;
        room.verified = true;
        room.vacant = vacantCountField;
        return vacantCountField;
      } else {
        // Remove from live
        if (!comment) throw new Error("Please write the reasons");
        room.comment = comment;
        room.toPublish.status = false;
        room.verified = false;
        room.vacant = 0;
        return -vacantCountField;
      }
    };

    // Category-specific logic
    if (room.category === "Pg") {
      const bedCount = room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3;
      branch.totalBeds = Math.max(0, branch.totalBeds + toggleRoomStatus(bedCount));
    } else if (room.category === "Hotel") {
      branch.totelhotelroom = Math.max(0, branch.totelhotelroom + toggleRoomStatus(1));
    } else if (room.category === "Rented-Room") {
      branch.totalrentalRoom = Math.max(0, branch.totalrentalRoom + toggleRoomStatus(1));
    }

    room.toPublish.date = new Date();
    await branch.save();

    // Clear relevant Redis caches
    if (redisClient) {
      await redisClient.del("all-pg"); 
      await redisClient.del( `branches-${branchId}-allbranch`);
      const roomKeys = await redisClient.keys("room-*");
      for (const key of roomKeys) await redisClient.del(key);
      const branchKeys = await redisClient.keys("branches-*");
      for (const key of branchKeys) await redisClient.del(key);
    }

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      updatedRoom: room
    });

  } catch (error) {
    console.error("listPgRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
