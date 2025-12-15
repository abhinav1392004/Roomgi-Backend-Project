const Signup = require("../model/user");
const jwt = require("jsonwebtoken");

exports.Validate = async (req, res, next) => {
    try {
        const token = req.cookies.babbarCookie;
        console.log("Token:fggkjnjks", token);

        if (!token) {



            return res.status(400).json({
                success: false,
                message: "Token not found"
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        console.log("Decoded:", decoded);

        if (!decoded) {
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        // Check user in DB
        const user = await Signup.findById(decoded.id);
        console.log("USER:", user);

        // If user not found → CLEAR COOKIE
        if (!user) {
            res.clearCookie("babbarCookie", {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/"
            });

            return res.status(400).json({
                success: false,
                message: "User not found. Cookie cleared."
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.log(error);

        // If token expired → CLEAR COOKIE
        if (error.name === "TokenExpiredError") {
            res.clearCookie("babbarCookie", {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/"
            });

            return res.status(401).json({
                success: false,
                message: "Token expired. Please login again."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ================== ROLE CHECK MIDDLEWARE =================== //

exports.IsBranchmanager = (req, res, next) => {
    try {
        if (req.user.role !== "branch-manager") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this page"
            });
        }
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

exports.IsOwner = (req, res, next) => {
    try {
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this page"
            });
        }
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
