import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../pages/Ticket";

const TicketPage = () => {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    const fetchTicket = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          id,
          qr_code,
          owner_id,
          events (
            title,
            venue,
            event_datetime
          )
        `,
        )
        .eq("id", id)
        .eq("owner_id", user.id) // 🔒 SECURITY
        .single();

      if (!error) setTicket(data);
    };

    fetchTicket();
  }, [id]);

  if (!ticket) return <p>Loading ticket...</p>;

  return (
    <Ticket
      eventName={ticket.events.title}
      venue={ticket.events.venue}
      date={new Date(ticket.events.event_datetime).toLocaleDateString()}
      time={new Date(ticket.events.event_datetime).toLocaleTimeString()}
      qrCode={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${ticket.qr_code}`}
      ticketId={ticket.id}
      ticketType="General Admission"
    />
  );
};

export default TicketPage;
