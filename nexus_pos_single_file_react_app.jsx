import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/*
THE COLLECTIVE NEXUS POS (Single-File React)
- Stripe QR Pay mode (shows QR in-modal so staff keeps control)
- Card-paid timer start button
- Cash mode logs + starts timer
- Optional email capture
- Station locking (prevents double-booking)
- Countdown board + warnings
- Timers-only screen for a wall/monitor via ?view=timers
*/

const LOGO_URL = "https://i.imgur.com/FW7unv2.png";

const stripeLinks = {
  hour1: "https://buy.stripe.com/3cl00I68xa0E9pg5KvcjS00",
  hour2: "https://buy.stripe.com/6oUcN7fJ7q0EdFw6OzciS01",
  hour4: "https://buy.stripe.com/9B6fZjdAZ1u8bxoc8TcjS02",
  dropzone: "https://buy.stripe.com/8x25kF9kJ0q4dFwc8TcjS03",
  membership: "https://buy.stripe.com/eVq6oJaoNa0Ebxo3CncjS04",
};

// Imgur pages -> direct image URLs (reliable embedding)
const qrImages = {
  hour1: "https://i.imgur.com/p2Y7GLg.png",
  hour2: "https://i.imgur.com/oW0O71q.png",
  hour4: "https://i.imgur.com/6S3bNTd.png",
  dropzone: "https://i.imgur.com/YYbPyYS.png",
  membership: "https://i.imgur.com/Id16fm3.png",
};

const stationsList = [
  "PC1", "PC2", "PC3", "PC4", "PC5", "PC6", "PC7", "PC8",
  "Laptop1", "Laptop2", "Laptop3", "Laptop4", "Laptop5", "Laptop6", "Laptop7", "Laptop8",
  "Xbox", "PlayStation",
];

const passes = [
  { key: "hour1", name: "1 Hour Pass", price: 7, minutes: 60, link: stripeLinks.hour1, qr: qrImages.hour1 },
  { key: "hour2", name: "2 Hour Pass", price: 12, minutes: 120, link: stripeLinks.hour2, qr: qrImages.hour2 },
  { key: "hour4", name: "4 Hour Pass", price: 20, minutes: 240, link: stripeLinks.hour4, qr: qrImages.hour4 },
  { key: "dropzone", name: "Drop Zone", price: 13, minutes: 180, link: stripeLinks.dropzone, qr: qrImages.dropzone },
];

function fmtMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function NexusPOS() {
  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [station, setStation] = useState("");

  // sessions: {id, station, name, email?, endTs, passKey}
  const [sessions, setSessions] = useState([]);

  // cash total tracked locally (card totals in Stripe)
  const [cashTotal, setCashTotal] = useState(0);

  // Drop Zone toggle (default off)
  const [showDropZone, setShowDropZone] = useState(false);

  // QR modal
  const [qrOpen, setQrOpen] = useState(false);
  const [qrItem, setQrItem] = useState(null);

  // tick to update countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const timersOnly = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "timers";
  }, []);

  const timersUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    u.searchParams.set("view", "timers");
    return u.toString();
  }, []);

  const activeSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.endTs > now)
      .sort((a, b) => a.endTs - b.endTs);
  }, [sessions]);

  const visiblePasses = useMemo(() => {
    return passes.filter((p) => (p.key === "dropzone" ? showDropZone : true));
  }, [showDropZone]);

  function openStripe(link) {
    const w = window.open(link, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = link;
  }

  function showQR(item) {
    setQrItem(item);
    setQrOpen(true);
  }

  function stationInUse(st) {
    const now = Date.now();
    return sessions.some((s) => s.station === st && s.endTs > now);
  }

  function addSession(item) {
    const endTs = Date.now() + item.minutes * 60000;
    setSessions((prev) => [
      {
        id: crypto.randomUUID(),
        station,
        name: playerName.trim(),
        email: playerEmail.trim() || "",
        endTs,
        passKey: item.key,
      },
      ...prev,
    ]);
    setPlayerName("");
    setPlayerEmail("");
    setStation("");
  }

  function startCashSession(item) {
    if (!playerName.trim() || !station) {
      alert("Enter player name and choose a station.");
      return;
    }
    if (stationInUse(station)) {
      alert(`${station} is already in use. Choose another station.`);
      return;
    }
    addSession(item);
    setCashTotal((x) => x + item.price);
  }

  function startCardSession(item) {
    if (!playerName.trim() || !station) {
      alert("Enter player name and choose a station. Then start timer once paid.");
      return;
    }
    if (stationInUse(station)) {
      alert(`${station} is already in use. Choose another station.`);
      return;
    }
    addSession(item);
    // Card revenue tracked in Stripe, so we don't add to cash total.
  }

  function endSession(id) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, endTs: Date.now() } : s)));
  }

  // --- Timers-only screen ---
  if (timersOnly) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} className="h-12" alt="The Collective Nexus" />
              <div>
                <h1 className="text-2xl font-bold">Station Timers</h1>
                <p className="text-slate-400 text-sm">THE COLLECTIVE NEXUS • Powered by Streamtek</p>
              </div>
            </div>
            <div className="text-xs text-slate-400">Auto-refresh every 5 seconds</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeSessions.length === 0 ? (
              <div className="text-slate-400">No active sessions</div>
            ) : (
              activeSessions.map((s) => {
                const mins = Math.max(0, Math.floor((s.endTs - Date.now()) / 60000));
                const color = mins <= 0 ? "bg-red-700" : mins <= 10 ? "bg-amber-600" : "bg-slate-800";
                return (
                  <div key={s.id} className={`${color} border border-white/10 p-4 rounded-xl`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-lg">{s.station}</div>
                      <div className="text-xs text-white/80">{mins <= 10 ? "Ending" : "Active"}</div>
                    </div>
                    <div className="mt-2 text-base">{s.name}</div>
                    <div className="mt-2 text-3xl font-bold">{mins}m</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">Green = active • Yellow = ≤10 min • Red = expired</div>
        </div>
      </div>
    );
  }

  // --- Full POS ---
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* QR Modal */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{qrItem ? `${qrItem.name} — ${fmtMoney(qrItem.price)}` : "Scan to Pay"}</DialogTitle>
          </DialogHeader>

          {qrItem ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-white p-4">
                <img src={qrItem.qr} alt={`${qrItem.name} QR`} className="mx-auto h-72 w-72 object-contain" />
              </div>

              <div className="text-sm text-slate-200">
                <p className="font-semibold">Instructions</p>
                <ol className="list-decimal pl-5 mt-1 space-y-1 text-slate-300">
                  <li>Customer scans QR with phone camera</li>
                  <li>Customer completes Stripe checkout</li>
                  <li>Click <b>Start Timer (Card Paid)</b> when they show receipt</li>
                </ol>
              </div>

              <div className="grid gap-2">
                <Button className="w-full" onClick={() => openStripe(qrItem.link)}>Open Checkout (Backup)</Button>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    startCardSession(qrItem);
                    setQrOpen(false);
                  }}
                >
                  Start Timer (Card Paid)
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setQrOpen(false)}>Close</Button>
              </div>

              <div className="text-xs text-slate-500">
                Tip: Fill Player + Station first, then open the QR.
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="text-center mb-6 space-y-1">
        <img src={LOGO_URL} className="h-20 mx-auto mb-2" alt="The Collective Nexus" />
        <h1 className="text-3xl font-bold">THE COLLECTIVE NEXUS POS</h1>
        <p className="text-slate-400">Powered by Streamtek</p>
        <div className="mt-2">
          <Button variant="outline" onClick={() => window.open(timersUrl, "_blank", "noopener,noreferrer")}>Open Timers Screen (Monitor)</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pass Menu */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl">Passes</h2>
            <label className="text-xs text-slate-300 flex items-center gap-2">
              <input type="checkbox" checked={showDropZone} onChange={(e) => setShowDropZone(e.target.checked)} />
              Drop Zone Mode
            </label>
          </div>

          {visiblePasses.map((p) => (
            <Card key={p.key} className="mb-3 bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-slate-300 text-sm">{fmtMoney(p.price)} • {p.minutes} min</p>
                </div>

                <Button className="w-full" onClick={() => showQR(p)}>
                  Card (Show QR)
                </Button>

                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => startCashSession(p)}>
                  Cash (Start Timer)
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-purple-900 border-purple-800">
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Nexus Unlimited Membership</h3>
              <p className="text-slate-200 text-sm">{fmtMoney(50)} / month</p>
              <Button className="w-full" onClick={() => showQR({ key: "membership", name: "Nexus Unlimited Membership", price: 50, minutes: 0, link: stripeLinks.membership, qr: qrImages.membership })}>
                Card (Show QR)
              </Button>
              <Button variant="outline" className="w-full" onClick={() => openStripe(stripeLinks.membership)}>
                Open Subscription Checkout
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-black mt-6 border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Cash Today (logged)</p>
              <p className="text-2xl font-bold">{fmtMoney(cashTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">Card totals are in Stripe Dashboard.</p>
            </CardContent>
          </Card>
        </div>

        {/* Check-In */}
        <div>
          <h2 className="text-xl mb-4">Player Check-In</h2>

          <Input
            placeholder="Player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="mb-2 text-black bg-white"
          />

          <Input
            placeholder="Email (optional)"
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
            className="mb-2 text-black bg-white"
          />

          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="w-full p-2 text-black rounded mb-4"
          >
            <option value="">Select station</option>
            {stationsList.map((s) => (
              <option key={s} value={s}>
                {s}{stationInUse(s) ? " (IN USE)" : ""}
              </option>
            ))}
          </select>

          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-semibold text-white">Front Desk Flow</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Enter player + email (optional) + choose station</li>
              <li>Card: click <b>Card (Show QR)</b> so customer pays on phone</li>
              <li>When receipt is shown, click <b>Start Timer (Card Paid)</b> inside QR popup</li>
              <li>Cash: click <b>Cash (Start Timer)</b> to begin session</li>
            </ol>
          </div>

          <p className="mt-3 text-xs text-slate-500">Emails are stored locally on this device (not sent automatically).</p>
        </div>

        {/* Station Board */}
        <div>
          <h2 className="text-xl mb-4">Station Board</h2>

          {activeSessions.length === 0 ? (
            <div className="text-slate-400 text-sm">No active sessions yet.</div>
          ) : (
            activeSessions.map((s) => {
              const mins = Math.max(0, Math.floor((s.endTs - Date.now()) / 60000));
              const color = mins <= 0 ? "bg-red-700" : mins <= 10 ? "bg-amber-600" : "bg-slate-800";

              return (
                <div key={s.id} className={`${color} border border-white/10 p-3 rounded mb-2`}>
                  <div className="flex items-center justify-between">
                    <strong>{s.station}</strong>
                    <span className="text-xs text-white/80">{mins <= 10 ? "Ending soon" : "Active"}</span>
                  </div>
                  <p className="text-white">{s.name}</p>
                  <p className="font-semibold">{mins} min left</p>
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => endSession(s.id)}>
                    End Session
                  </Button>
                </div>
              );
            })
          )}

          <div className="text-xs text-slate-500 mt-3">Green = active • Yellow = ≤10 min • Red = expired</div>
        </div>
      </div>
    </div>
  );
}
