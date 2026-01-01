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
  QrCode,
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
  const [isBanned, setIsBanned] = useState(false);
  const [resaleTickets, setResaleTickets] = useState([]);
  const [hasEventsToScan, setHasEventsToScan] = useState(false);
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
      .in("status", ["approved", "sold_out", "pending"]) // Temporary pending bhi add kar do test ke liye
      .order("event_datetime", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      setEvents([]);
      return;
    }

    console.log("RAW DATA FROM SUPABASE (with status filter):", data);

    if (!data || data.length === 0) {
      setEvents([]);
      console.log("No events returned from query");
      return;
    }

    const now = new Date();

    const futureEvents = data.filter((e) => {
      let eventDateStr = e.event_datetime;
      if (eventDateStr.includes(" ")) {
        eventDateStr = eventDateStr.replace(" ", "T");
      }
      const eventDate = new Date(eventDateStr);
      const isFuture = eventDate > now;
      console.log(
        `Event: ${e.title} | Status: ${e.status} | Date: ${e.event_datetime} | Future: ${isFuture}`,
      );
      return isFuture;
    });

    const mappedEvents = futureEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.event_datetime,
      isSoldOut: e.available_tickets === 0,
      time: new Date(e.event_datetime.replace(" ", "T")).toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      ),
      venue: e.venue,
      location: e.venue,
      ticketPrice: e.ticket_price,
      totalCapacity: e.total_tickets,
      availableTickets: e.available_tickets,
      poster: e.poster_url || "/default-event.jpg",
      category: "Live Event",
    }));

    setEvents(mappedEvents);
    console.log("Final displayed events:", mappedEvents);
  };
  const fetchData = async () => {
    await fetchEvents();

    const { data: ticketsData, error: ticketsError } = await supabase
      .from("tickets")
      .select("*, events(*)")
      .eq("is_for_resale", true)
      .eq("status", "active")
      .order("listed_at", { ascending: false });

    if (ticketsError || !ticketsData || ticketsData.length === 0) {
      setResaleTickets([]);
      return;
    }

    // FILTER: Only show resale tickets from "approved" events
    const approvedResaleTickets = ticketsData.filter(
      (ticket) => ticket.events?.status === "approved",
    );

    if (approvedResaleTickets.length === 0) {
      setResaleTickets([]);
      return;
    }

    // Owner names fetch
    const ownerIds = [...new Set(approvedResaleTickets.map((t) => t.owner_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);

    const nameMap = {};
    profilesData?.forEach((p) => {
      nameMap[p.id] = p.full_name || "Verified Seller";
    });

    // Grouping
    const groupedMap = approvedResaleTickets.reduce((acc, ticket) => {
      const key = `${ticket.event_id}-${ticket.owner_id}-${ticket.resale_price}`;
      if (!acc[key]) {
        acc[key] = {
          event: ticket.events,
          seller_name: nameMap[ticket.owner_id] || "Verified Seller",
          resale_price: ticket.resale_price,
          original_price: ticket.original_price,
          quantity: 0,
          sample_ticket_id: ticket.id,
        };
      }
      acc[key].quantity += 1;
      return acc;
    }, {});

    const groupedTickets = Object.values(groupedMap);
    setResaleTickets(groupedTickets);

    console.log("Resale tickets (only approved events):", groupedTickets);
  };
  const buyTicket = async (event) => {
    if (!user) {
      alert("Please login to buy ticket");
      return;
    }
    if (event.availableTickets <= 0) {
      alert("Tickets sold out!");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-checkout",
        {
          body: JSON.stringify({
            plan_id: "event_ticket",
            userId: user.id,
            event_id: event.id,
            event_title: event.title,
            ticket_price: event.ticketPrice,
            origin: window.location.origin,
            success_url: `${window.location.origin}/my-tickets?payment=success`,
            cancel_url: window.location.href,
            type: "event_ticket",
          }),
          headers: {
            "Content-Type": "application/json", // ← YEH ADD KAR DO
          },
        },
      );

      if (error) throw error;

      const sessionUrl = data.url || data.stripe_session_url;
      if (sessionUrl) {
        window.location.href = sessionUrl;
      } else {
        alert("No checkout URL received");
      }
    } catch (err) {
      console.error("Buy ticket error:", err);
      alert("Payment failed – please try again");
    }
  };
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data: userEvents } = await supabase
          .from("events")
          .select("id")
          .eq("created_by", currentUser.id)
          .in("status", ["approved", "sold_out"])
          .gt("event_datetime", new Date().toISOString());

        setHasEventsToScan(!!userEvents && userEvents.length > 0);
      }
    };

    getUser();
    fetchEvents();
  }, []);

  useEffect(() => {
    const checkIfBanned = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("banned")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Ban check error:", error);
        return;
      }

      if (profile?.banned) {
        setIsBanned(true);
        alert("Your account is permanently banned. You cannot create events.");
        navigate("/profile");
      }
    };

    checkIfBanned();
  }, [navigate]);

  useEffect(() => {
    fetchData(); // Bahar wala fetchData call karo

    const eventsChannel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          console.log("Event changed:", payload);
          fetchEvents(); // Har change pe refresh
        },
      )
      .subscribe();

    const channel = supabase
      .channel("resale-tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Realtime change:", payload);
          fetchData(); // Same function call
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(eventsChannel);
    };
  }, []);
  // Empty dependency – sirf mount pe
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

  const buyResaleTicket = async (ticket) => {
    if (!user) {
      alert("Login required");
      return;
    }

    // Safety check – agar event missing hai to error dikhao
    if (!ticket.event || !ticket.event.id) {
      alert("Event data missing – please refresh and try again");
      console.error("Invalid ticket data:", ticket);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-checkout",
        {
          body: JSON.stringify({
            plan_id: "event_ticket",
            userId: user.id,
            event_id: ticket.event.id,
            event_title: ticket.event.title,
            ticket_price: ticket.resale_price,
            origin: window.location.origin,
            resale_ticket_id: ticket.sample_ticket_id,
            type: "resale_ticket",
          }),
        },
      );

      if (error) {
        console.error("Stripe invoke error:", error);
        alert("Payment failed: " + (error.message || "Try again"));
        return;
      }

      if (data && data.url) {
        window.location.href = data.url;
      } else {
        alert("No checkout URL received");
      }
    } catch (err) {
      console.error("Unexpected error in buyResaleTicket:", err);
      alert("Something went wrong – please try again");
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
      {/* Ad Banner Section – now using real events */}
      <section className="ad-banner-section">
        <div className="ad-carousel">
          <button
            className="carousel-btn prev"
            onClick={() =>
              setCurrentAdIndex(
                (prev) => (prev - 1 + events.length) % events.length,
              )
            }
          >
            <ChevronLeft size={24} />
          </button>

          {events.length > 0 ? (
            <div className="ad-banner animate-fade-in" key={currentAdIndex}>
              <img
                src={events[currentAdIndex].poster}
                alt={events[currentAdIndex].title}
                className="ad-image"
              />
              <div className="ad-content">
                <h2 className="ad-title">{events[currentAdIndex].title}</h2>
                <p className="ad-sponsor">{events[currentAdIndex].venue}</p>
                <button
                  className="ad-btn"
                  onClick={() => handleViewDetails(events[currentAdIndex])}
                >
                  View Details
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No upcoming events</p>
          )}

          <button
            className="carousel-btn next"
            onClick={() =>
              setCurrentAdIndex((prev) => (prev + 1) % events.length)
            }
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="ad-indicators">
          {events.map((_, index) => (
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
        {!isBanned && (
          <button
            className="create-event-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} /> Create Event
          </button>
        )}

        {user && hasEventsToScan && (
          <button
            className="create-event-btn bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg"
            onClick={() => navigate("/scanner")}
          >
            <QrCode size={20} /> Scan Tickets
          </button>
        )}
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
        <div className="resale-header flex items-center justify-between">
          <div className="flex items-center gap-4">
            <RefreshCw className="resale-icon" />
            <div>
              <h2 className="resale-title">Ticket Resale Marketplace</h2>
              <p className="resale-subtitle">
                Find tickets from verified sellers
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold flex items-center gap-2"
          >
            <RefreshCw size={20} />
            Refresh List
          </button>
        </div>
        <div className="resale-grid">
          {resaleTickets.length === 0 ? (
            <p className="text-center text-gray-400 col-span-full">
              No tickets available for resale yet
            </p>
          ) : (
            resaleTickets.map((ticket, index) => {
              if (!ticket.event) {
                console.warn("Skipping invalid resale ticket:", ticket);
                return null;
              }

              return (
                <div key={index} className="resale-card hover-lift">
                  <div className="resale-info">
                    <h3 className="resale-event">{ticket.event.title}</h3>
                    <p className="resale-date">
                      {new Date(
                        ticket.event.event_datetime,
                      ).toLocaleDateString()}
                    </p>
                    <p className="resale-seller">
                      Sold by{" "}
                      <span className="font-semibold">
                        {ticket.seller_name}
                      </span>
                    </p>
                  </div>
                  <div className="resale-pricing">
                    <div className="original-price strike">
                      ${ticket.original_price}
                    </div>
                    <div className="resale-price">${ticket.resale_price}</div>
                    <div className="qty-available">
                      {ticket.quantity} available
                    </div>
                  </div>
                  <button
                    onClick={() => buyResaleTicket(ticket)}
                    className="resale-buy-btn"
                  >
                    <Ticket size={16} /> Buy Resale Ticket
                  </button>
                </div>
              );
            })
          )}
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
