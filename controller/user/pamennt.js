exports.BookingDetails = async (req, res) => {
    try {
        const cacheKey = `tenant-${req.user._id}-booking`;

        // 1️⃣ Try fetching from Redis cache
        let cached = null;
        try {
            cached = await redisClient.get(cacheKey);
        } catch (err) {
            console.warn("Redis fetch error:", err.message);
        }

        if (cached) {
            return res.status(200).json({
                success: true,
                message: "All bookings fetched from cache",
                bookings: JSON.parse(cached),
            });
        }

        // 2️⃣ Fetch bookings from DB
        const userBookings = await Booking.find({ email: req.user.email })
            .populate({
                path: "branch",
                select: "name city rooms",
                populate: {
                    path: "rooms",
                    match: { roomNumber: { $in: [] } }, // will filter below
                    populate: {
                        path: "personalreview",
                        model: "Review",
                        select: "rating review user createdAt"
                    }
                }
            })
            .sort({ bookingDate: -1 });

        if (!userBookings.length) {
            return res.status(404).json({
                success: false,
                message: "No bookings found for this tenant",
            });
        }

        // 3️⃣ Filter rooms to only include booked room
        const filteredBookings = userBookings.map(booking => {
            if (booking.branch && booking.branch.rooms) {
                booking.branch.rooms = booking.branch.rooms.filter(
                    room => room.roomNumber === booking.roomNumber
                );
            }
            return booking;
        });

        // 4️⃣ Cache the filtered bookings for 10 minutes
        try {
            await redisClient.setEx(cacheKey, 600, JSON.stringify(filteredBookings));
        } catch (err) {
            console.warn("Redis caching failed:", err.message);
        }

        // 5️⃣ Return response
        return res.status(200).json({
            success: true,
            message: "All bookings fetched successfully",
            bookings: filteredBookings,
        });

    } catch (error) {
        console.error("BookingDetails Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};
