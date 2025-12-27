import React from "react";
import "./Ticket.css";

const Ticket = ({
  eventName,
  ticketType,
  venue,
  date,
  time,
  qrCode,
  ticketId,
}) => {
  return (
    <div className="ticket-wrapper">
      <div className="ticket-card">

        {/* Header */}
        <div className="ticket-header">
          <h2 className="logo">skiddle</h2>
          <div className="date-time">
            <span>{time}</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Content */}
        <div className="ticket-content">
          <div className="ticket-section">
            <p className="label">EVENT</p>
            <h3>{eventName}</h3>
          </div>

          <div className="ticket-section">
            <p className="label">TICKET TYPE</p>
            <h4>{ticketType}</h4>
          </div>

          <div className="ticket-section">
            <p className="label">VENUE</p>
            <p>{venue}</p>
          </div>
        </div>

        {/* QR */}
        <div className="ticket-qr">
          <img src={qrCode} alt="QR Code" />
          <p className="ticket-id">{ticketId}</p>
        </div>

      </div>
    </div>
  );
};

export default Ticket;
