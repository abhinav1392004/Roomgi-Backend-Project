
const Wishlist = require("../model/wishlist")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { sendForgotPasswordMail } = require('../utils/mail')
const crypto = require('crypto')
const { Uploadmedia, deletemedia } = require("../utils/cloudinary")
const Payment = require("../model/payment")
const PropertyBranch = require("../model/propertyBranch")
const Expense = require("../model/expenses")
const Tenant = require("../model/tenants")
const Razorpay = require("razorpay");
const Signup = require("../model/user")
const redisClient = require("../utils/redis");
const Review = require("../model/review")
const Complaint = require("../model/complaints")




const signupcontroller = async (req, res) => {
    try {
        const { email, username, password, role } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'please filled all the data carefully'
            })
        }
        if (password.length < 6 || password.length > 10) {
            return res.status(400).json({
                success: false,
                message: "Password length should be between 6 to 10 characters"
            });
        }


        const existinguser = await Signup.findOne({ email: email });
        if (existinguser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            })
        }


        let hashedpassword;
        try {
            hashedpassword = await bcrypt.hash(password, 10);

        } catch (error) {

            return res.status(500).json({
                success: false,
                message: " Internal server error while hashing the password"
            })

        }


        const User = await Signup.create({
            email,
            username,
            password: hashedpassword,
            role
        })
        const payload = {
            id: User._id,
            name: User.username,
            email: User.email,
            role: User.role,
            walletBalance:User.walletBalance,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
            expiresIn: "24h"
        })
        const options = {
            path: "/",
            expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            httpOnly: true,
            secure: true,
            sameSite: "none"
        };

        res.cookie("babbarCookie", token, options).status(200).json({
            success: true,
            token,
            existingUser: User,
            message: "User logged in successfully",
        });






    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: "Internal sever error"
        })
    }
}
// --------------------------------------------
// ADD OR REMOVE FROM WISHLIST (TOGGLE)
// --------------------------------------------
const toggleWishlist = async (req, res) => {
    try {
        const { pgId, roomId } = req.body;
        const userId = req.user._id;

        // Check if exists
        const existing = await Wishlist.findOne({ userId, pgId });

        // If exists, REMOVE it
        if (existing) {
            await Wishlist.findByIdAndDelete(existing._id);
            return res.status(200).json({
                success: true,
                message: "Removed from wishlist"
            });
        }

        // If not exists, ADD it
        await Wishlist.create({
            userId,
            pgId,
            room: roomId
        });

        res.status(200).json({
            success: true,
            message: "Added to wishlist"
        });

    } catch (err) {
        console.log("Wishlist toggle error:", err);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};


// --------------------------------------------
// GET USER WISHLIST
//---------------------------------------------
const getWishlist = async (req, res) => {
    try {
        const items = await Wishlist.find({ userId: req.user._id })
            .populate("pgId");

        const finalData = [];

        for (const item of items) {
            const roomId = item.roomId;
            const branch = item.pgId; // populated branch

            if (!branch) {
                console.log("❌ Branch not found for item:", item._id);
                continue;
            }

            // find room inside branch.rooms
            const room = branch.rooms?.find(r => r._id.toString() === roomId);

            if (!room) {
                console.log("❌ Room not found for branch:", branch._id, "roomId:", roomId);
                continue;
            }

            finalData.push({
                _id: item._id,
                pgId: branch,
                room: room
            });
        }

        return res.status(200).json({
            success: true,
            items: finalData
        });

    } catch (error) {
        console.log("Fetch wishlist error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch wishlist"
        });
    }
};




const Logincontroller = async (req, res) => {
    console.log("req.body", req.body)
    const { email, password, role } = req.body;

    try {

        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "please filled all the data carefully"
            })
        }




        const existingUser = await Signup.findOne({ email });



        if (!existingUser) {
            return res.status(400).json({
                success: false,
                message: "user not found with this details",
            })
        }

        console.log(existingUser)








        const ispasswordcorrect = await bcrypt.compare(password, existingUser.password);
        if (!ispasswordcorrect) {
            return res.status(400).json({
                success: false,
                message: "Incorrect password filled ",
            })
        }

        if (role !== existingUser.role) {
            return res.status(400).json({
                success: false,
                message: "Your role is Not valid",
            })
        }


        const payload = {
            id: existingUser._id,
            name: existingUser.username,
            email: existingUser.email,
            role: existingUser.role,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
            expiresIn: "24h"
        })
        const options = {
            path: "/",
            expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            httpOnly: true,
            secure: true,
            sameSite: "none"
        };

        res.cookie("babbarCookie", token, options).status(200).json({
            success: true,
            token,
            existingUser,
            message: "User logged in successfully",
        });







    } catch (error) {
        console.log(error)

        return res.status(500).json({
            success: false,
            message: "internal server error",
        })

    }
}



const Logoutcontroller = async (req, res) => {
    try {

        res.clearCookie('babbarCookie', {
            httpOnly: true,
            sameSite: 'none',
            path: '/', // if used during set
        });


        return res.status(200).json({
            success: true,
            message: "logout successfullly"
        })




    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "error in while getting logout"
        })
    }
}



const GetUserProfile = async (req, res) => {
    try {
        const userid = req.user._id;

        const profile = await Signup.findById(userid)
        const complain = await Complaint.find({ tenantId: userid }).populate("branchId")
        const payment = await Payment.find({ email: req.user.email })
        const reviews = await Review.find({ user: userid })


        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "User profile not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            profile,complain,payment,reviews
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching profile",
        });
    }
};






const forgotUser = async (req, res) => {

    try {
        const { email } = req.body;
        const founduser = await Signup.findOne({ email });
        console.log("founduser", founduser)
        if (!founduser) {
            return res.status(400).json({
                success: false,
                message: `not found the use with this email`
            })
        }
        const resetSession = Date.now() + 360000;
        const resetLink = await crypto.randomBytes(32).toString('hex');
        const finalresetlink = `https://smart-resume-reviewer.vercel.app/forgotresumepassword/${resetLink}`
        founduser.resetSession = resetSession;
        founduser.resetLink = resetLink;
        await founduser.save();
        await sendForgotPasswordMail(email, founduser.username, finalresetlink)


        return res.status(200).json({
            success: true,
            message: `mail send successfully`
        })

    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            messaeg: `Internal server error`
        })

    }

}



const checkmail = async (req, res) => {

    try {

        const { password, confermpassword } = req.body;
        const { resettoken } = req.params;
        console.log(resettoken)

        if (!password || !confermpassword) {
            return res.status(400).json({
                success: false,
                message: `plesae fill the filled `,
            })
        }
        if (password != confermpassword) return res.status(400).json({
            success: false,
            message: `passowrd filled carefully`
        })
        const user = await Signup.findOne({ resetLink: resettoken, resetSession: { $gt: Date.now() } });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: `not able to find the user`,
            })
        }


        const encryptedpassword = await bcrypt.hash(password, 10);

        user.password = encryptedpassword;
        user.resetSession = undefined;
        user.resetLink = undefined;


        await user.save();

        return res.status(200).json({
            success: true,
            messge: 'passsword change successfully '
        })




    } catch (error) {
        console.log("error", error);
        res.status(500).json({
            success: false,
            message: `intrnal server error`,
        })

    }
}
module.exports = { signupcontroller, getWishlist, toggleWishlist, GetUserProfile, Logincontroller, Logoutcontroller, forgotUser, checkmail };
