"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const INK = "#0F1F17";
const GOLD = "#C89B3C";
const WHEAT = "#F6F1E4";
const STONE = "#E4DFCF";
const TEXT = "#1C2620";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = "/";
  };

  const loginConGoogle = async () => {
    setLoadingGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoadingGoogle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
        .sa-brand-panel { display: flex; }
        .sa-input:focus { outline: none; border-color: ${GOLD} !important; box-shadow: 0 0 0 3px rgba(200,155,60,0.18); }
        .sa-btn-primary:hover { background: #17301F !important; }
        .sa-btn-google:hover { background: #FAFAF7 !important; border-color: #C9C3AF !important; }
        .sa-eye:hover { opacity: 1 !important; }
        @media (max-width: 860px) {
          .sa-brand-panel { display: none !important; }
          .sa-form-panel { flex: 1 1 100% !important; }
        }
      `}</style>

      {/* PANEL IZQUIERDO — MARCA */}
      <div
        className="sa-brand-panel"
        style={{
          flex: "0 0 44%",
          background: INK,
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 48px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: GOLD }} />
            <span style={{ color: WHEAT, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.75 }}>
              El Encuentro MSA
            </span>
          </div>
        </div>

        {/* Ilustración de campo — surcos convergiendo hacia el horizonte */}
        <svg
          viewBox="0 0 480 480"
          style={{ position: "absolute", left: "-40px", right: 0, bottom: "-30px", width: "115%", height: "auto", zIndex: 1 }}
        >
          <line x1="240" y1="230" x2="-60" y2="500" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="240" y1="230" x2="60" y2="520" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="240" y1="230" x2="180" y2="540" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="240" y1="230" x2="300" y2="540" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="240" y1="230" x2="420" y2="520" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="240" y1="230" x2="540" y2="500" stroke={GOLD} strokeWidth="1" opacity="0.55" />
          <line x1="10" y1="330" x2="470" y2="330" stroke={GOLD} strokeWidth="0.5" opacity="0.28" />
          <line x1="-30" y1="400" x2="510" y2="400" stroke={GOLD} strokeWidth="0.5" opacity="0.28" />
          <line x1="-60" y1="470" x2="540" y2="470" stroke={GOLD} strokeWidth="0.5" opacity="0.28" />
          <circle cx="240" cy="230" r="3" fill={GOLD} opacity="0.9" />
        </svg>

        <div style={{ position: "relative", zIndex: 2 }}>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.15,
              color: WHEAT,
              margin: "0 0 16px",
            }}
          >
            Sistema Agro
          </h1>
          <p style={{ color: WHEAT, opacity: 0.65, fontSize: 15, lineHeight: 1.6, maxWidth: 340, margin: 0 }}>
            Lotes, labores, gastos y márgenes de campaña — todo en un mismo lugar.
          </p>
        </div>
      </div>

      {/* PANEL DERECHO — FORMULARIO */}
      <div
        className="sa-form-panel"
        style={{
          flex: "1 1 56%",
          background: WHEAT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, color: TEXT, margin: "0 0 6px" }}>
            Iniciar sesión
          </h2>
          <p style={{ color: "#6B6555", fontSize: 14, margin: "0 0 28px" }}>
            Ingresá con tu cuenta para continuar.
          </p>

          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6555", letterSpacing: 0.4 }}>EMAIL</label>
          <input
            className="sa-input"
            type="email"
            placeholder="nombre@elencuentro.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", padding: "11px 14px", marginTop: 6, marginBottom: 16,
              borderRadius: 8, border: `1px solid ${STONE}`, fontSize: 14,
              boxSizing: "border-box", background: "white", color: TEXT,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6555", letterSpacing: 0.4 }}>CONTRASEÑA</label>
          <div style={{ position: "relative", marginTop: 6, marginBottom: 8 }}>
            <input
              className="sa-input"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%", padding: "11px 44px 11px 14px",
                borderRadius: 8, border: `1px solid ${STONE}`, fontSize: 14,
                boxSizing: "border-box", background: "white", color: TEXT,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            <button
              type="button"
              className="sa-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: 12,
                color: "#8A8371", opacity: 0.7, padding: 4,
              }}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          {error && (
            <div style={{ background: "#FBEAE7", border: "1px solid #F0C4BC", color: "#9A3B2B", fontSize: 13, padding: "9px 12px", borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            className="sa-btn-primary"
            onClick={login}
            disabled={loading}
            style={{
              width: "100%", padding: "12px 16px", marginTop: error ? 0 : 8,
              borderRadius: 8, border: "none", background: INK, color: WHEAT,
              cursor: loading ? "default" : "pointer", fontWeight: 600, fontSize: 14,
              opacity: loading ? 0.7 : 1, transition: "background 0.15s",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: STONE }} />
            <span style={{ fontSize: 12, color: "#9A9482" }}>o</span>
            <div style={{ flex: 1, height: 1, background: STONE }} />
          </div>

          <button
            className="sa-btn-google"
            onClick={loginConGoogle}
            disabled={loadingGoogle}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "11px 16px", borderRadius: 8,
              border: `1px solid ${STONE}`, background: "white",
              cursor: loadingGoogle ? "default" : "pointer",
              fontWeight: 600, fontSize: 14, color: TEXT,
              opacity: loadingGoogle ? 0.6 : 1, boxSizing: "border-box",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <img src="https://www.google.com/favicon.ico" width={17} height={17} alt="" />
            {loadingGoogle ? "Redirigiendo..." : "Continuar con Google"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#9A9482", marginTop: 28 }}>
            El Encuentro MSA S.A.
          </p>
        </div>
      </div>
    </div>
  );
}