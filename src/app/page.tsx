"use client";
import { useEffect, useRef, useState } from "react";

const FIELD_W = 800;
const FIELD_H = 500;
const PLAYER_R = 15;
const BALL_R = 10;
const GOAL_H = 120;
const SPEED = 3;

type Vec = { x: number; y: number };
type Player = { pos: Vec; vel: Vec; team: number; id: number };

function initState() {
  return {
    players: [
      { pos: { x: 200, y: 200 }, vel: { x: 0, y: 0 }, team: 0, id: 0 },
      { pos: { x: 200, y: 300 }, vel: { x: 0, y: 0 }, team: 0, id: 1 },
      { pos: { x: 600, y: 200 }, vel: { x: 0, y: 0 }, team: 1, id: 2 },
      { pos: { x: 600, y: 300 }, vel: { x: 0, y: 0 }, team: 1, id: 3 },
    ] as Player[],
    ball: { pos: { x: FIELD_W / 2, y: FIELD_H / 2 }, vel: { x: 0, y: 0 } },
    score: [0, 0],
    selected: 0,
  };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(initState());
  const keysRef = useRef<Set<string>>(new Set());
  const [score, setScore] = useState([0, 0]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      down ? keysRef.current.add(e.key) : keysRef.current.delete(e.key);
      // Switch player with Tab
      if (down && e.key === "Tab") {
        e.preventDefault();
        const s = stateRef.current;
        const team0 = s.players.filter(p => p.team === 0);
        const cur = team0.findIndex(p => p.id === s.selected);
        s.selected = team0[(cur + 1) % team0.length].id;
      }
    };
    window.addEventListener("keydown", e => onKey(e, true));
    window.addEventListener("keyup", e => onKey(e, false));

    let animId: number;
    const loop = () => {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", e => onKey(e, true));
      window.removeEventListener("keyup", e => onKey(e, false));
    };
  }, []);

  function update() {
    const s = stateRef.current;
    const keys = keysRef.current;

    // Move selected player (WASD)
    const p = s.players.find(p => p.id === s.selected)!;
    p.vel = { x: 0, y: 0 };
    if (keys.has("w") || keys.has("W")) p.vel.y = -SPEED;
    if (keys.has("s") || keys.has("S")) p.vel.y = SPEED;
    if (keys.has("a") || keys.has("A")) p.vel.x = -SPEED;
    if (keys.has("d") || keys.has("D")) p.vel.x = SPEED;

    // Simple AI for team 1
    s.players.filter(pl => pl.team === 1).forEach(ai => {
      const ball = s.ball.pos;
      const dx = ball.x - ai.pos.x;
      const dy = ball.y - ai.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        ai.vel.x = (dx / dist) * (SPEED * 0.8);
        ai.vel.y = (dy / dist) * (SPEED * 0.8);
      }
    });

    // Move all players
    s.players.forEach(pl => {
      pl.pos.x = Math.max(PLAYER_R, Math.min(FIELD_W - PLAYER_R, pl.pos.x + pl.vel.x));
      pl.pos.y = Math.max(PLAYER_R, Math.min(FIELD_H - PLAYER_R, pl.pos.y + pl.vel.y));
    });

    // Ball physics
    s.ball.vel.x *= 0.97;
    s.ball.vel.y *= 0.97;
    s.ball.pos.x += s.ball.vel.x;
    s.ball.pos.y += s.ball.vel.y;

    // Ball wall bounce
    if (s.ball.pos.x < BALL_R) { s.ball.pos.x = BALL_R; s.ball.vel.x *= -1; }
    if (s.ball.pos.x > FIELD_W - BALL_R) { s.ball.pos.x = FIELD_W - BALL_R; s.ball.vel.x *= -1; }
    if (s.ball.pos.y < BALL_R) { s.ball.pos.y = BALL_R; s.ball.vel.y *= -1; }
    if (s.ball.pos.y > FIELD_H - BALL_R) { s.ball.pos.y = FIELD_H - BALL_R; s.ball.vel.y *= -1; }

    // Player-ball collision
    s.players.forEach(pl => {
      const dx = s.ball.pos.x - pl.pos.x;
      const dy = s.ball.pos.y - pl.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PLAYER_R + BALL_R) {
        const nx = dx / dist;
        const ny = dy / dist;
        s.ball.vel.x = nx * 6;
        s.ball.vel.y = ny * 6;
        s.ball.pos.x = pl.pos.x + nx * (PLAYER_R + BALL_R + 1);
        s.ball.pos.y = pl.pos.y + ny * (PLAYER_R + BALL_R + 1);
      }
    });

    // Goal check
    const goalTop = (FIELD_H - GOAL_H) / 2;
    const goalBot = goalTop + GOAL_H;
    if (s.ball.pos.x < BALL_R + 10 && s.ball.pos.y > goalTop && s.ball.pos.y < goalBot) {
      s.score[1]++;
      setScore([...s.score]);
      setMsg("⚽ Tor für Rot!");
      setTimeout(() => setMsg(""), 2000);
      Object.assign(stateRef.current, { ...initState(), score: s.score });
    }
    if (s.ball.pos.x > FIELD_W - BALL_R - 10 && s.ball.pos.y > goalTop && s.ball.pos.y < goalBot) {
      s.score[0]++;
      setScore([...s.score]);
      setMsg("⚽ Tor für Blau!");
      setTimeout(() => setMsg(""), 2000);
      Object.assign(stateRef.current, { ...initState(), score: s.score });
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    // Field
    ctx.fillStyle = "#2d7a2d";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    // Lines
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, FIELD_W - 4, FIELD_H - 4);
    ctx.beginPath();
    ctx.moveTo(FIELD_W / 2, 0);
    ctx.lineTo(FIELD_W / 2, FIELD_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD_W / 2, FIELD_H / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Goals
    const goalTop = (FIELD_H - GOAL_H) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(0, goalTop, 15, GOAL_H);
    ctx.fillRect(FIELD_W - 15, goalTop, 15, GOAL_H);
    ctx.strokeStyle = "white";
    ctx.strokeRect(0, goalTop, 15, GOAL_H);
    ctx.strokeRect(FIELD_W - 15, goalTop, 15, GOAL_H);

    // Players
    s.players.forEach(pl => {
      ctx.beginPath();
      ctx.arc(pl.pos.x, pl.pos.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fillStyle = pl.team === 0 ? "#3a7bd5" : "#e53935";
      ctx.fill();
      ctx.strokeStyle = pl.id === s.selected ? "yellow" : "white";
      ctx.lineWidth = pl.id === s.selected ? 3 : 1.5;
      ctx.stroke();
    });

    // Ball
    ctx.beginPath();
    ctx.arc(s.ball.pos.x, s.ball.pos.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1a1a2e" }}>
      <h1 style={{ color: "white", marginBottom: 10, fontSize: "2rem" }}>⚽ Till-FC</h1>
      <div style={{ color: "white", fontSize: "1.5rem", marginBottom: 8 }}>
        🔵 {score[0]} : {score[1]} 🔴
      </div>
      {msg && <div style={{ color: "yellow", fontSize: "1.3rem", marginBottom: 8 }}>{msg}</div>}
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} style={{ border: "3px solid white", borderRadius: 8 }} />
      <div style={{ color: "#aaa", marginTop: 10, fontSize: "0.9rem" }}>
        WASD = Spieler bewegen &nbsp;|&nbsp; TAB = Spieler wechseln &nbsp;|&nbsp; Du spielst Blau 🔵
      </div>
    </main>
  );
}