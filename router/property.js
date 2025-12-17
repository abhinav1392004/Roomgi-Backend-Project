const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
    GetAllBranchOwner, AddBranch, EditBranch, getAllPg,
    deleteimage, addRoomImages,
    AppliedFilters, AppliedAllFilters, DeleteRoom,
    UpdateRoom, AllRooms, getAllBranchManager, changebranchpassword,
    DeleteBranch, DeleteProperty, GetAllBranch,
    AddRoom, getdetails,
    getalllistedandunlisted, listPgRoom,
    appointBranchManager, GetAllBranchByBranchId
} = require("../controller/property");


router.get("/get", Validate, GetAllBranch)
router.get("/getallpg", getalllistedandunlisted)
router.post("/listpg", listPgRoom)
router.post("/getproperty/allbranchmanager",Validate, getAllBranchManager)
router.delete("/deleteroomimage", deleteimage)
// Upload up to 10 images
router.put(
    "/addroomimages",Validate,
    upload.array("roomImages", 10),
    addRoomImages
);

router.put("/branchmanager/passwordchange", Validate, changebranchpassword)
router.get("/getalllbranchowner", Validate, GetAllBranchOwner)
router.get("/allrooms", Validate, AllRooms)
router.delete("/deleteroom/:id", Validate, DeleteRoom)
router.put("/updateroom/:Id", Validate, UpdateRoom)
router.post("/appliedallfilter", AppliedAllFilters)
router.get("/filtered/:cityFromQuery", AppliedFilters)
router.post(
    "/addroom", Validate,
    upload.fields([{ name: "images", maxCount: 10 }]),
    AddRoom
);

router.get("/get/:id", getdetails)




 router.get("/getbranch/bybranchMnager", Validate, GetAllBranchByBranchId)
router.post("/add", Validate, upload.array("images"), AddBranch);
router.post("/createbranchmanager/:id", Validate, IsOwner, appointBranchManager)
router.patch("/edit/:branchId", Validate, EditBranch)
router.delete("/DeleteBranch", Validate, DeleteBranch)
router.delete("/DeleteProperty/:id", Validate, DeleteProperty)

router.get("/allpg", getAllPg)

module.exports = router;
