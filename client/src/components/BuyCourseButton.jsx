import React, { useEffect } from "react";
import { Button } from "./ui/button";
import { useCreateCheckoutSessionMutation } from "@/features/api/purchaseApi";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BuyCourseButton = ({ courseId }) => {
  const [createCheckoutSession, { data, isLoading, isSuccess, isError, error }] =
    useCreateCheckoutSessionMutation();

  const purchaseCourseHandler = async () => {
    const { data: order } = await createCheckoutSession(courseId);
    console.log(order)
    try {
      
      var options = {
        key: import.meta.env.REACT_APP_KEY,
        amount: order.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: order.currency,
        name: "ForLearner", //your business name
        description: "Test Transaction",
        image: "https://example.com/your_logo",
        order_id: order.id, //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response) {
          const body = {
            ...response, amount: order.amount
          };
          console.log(body)

          const { data } = await axios.post("https://learning-management-system-4-n5pq.onrender.com/api/v1/purchase/validate", body);
          console.log(data);
        },
        prefill: {
          //We recommend using the prefill parameter to auto-fill customer's contact information, especially their phone number
          name: "Web Dev", //your customer's name
          email: "webdev@example.com",
          contact: "9000000000", //Provide the customer's phone number for better conversion rates
        },
        notes: {
          address: "Razorpay Corporate Office",
        },
        theme: {
          color: "#3399cc",
        },
      };
      var rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", function (response) {
        alert(response.error.code);
        alert(response.error.description);
        alert(response.error.source);
        alert(response.error.step);
        alert(response.error.reason);
        alert(response.error.metadata.order_id);
        alert(response.error.metadata.payment_id);
      });
      rzp1.open();
      e.preventDefault();
    } catch (error) {
      alert(error.response.data.message)
    }

  };

  useEffect(() => {
    if (isSuccess) {
      if (data?.url) {
        window.location.href = data.url; // Redirect to stripe checkout url
      } else {
        toast.error("Invalid response from server.")
      }
    }
    if (isError) {
      toast.error(error?.data?.message || "Failed to create checkout session")
    }
  }, [data, isSuccess, isError, error])

  return (
    <Button
      disabled={isLoading}
      onClick={purchaseCourseHandler}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Please wait
        </>
      ) : (
        "Purchase Course"
      )}
    </Button>
  );
};

export default BuyCourseButton;
