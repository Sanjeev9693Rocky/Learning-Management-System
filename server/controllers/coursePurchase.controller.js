import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";
import Razorpay from 'razorpay'
import crypto from 'node:crypto'

export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.id;
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found!" });

    // Create a new course purchase record
    const newPurchase = new CoursePurchase({
      courseId,
      userId,
      amount: course.coursePrice,
      status: "pending",
    });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });
    const options = {
      'amount': course.coursePrice * 100,
      'currency': "INR",
      'receipt': "order_rcptid_11"
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }

    // Save the purchase record
    newPurchase.paymentId = order.id;
    await newPurchase.save();
    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }

};

export const stripeWebhook = async (req, res) => {

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } =
    req.body;

  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET);
  //order_id + "|" + razorpay_payment_id
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest("hex");
  if (digest !== razorpay_signature) {
    return res.status(400).json({ message: "Transaction failed!" });
  }
  // return res.send({ amount })
  try {

    const purchase = await CoursePurchase.findOne({
      paymentId: razorpay_order_id
    }).populate({ path: "courseId" });
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (amount) {
      purchase.amount = amount / 100;
    }
    purchase.status = "completed";

    // Make all lectures visible by setting `isPreviewFree` to true
    if (purchase.courseId && purchase.courseId.lectures.length > 0) {
      await Lecture.updateMany(
        { _id: { $in: purchase.courseId.lectures } },
        { $set: { isPreviewFree: true } }
      );
    }

    await purchase.save();

    // Update user's enrolledCourses
    await User.findByIdAndUpdate(
      purchase.userId,
      { $addToSet: { enrolledCourses: purchase.courseId._id } }, // Add course ID to enrolledCourses
      { new: true }
    );

    // Update course to add user ID to enrolledStudents
    await Course.findByIdAndUpdate(
      purchase.courseId._id,
      { $addToSet: { enrolledStudents: purchase.userId } }, // Add user ID to enrolledStudents
      { new: true }
    );
  } catch (error) {
    console.error("Error handling event:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }

  return res.status(200).json({ message: "Success" })


  // let event;

  // try {
  //   const payloadString = JSON.stringify(req.body, null, 2);
  //   const secret = process.env.WEBHOOK_ENDPOINT_SECRET;

  //   const header = stripe.webhooks.generateTestHeaderString({
  //     payload: payloadString,
  //     secret,
  //   });

  //   event = stripe.webhooks.constructEvent(payloadString, header, secret);
  // } catch (error) {
  //   console.error("Webhook error:", error.message);
  //   return res.status(400).send(`Webhook error: ${error.message}`);
  // }

  // Handle the checkout session completed event
  // if (event.type === "checkout.session.completed") {
  //   console.log("check session complete is called");

  //   try {
  //     const session = event.data.object;

  //     const purchase = await CoursePurchase.findOne({
  //       paymentId: session.id,
  //     }).populate({ path: "courseId" });

  //     if (!purchase) {
  //       return res.status(404).json({ message: "Purchase not found" });
  //     }

  //     if (session.amount_total) {
  //       purchase.amount = session.amount_total / 100;
  //     }
  //     purchase.status = "completed";

  //     // Make all lectures visible by setting `isPreviewFree` to true
  //     if (purchase.courseId && purchase.courseId.lectures.length > 0) {
  //       await Lecture.updateMany(
  //         { _id: { $in: purchase.courseId.lectures } },
  //         { $set: { isPreviewFree: true } }
  //       );
  //     }

  //     await purchase.save();

  //     // Update user's enrolledCourses
  //     await User.findByIdAndUpdate(
  //       purchase.userId,
  //       { $addToSet: { enrolledCourses: purchase.courseId._id } }, // Add course ID to enrolledCourses
  //       { new: true }
  //     );

  //     // Update course to add user ID to enrolledStudents
  //     await Course.findByIdAndUpdate(
  //       purchase.courseId._id,
  //       { $addToSet: { enrolledStudents: purchase.userId } }, // Add user ID to enrolledStudents
  //       { new: true }
  //     );
  //   } catch (error) {
  //     console.error("Error handling event:", error);
  //     return res.status(500).json({ message: "Internal Server Error" });
  //   }
  // }
  // res.status(200).send();
};
export const getCourseDetailWithPurchaseStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.id;

    const course = await Course.findById(courseId)
      .populate({ path: "creator" })
      .populate({ path: "lectures" });

    const purchased = await CoursePurchase.findOne({ userId, courseId });
    console.log(purchased);

    if (!course) {
      return res.status(404).json({ message: "course not found!" });
    }

    return res.status(200).json({
      course,
      purchased: !!purchased, // true if purchased, false otherwise
    });
  } catch (error) {
    console.log(error);
  }
};

export const getAllPurchasedCourse = async (_, res) => {
  try {
    const purchasedCourse = await CoursePurchase.find({
      status: "completed",
    }).populate("courseId");
    if (!purchasedCourse) {
      return res.status(404).json({
        purchasedCourse: [],
      });
    }
    return res.status(200).json({
      purchasedCourse,
    });
  } catch (error) {
    console.log(error);
  }
};
