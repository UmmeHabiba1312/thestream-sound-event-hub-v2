import React, { useState } from 'react';
import EventCard from '../components/events/EventCard';
import { eventsData, featuredAds, resaleTickets } from '../data/eventsData';
import { Plus, ChevronLeft, ChevronRight, Ticket as TicketIcon, RefreshCw } from 'lucide-react';
import TicketComponent from "../components/ticket/Ticket";
import './Events.css';

const Events = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const [showFinalTicket, setShowFinalTicket] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState(null);

  const handleViewDetails = (event) => {
    setSelectedEvent(event);
    setShowTicketModal(true);
  };

  const nextAd = () => {
    setCurrentAdIndex((prev) => (prev + 1) % featuredAds.length);
  };

  const prevAd = () => {
    setCurrentAdIndex((prev) => (prev - 1 + featuredAds.length) % featuredAds.length);
  };

  const handleBuyTicket = () => {
    if (!selectedEvent) return;

    const ticketData = {
      eventName: selectedEvent.title,
      ticketType: selectedEvent.ticketPrice === 0 ? "Complimentary ticket" : "General Admission",
      venue: selectedEvent.venue,
      date: new Date(selectedEvent.date).toLocaleDateString(),
      time: selectedEvent.time,
      qrCode: "/qr.png",
      ticketId: Math.floor(100000000000 + Math.random() * 900000000000),
    };

    setGeneratedTicket(ticketData);
    setShowTicketModal(false);
    setShowFinalTicket(true);
  };

  return (
    <div className="events-page">

      {/* Ad Banner Section */}
      <section className="ad-banner-section">
        <div className="ad-carousel">
          <button className="carousel-btn prev" onClick={prevAd}>
            <ChevronLeft size={24} />
          </button>

          <div className="ad-banner animate-fade-in" key={currentAdIndex}>
            <img
              src={featuredAds[currentAdIndex].image}
              alt={featuredAds[currentAdIndex].title}
              className="ad-image"
            />
            <div className="ad-content">
              <h2 className="ad-title">{featuredAds[currentAdIndex].title}</h2>
              <p className="ad-sponsor">
                Sponsored by {featuredAds[currentAdIndex].sponsor}
              </p>
              <button className="ad-btn">Learn More</button>
            </div>
          </div>

          <button className="carousel-btn next" onClick={nextAd}>
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="ad-indicators">
          {featuredAds.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentAdIndex ? 'active' : ''}`}
              onClick={() => setCurrentAdIndex(index)}
            />
          ))}
        </div>
      </section>

      {/* Events Header */}
      <div className="events-header">
        <div>
          <h1 className="events-title">Upcoming Events</h1>
          <p className="events-subtitle">Book your tickets to amazing events</p>
        </div>
        <button className="create-event-btn" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {/* Events Grid */}
      <div className="events-grid">
        {eventsData.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {/* Resale Marketplace */}
      <section className="resale-section">
        <div className="resale-header">
          <RefreshCw className="resale-icon" />
          <h2 className="resale-title">Ticket Resale Marketplace</h2>
          <p className="resale-subtitle">Find tickets from verified sellers</p>
        </div>

        <div className="resale-grid">
          {resaleTickets.map((ticket) => (
            <div key={ticket.id} className="resale-card hover-lift">
              <div className="resale-info">
                <h3 className="resale-event">{ticket.eventTitle}</h3>
                <p className="resale-section">{ticket.section}</p>
                <p className="resale-seller">Sold by {ticket.seller}</p>
              </div>

              <div className="resale-pricing">
                <div className="original-price">${ticket.originalPrice}</div>
                <div className="resale-price">${ticket.resalePrice}</div>
                <div className="qty-available">{ticket.quantity} available</div>
              </div>

              <button
                className="modal-btn submit"
                onClick={() =>
                  handleViewDetails({
                    ...ticket,
                    title: ticket.eventTitle,
                    ticketPrice: ticket.resalePrice,
                  })
                }
              >
                <TicketIcon size={18} />
                Buy Ticket - ${ticket.resalePrice}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Final Ticket Output */}
      {showFinalTicket && generatedTicket && (
        <div className="modal-overlay" onClick={() => setShowFinalTicket(false)}>
          <div
            className="modal-content ticket-output-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <TicketComponent {...generatedTicket} />

            <button
              className="modal-btn submit mt-3"
              onClick={() => setShowFinalTicket(false)}
            >
              Close Ticket
            </button>
          </div>
        </div>
      )}

      {/* Ticket Purchase Modal */}
      {showTicketModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowTicketModal(false)}>
          <div className="modal-content ticket-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedEvent.poster}
              alt={selectedEvent.title}
              className="ticket-poster"
            />

            <h2 className="modal-title">{selectedEvent.title}</h2>
            <p className="ticket-description">{selectedEvent.description}</p>

            <div className="ticket-details">
              <div className="detail-row">
                <span>Date & Time</span>
                <span className="detail-value">
                  {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                </span>
              </div>

              <div className="detail-row">
                <span>Venue</span>
                <span className="detail-value">{selectedEvent.venue}</span>
              </div>

              <div className="detail-row total">
                <span>Ticket Price</span>
                <span className="detail-value">${selectedEvent.ticketPrice}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowTicketModal(false)}>
                Cancel
              </button>
              <button className="modal-btn submit" onClick={handleBuyTicket}>
                <TicketIcon size={18} />
                Buy Ticket - ${selectedEvent.ticketPrice}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Events;
