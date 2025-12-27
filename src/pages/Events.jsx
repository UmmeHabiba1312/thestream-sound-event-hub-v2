import { supabase } from "../lib/supabase";
import React, { useEffect, useState } from "react";
import EventCard from "../components/events/EventCard";
import { featuredAds, resaleTickets } from "../data/eventsData";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Ticket,
  RefreshCw,
} from "lucide-react";
import "./Events.css";

const Events = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    venue: "",
    price: "",
    capacity: "",
    poster: null,
  });

  // Fetch approved events from Supabase
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "approved") // ✅ only approved events
      .order("event_datetime", { ascending: true });

    if (!error && data) {
      const mappedEvents = data.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.event_datetime,
        time: new Date(e.event_datetime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        venue: e.venue,
        location: e.venue,
        ticketPrice: e.ticket_price,
        totalCapacity: e.total_tickets,
        availableTickets: e.available_tickets,
        poster: e.poster_url || "/default-event.jpg",
        category: "Live Event",
      }));
      setEvents(mappedEvents);
    }
  };

  const buyTicket = async (event) => {
    if (!user) {
      alert("Please login to buy ticket");
      return;
    }

    if (event.availableTickets <= 0) {
      alert("Tickets sold out");
      return;
    }

    const qrValue = `${event.id}_${user.id}_${Date.now()}`;

    // 1️⃣ Insert ticket
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        event_id: event.id,
        owner_id: user.id,
        qr_code: qrValue,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Ticket purchase failed");
      return;
    }

    // 2️⃣ Reduce available tickets
    await supabase
      .from("events")
      .update({
        available_tickets: event.availableTickets - 1,
      })
      .eq("id", event.id);

    // 3️⃣ Redirect to ticket page
    navigate(`/ticket/${data.id}`);
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);
    };

    getUser();
    fetchEvents();
  }, []);

  // Handle Create Event
  const handleCreateEvent = async () => {
    try {
      if (!user) {
        alert("You must be logged in to create an event");
        return;
      }

      const { title, description, date, time, venue, price, capacity, poster } =
        formData;

      if (
        !title ||
        !description ||
        !date ||
        !time ||
        !venue ||
        !price ||
        !capacity
      ) {
        alert("Please fill in all required fields");
        return;
      }

      let posterUrl = null;
      if (poster) {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("event-posters")
          .upload(`posters/${Date.now()}_${poster.name}`, poster);

        if (uploadError) throw uploadError;

        const { data: urlData, error: urlError } = supabase.storage
          .from("event-posters")
          .getPublicUrl(uploadData.path);

        if (urlError) throw urlError;
        posterUrl = urlData.publicUrl;
      }

      const eventDateTime = new Date(`${date}T${time}`);
      console.log("Inserting event:", {
        title,
        description,
        event_datetime: eventDateTime,
        venue,
        ticket_price: Number(price),
        total_tickets: Number(capacity),
        available_tickets: Number(capacity),
        poster_url: posterUrl,
        created_by: user.id,
        status: "pending",
      });

      const { error } = await supabase.from("events").insert({
        title,
        description,
        event_datetime: eventDateTime,
        venue,
        ticket_price: Number(price),
        total_tickets: Number(capacity),
        available_tickets: Number(capacity),
        poster_url: posterUrl,
        created_by: user.id,
        status: "pending",
      });

      if (error) {
        console.error("Insert error:", error);
        alert("Error creating event. Check console.");
        return;
      }

      setShowCreateModal(false);
      fetchEvents();
      alert("Event submitted for admin approval");
      setFormData({
        title: "",
        description: "",
        date: "",
        time: "",
        venue: "",
        price: "",
        capacity: "",
        poster: null,
      });
    } catch (err) {
      console.error(err);
      alert("Error creating event. Please try again.");
    }
  };

  const handleViewDetails = (event) => {
    setSelectedEvent(event);
    setShowTicketModal(true);
  };

  const nextAd = () =>
    setCurrentAdIndex((prev) => (prev + 1) % featuredAds.length);
  const prevAd = () =>
    setCurrentAdIndex(
      (prev) => (prev - 1 + featuredAds.length) % featuredAds.length,
    );

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
              className={`indicator ${index === currentAdIndex ? "active" : ""}`}
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
        <button
          className="create-event-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} /> Create Event
        </button>
      </div>

      {/* Events Grid */}
      <div className="events-grid">
        {events.map((event) => (
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
              <button className="resale-buy-btn">
                <Ticket size={16} /> Buy Ticket
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create New Event</h2>
            <div className="form-group">
              <label className="form-label">Event Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter event title"
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Describe your event"
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input
                  type="time"
                  className="form-input"
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input
                type="text"
                className="form-input"
                placeholder="Event venue"
                onChange={(e) =>
                  setFormData({ ...formData, venue: e.target.value })
                }
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ticket Price ($)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="99"
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total Capacity</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="500"
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Upload Event Poster</label>
              <div className="upload-area">
                <label className="upload-area">
                  <Plus size={32} />
                  <p>Click to upload poster</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setFormData({ ...formData, poster: e.target.files[0] })
                    }
                    style={{ display: "none" }}
                  />
                </label>
                {/* Poster preview */}
                {formData.poster && (
                  <img
                    src={URL.createObjectURL(formData.poster)}
                    alt="Poster preview"
                    className="poster-preview"
                    style={{
                      marginTop: "10px",
                      maxWidth: "100%",
                      borderRadius: "8px",
                    }}
                  />
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button className="modal-btn submit" onClick={handleCreateEvent}>
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Purchase Modal */}
      {showTicketModal && selectedEvent && (
        <div
          className="modal-overlay"
          onClick={() => setShowTicketModal(false)}
        >
          <div
            className="modal-content ticket-modal"
            onClick={(e) => e.stopPropagation()}
          >
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
                  {new Date(selectedEvent.date).toLocaleDateString()} at{" "}
                  {selectedEvent.time}
                </span>
              </div>
              <div className="detail-row">
                <span>Venue</span>
                <span className="detail-value">{selectedEvent.venue}</span>
              </div>
              <div className="detail-row">
                <span>Location</span>
                <span className="detail-value">{selectedEvent.location}</span>
              </div>
              <div className="detail-row">
                <span>Available Tickets</span>
                <span className="detail-value">
                  {selectedEvent.availableTickets} /{" "}
                  {selectedEvent.totalCapacity}
                </span>
              </div>
              <div className="detail-row total">
                <span>Ticket Price</span>
                <span className="detail-value">
                  ${selectedEvent.ticketPrice}
                </span>
              </div>
            </div>

            <div className="qr-placeholder">
              <div className="qr-code"></div>
              <p className="qr-label">
                QR Code will be generated after purchase
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowTicketModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn submit"
                onClick={() => buyTicket(selectedEvent)}
              >
                <Ticket size={18} /> Buy Ticket - ${selectedEvent.ticketPrice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
