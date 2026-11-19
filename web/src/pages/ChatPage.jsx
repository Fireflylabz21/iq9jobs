import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Clock, CheckCircle, UserRound, MessageCircle, X } from "lucide-react";
import { useRole, ROLES } from "../context/RoleContext.jsx";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../backend.js";

const TIME_SLOTS = [
  "Today 10:00 AM", "Today 11:30 AM", "Today 2:00 PM", "Today 3:30 PM",
  "Tomorrow 10:00 AM", "Tomorrow 2:00 PM", "Tomorrow 4:00 PM",
];

export default function ChatPage({ user, otherUserId, jobTitle, onBack }) {
  const { role, user: currentUser } = useRole();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef(null);

  // Derive a deterministic chat room id from the two users
  const roomId = [currentUser.uid, otherUserId].sort().join("_");

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "chat_rooms", roomId, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!input.trim() || !db) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "chat_rooms", roomId, "messages"), {
        senderId: currentUser.uid,
        senderEmail: currentUser.email || "",
        text: input.trim(),
        createdAt: serverTimestamp(),
      });
      setInput("");
    } catch (err) {
      alert(err.message || "Could not send message.");
    } finally {
      setBusy(false);
    }
  };

  const bookSlot = async (slot) => {
    if (!db) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "meetings", crypto.randomUUID()), {
        roomId,
        jobTitle,
        candidateId: role === ROLES.SEEKER ? currentUser.uid : otherUserId,
        recruiterId: role === ROLES.RECRUITER ? currentUser.uid : otherUserId,
        slot,
        status: "BOOKED",
        createdAt: serverTimestamp(),
      });
      setSelectedSlot(slot);
      setBooking(false);
    } catch (err) {
      alert(err.message || "Could not book the slot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="recruiter-page chat-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><MessageCircle size={14} /> DIRECT MESSAGING</div>
          <h1>Conversation</h1>
          <p>{jobTitle}</p>
        </div>
      </div>

      <div className="chat-wrap">
        <div className="chat-messages" ref={messagesEndRef}>
          {messages.map((msg) => {
            const mine = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`chat-bubble ${mine ? "chat-mine" : "chat-theirs"}`}>
                <div className="chat-text">{msg.text}</div>
                <div className="chat-meta">
                  {mine ? "You" : "Other"} · {new Date(msg.createdAt?.toDate ? msg.createdAt.toDate() : msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })}
          {selectedSlot && (
            <div className="chat-bubble chat-system">
              <div className="chat-text">Meeting booked: {selectedSlot}</div>
              <div className="chat-meta"><CheckCircle size={12} /> Confirmed</div>
            </div>
          )}
        </div>
        <div className="chat-input">
          <form onSubmit={sendMessage} className="chat-form">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={busy}
            />
            <button className="button button-primary" type="submit" disabled={busy || !input.trim()}><Send size={16} /></button>
          </form>
        </div>
      </div>

      {!booking && (
        <div className="chat-schedule">
          <button className="button button-secondary" onClick={() => setBooking(true)}><Clock size={16} /> Propose meeting time</button>
        </div>
      )}

      {booking && (
        <div className="modal-backdrop" onClick={() => setBooking(false)}>
          <div className="details-modal">
            <div className="modal-top">
              <span className="eyebrow">SCHEDULE MEETING</span>
              <button className="icon-button" onClick={() => setBooking(false)}><X size={19} /></button>
            </div>
            <p>Pick a time slot. The other party will be notified and the meeting is booked.</p>
            <div className="skills-inputs" style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  className={`button button-secondary ${selectedSlot === slot ? "button-primary" : ""}`}
                  onClick={() => setSelectedSlot(slot)}
                  disabled={busy}
                >
                  {slot}
                </button>
              ))}
            </div>
            <div className="settings-actions" style={{ marginTop: 18 }}>
              <button className="button button-secondary" onClick={() => setBooking(false)}>Cancel</button>
              <button className="button button-primary" onClick={() => bookSlot(selectedSlot)} disabled={busy || !selectedSlot}>
                Book meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
);
