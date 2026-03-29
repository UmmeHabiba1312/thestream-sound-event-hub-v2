// src/components/ResaleButton.jsx
import React, { useState } from "react";
import { supabase } from "../lib/supabase";

const ResaleButton = ({ ticket, onSuccess, user }) => {
  // ← user prop add kar do
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleList = async () => {
    const resalePrice = parseFloat(price);
    const maxAllowed = ticket.original_price * 1.1;

    if (isNaN(resalePrice) || resalePrice <= 0) {
      alert("Valid price daalo");
      return;
    }

    if (resalePrice > maxAllowed) {
      alert(`Max $${maxAllowed.toFixed(2)} allowed`);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("tickets")
      .update({
        is_for_resale: true,
        resale_price: resalePrice,
      })
      .eq("id", ticket.id)
      .eq("owner_id", user.id) // Ab user defined hai
      .select();

    if (error) {
      console.error("Update failed:", error);
      alert("Failed: " + error.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      console.log("Successfully updated:", data);
      alert(`Ticket listed at $${resalePrice}!`);
      onSuccess();
    } else {
      alert("Update failed – no rows affected");
    }

    setLoading(false);
  };
  return (
    <div className="mt-4">
      <input
        type="number"
        placeholder={`Max: $${(ticket.original_price * 1.1).toFixed(2)}`}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full px-4 py-2 rounded bg-gray-800 text-white mb-3"
      />
      <button
        onClick={handleList}
        disabled={loading}
        className="w-full bg-yellow-600 hover:bg-yellow-700 py-3 rounded font-bold"
      >
        {loading ? "Listing..." : "List for Resale"}
      </button>
    </div>
  );
};

export default ResaleButton;
