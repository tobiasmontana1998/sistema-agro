"use client";

export default function Home() {
  return (
    <div>

      {/* ✅ BLOQUE PRINCIPAL */}
      <div
        style={{
          height: 480,
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          marginBottom: 30,
        }}
      >
        {/* ✅ IMAGEN */}
        <img
          src="/campo.png"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* ✅ DEGRADADO SUAVE */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.5))",
          }}
        />

        {/* ✅ BOTÓN ABAJO */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            style={{
              padding: "14px 28px",
              background: "#0f3d2e",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Empezar gestión
          </button>
        </div>
      </div>

    </div>
  );
}