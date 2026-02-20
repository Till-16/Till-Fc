"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const FIELD_W = 800;
const FIELD_H = 500;
const PLAYER_R = 18;
const BALL_R = 10;
const GOAL_W = 12;
const GOAL_H = 100;
const PLAYER_SPEED = 3.5;
const BALL_FRICTION = 0.985;
const CARRY_DIST = PLAYER_R + BALL_R + 2;

interface Vec { x: number; y: number }
interface Player { pos: Vec; vel: Vec; team: number; hasBall: boolean }
interface Ball { pos: Vec; vel: Vec }
interface GameState {
  players: Player[];
  ball: Ball;
  score: [number, number];
  msg: string;
  msgTimer: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function norm(v: Vec): Vec {
  const d = Math.hypot(v.x, v.y);
  return d === 0 ? { x: 0, y: 0 } : { x: v.x / d, y: v.y / d };
}

const INIT_STATE = (): GameState => ({
  players: [
    { pos: { x: 200, y: FIELD_H / 2 }, vel: { x: 0, y: 0 }, team: 0, hasBall: false },
    { pos: { x: 600, y: FIELD_H / 2 }, vel: { x: 0, y: 0 }, team: 1, hasBall: false },
  ],
  ball: { pos: { x: FIELD_W / 2, y: FIELD_H / 2 }, vel: { x: 0, y: 0 } },
  score: [0, 0],
  msg: "",
  msgTimer: 0,
});

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(INIT_STATE());
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [msg, setMsg] = useState("");

  const resetPositions = useCallback((scoringTeam?: number) => {
    const s = stateRef.current;
    s.players[0].pos = { x: 200, y: FIELD_H / 2 };
    s.players[0].vel = { x: 0, y: 0 };
    s.players[0].hasBall = false;
    s.players[1].pos = { x: 600, y: FIELD_H / 2 };
    s.players[1].vel = { x: 0, y: 0 };
    s.players[1].hasBall = false;
    s.ball.pos = { x: FIELD_W / 2, y: FIELD_H / 2 };
    s.ball.vel = { x: scoringTeam === 0 ? -1.5 : 1.5, y: 0 };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.type === "keydown") keysRef.current.add(e.key.toLowerCase());
      else keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const update = () => {
      const s = stateRef.current;
      const keys = keysRef.current;
      const p0 = s.players[0];
      const p1 = s.players[1];
      const ball = s.ball;

      // --- Player 0 controls: WASD + F to shoot ---
      const acc0: Vec = { x: 0, y: 0 };
      if (keys.has("w")) acc0.y -= 1;
      if (keys.has("s")) acc0.y += 1;
      if (keys.has("a")) acc0.x -= 1;
      if (keys.has("d")) acc0.x += 1;
      const n0 = norm(acc0);
      p0.vel.x = n0.x * PLAYER_SPEED;
      p0.vel.y = n0.y * PLAYER_SPEED;

      // --- Player 1 controls: Arrow keys + Enter to shoot ---
      const acc1: Vec = { x: 0, y: 0 };
      if (keys.has("arrowup")) acc1.y -= 1;
      if (keys.has("arrowdown")) acc1.y += 1;
      if (keys.has("arrowleft")) acc1.x -= 1;
      if (keys.has("arrowright")) acc1.x += 1;
      const n1 = norm(acc1);
      p1.vel.x = n1.x * PLAYER_SPEED;
      p1.vel.y = n1.y * PLAYER_SPEED;

      // Move players
      for (const p of s.players) {
        p.pos.x = clamp(p.pos.x + p.vel.x, PLAYER_R, FIELD_W - PLAYER_R);
        p.pos.y = clamp(p.pos.y + p.vel.y, PLAYER_R, FIELD_H - PLAYER_R);
      }

      // --- Ball possession logic ---
      // Check who is closest to ball
      const d0 = dist(p0.pos, ball.pos);
      const d1 = dist(p1.pos, ball.pos);

      // Shoot: F for p0, Enter for p1
      const shoot0 = keys.has("f");
      const shoot1 = keys.has("enter");

      if (p0.hasBall) {
        if (shoot0) {
          // Shoot in direction player is moving, or forward if idle
          const dir = norm(p0.vel.x !== 0 || p0.vel.y !== 0 ? p0.vel : { x: 1, y: 0 });
          ball.vel.x = dir.x * 9;
          ball.vel.y = dir.y * 9;
          p0.hasBall = false;
        } else {
          // Ball sticks to player
          const dir = norm(p0.vel.x !== 0 || p0.vel.y !== 0 ? p0.vel : { x: 1, y: 0 });
          ball.pos.x = p0.pos.x + dir.x * CARRY_DIST;
          ball.pos.y = p0.pos.y + dir.y * CARRY_DIST;
          ball.vel = { x: 0, y: 0 };
          // Tackle: p1 close enough takes ball
          if (d1 < PLAYER_R * 2.2) {
            p0.hasBall = false;
            p1.hasBall = true;
          }
        }
      } else if (p1.hasBall) {
        if (shoot1) {
          const dir = norm(p1.vel.x !== 0 || p1.vel.y !== 0 ? p1.vel : { x: -1, y: 0 });
          ball.vel.x = dir.x * 9;
          ball.vel.y = dir.y * 9;
          p1.hasBall = false;
        } else {
          const dir = norm(p1.vel.x !== 0 || p1.vel.y !== 0 ? p1.vel : { x: -1, y: 0 });
          ball.pos.x = p1.pos.x + dir.x * CARRY_DIST;
          ball.pos.y = p1.pos.y + dir.y * CARRY_DIST;
          ball.vel = { x: 0, y: 0 };
          if (d0 < PLAYER_R * 2.2) {
            p1.hasBall = false;
            p0.hasBall = true;
          }
        }
      } else {
        // Free ball - check pickup
        if (d0 < CARRY_DIST + 4) {
          p0.hasBall = true;
        } else if (d1 < CARRY_DIST + 4) {
          p1.hasBall = true;
        } else {
          // Move ball freely
          ball.pos.x += ball.vel.x;
          ball.pos.y += ball.vel.y;
          ball.vel.x *= BALL_FRICTION;
          ball.vel.y *= BALL_FRICTION;

          // Wall bounce - top/bottom
          if (ball.pos.y - BALL_R < 0) {
            ball.pos.y = BALL_R + 1;
            ball.vel.y = Math.abs(ball.vel.y) * 0.7;
          }
          if (ball.pos.y + BALL_R > FIELD_H) {
            ball.pos.y = FIELD_H - BALL_R - 1;
            ball.vel.y = -Math.abs(ball.vel.y) * 0.7;
          }

          const goalTop = FIELD_H / 2 - GOAL_H / 2;
          const goalBot = FIELD_H / 2 + GOAL_H / 2;
          const inGoalZone = ball.pos.y > goalTop && ball.pos.y < goalBot;

          // Left wall / goal
          if (ball.pos.x - BALL_R < GOAL_W) {
            if (inGoalZone) {
              // GOAL for team 1
              s.score[1]++;
              setScore([...s.score] as [number, number]);
              setMsg("⚽ TOR! Rotes Team!");
              s.msgTimer = 120;
              resetPositions(1);
              return;
            } else {
              ball.pos.x = GOAL_W + BALL_R + 1;
              ball.vel.x = Math.abs(ball.vel.x) * 0.7;
            }
          }
          // Right wall / goal
          if (ball.pos.x + BALL_R > FIELD_W - GOAL_W) {
            if (inGoalZone) {
              // GOAL for team 0
              s.score[0]++;
              setScore([...s.score] as [number, number]);
              setMsg("⚽ TOR! Blaues Team!");
              s.msgTimer = 120;
              resetPositions(0);
              return;
            } else {
              ball.pos.x = FIELD_W - GOAL_W - BALL_R - 1;
              ball.vel.x = -Math.abs(ball.vel.x) * 0.7;
            }
          }

          // Corner unstick: if ball barely moving near wall, give it a nudge
          if (Math.abs(ball.vel.x) < 0.15 && Math.abs(ball.vel.y) < 0.15) {
            const margin = BALL_R + 2;
            if (ball.pos.x < margin) ball.vel.x = 1.5;
            if (ball.pos.x > FIELD_W - margin) ball.vel.x = -1.5;
            if (ball.pos.y < margin) ball.vel.y = 1.5;
            if (ball.pos.y > FIELD_H - margin) ball.vel.y = -1.5;
          }
        }
      }

      // Message timer
      if (s.msgTimer > 0) {
        s.msgTimer--;
        if (s.msgTimer === 0) setMsg("");
      }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, p: Player, hasBall: boolean) => {
      const x = p.pos.x;
      const y = p.pos.y;
      const color = p.team === 0 ? "#3b82f6" : "#ef4444";
      const shade = p.team === 0 ? "#1d4ed8" : "#b91c1c";
      const skin = "#f5c89a";

      // Shadow
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(x, y + PLAYER_R + 3, PLAYER_R * 0.9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Legs
      ctx.fillStyle = shade;
      ctx.fillRect(x - 8, y + 6, 6, 14);
      ctx.fillRect(x + 2, y + 6, 6, 14);

      // Shoes
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x - 9, y + 18, 8, 5);
      ctx.fillRect(x + 1, y + 18, 8, 5);

      // Body / jersey
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - 11, y - 8, 22, 18, 4);
      ctx.fill();

      // Jersey number
      ctx.fillStyle = "white";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.team === 0 ? "7" : "9", x, y + 1);

      // Head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(x, y - 14, 10, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = p.team === 0 ? "#92400e" : "#1a1a1a";
      ctx.beginPath();
      ctx.arc(x, y - 16, 10, Math.PI, 0);
      ctx.fill();

      // Eyes
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(x - 3, y - 13, 1.5, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 13, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Ball indicator
      if (hasBall) {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_R + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const draw = () => {
      const s = stateRef.current;
      const W = FIELD_W;
      const H = FIELD_H;

      // Background - stadium feel
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, 0, W, H);

      // Grass stripes
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(0,0,0,0.07)";
          ctx.fillRect(i * (W / 8), 0, W / 8, H);
        }
      }

      // Field lines
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;

      // Border
      ctx.strokeRect(GOAL_W, 0, W - GOAL_W * 2, H);

      // Center line
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fill();

      // Goals
      const goalTop = H / 2 - GOAL_H / 2;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(0, goalTop, GOAL_W, GOAL_H);
      ctx.fillRect(W - GOAL_W, goalTop, GOAL_W, GOAL_H);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, goalTop, GOAL_W, GOAL_H);
      ctx.strokeRect(W - GOAL_W, goalTop, GOAL_W, GOAL_H);

      // Penalty boxes
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(GOAL_W, H / 2 - 80, 60, 160);
      ctx.strokeRect(W - GOAL_W - 60, H / 2 - 80, 60, 160);

      // Players
      for (const p of s.players) {
        drawPlayer(ctx, p, p.hasBall);
      }

      // Ball
      const bx = s.ball.pos.x;
      const by = s.ball.pos.y;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Ball pattern
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(bx - 3, by - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + 4, by - 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = () => {
      update();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [resetPositions]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      gap: 16,
    }}>
      {/* Scoreboard */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        background: "#1e293b",
        borderRadius: 12,
        padding: "12px 32px",
        border: "2px solid #334155",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#3b82f6", fontWeight: "bold", fontSize: 13 }}>WASD + F</div>
          <div style={{ color: "#3b82f6", fontSize: 36, fontWeight: "bold" }}>{score[0]}</div>
        </div>
        <div style={{ color: "#64748b", fontSize: 24 }}>:</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: 13 }}>↑↓←→ + Enter</div>
          <div style={{ color: "#ef4444", fontSize: 36, fontWeight: "bold" }}>{score[1]}</div>
        </div>
      </div>

      {/* Goal message */}
      {msg && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,0.85)",
          color: "#facc15",
          fontSize: 40,
          fontWeight: "bold",
          padding: "20px 40px",
          borderRadius: 16,
          border: "3px solid #facc15",
          zIndex: 10,
          pointerEvents: "none",
        }}>
          {msg}
        </div>
      )}

      {/* Canvas */}
      <div style={{ borderRadius: 12, overflow: "hidden", border: "3px solid #334155", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} />
      </div>

      <div style={{ color: "#475569", fontSize: 12, textAlign: "center" }}>
        🔵 Blau: WASD bewegen · F schießen &nbsp;|&nbsp; 🔴 Rot: Pfeiltasten · Enter schießen
      </div>
    </div>
  );
}