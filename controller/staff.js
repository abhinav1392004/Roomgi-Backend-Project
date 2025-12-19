const Staff = require("../model/owner/staff");
const Property = require("../model/branchmanager/property");
const PropertyBranch = require("../model/owner/propertyBranch");


exports.getAllStaff = async (req, res) => {
  try {
    const id = req.user._id;
    const findproperty = await PropertyBranch.find({ branchmanager: id })

    let AllStaff = [];
    for (const branch of findproperty) {
      const staff = await Staff.find({ branch: branch._id }).populate("branch")
      if(staff.length>0){
        AllStaff.push(...staff)

      }
      
    }

    res.status(200).json({ success: true, AllStaff });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getStaffByid = async (req, res) => {
  console.log("by id")
  try {
    const {id} = req.params
    console.log(id)
    const staff = await Staff.findById(id)
    console.log(staff)

    res.status(200).json({ success: true, staff });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.addStaff = async (req, res) => {
  try {
    const { name, role, contact, email, assignedProperties, permissions, branchId } = req.body;


    const newStaff = await Staff.create({
      name,
      role,
      contact,
      email,
      assignedProperties,
      permissions,
      branch: branchId
    });

    res.status(201).json({ success: true, message: "Staff added", staff: newStaff });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: "Failed to add staff" });
  }
};

exports.updateStaff = async (req, res) => {
  console.log(req.body)
  try {
    const updated = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // console.log(updated)
    res.status(200).json({ success: true, message: "Staff updated", staff: updated });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: "Failed to update staff" });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Staff deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete staff" });
  }
};
