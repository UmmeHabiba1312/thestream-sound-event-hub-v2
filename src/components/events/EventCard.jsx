import React from "react";
import { Calendar, MapPin, Users, Ticket } from "lucide-react";
import "./EventCard.css";

const EventCard = ({ event, onViewDetails }) => {
  const availabilityPercentage =
    (event.availableTickets / event.totalCapacity) * 100;
  const isAlmostSoldOut = availabilityPercentage < 20;

  return (
    <div className="event-card hover-lift">
      <div className="event-poster-wrapper">
        <img src={event.poster} alt={event.title} className="event-poster" />
        {isAlmostSoldOut && (
          <div className="event-badge almost-sold">Almost Sold Out!</div>
        )}
        <div className="event-category-badge">{event.category}</div>
      </div>
      <div className="event-info">
        <h3 className="event-title">{event.title}</h3>
        <p className="event-description">
          {event.description.slice(0, 100)}...
        </p>

        <div className="event-details">
          <div className="detail-item">
            <Calendar size={16} />
            <span>
              {new Date(event.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="detail-item">
            <MapPin size={16} />
            <span>{event.location}</span>
          </div>
          <div className="detail-item">
            <Users size={16} />
            <span>
              {event.availableTickets} / {event.totalCapacity} tickets
            </span>
          </div>
        </div>

        <div className="event-footer">
          <div className="event-price">
            <span className="price-label">From</span>
            <span className="price-value">${event.ticketPrice}</span>
          </div>
          <button className="event-btn" onClick={() => onViewDetails(event)}>
            <Ticket size={16} />
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
