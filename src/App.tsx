import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { Haiku } from "./types";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { getAuth, signInAnonymously } from "firebase/auth";

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
console.log(GEMINI_API_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

function App() {
  const [theme, setTheme] = useState("");
  const [currentHaiku, setCurrentHaiku] = useState<Haiku | null>(null);
  const [haikus, setHaikus] = useState<Haiku[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateHaiku = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Write a traditional haiku (5-7-5 syllables) about: ${theme}. Return only the haiku text, no explanations.`,
      });
      const haikuText = response.text?.trim();
      if (!haikuText) throw new Error("No haiku generated.");
      // Display the haiku immediately
      setCurrentHaiku({
        id: "", // Will be set after Firestore save
        theme,
        text: haikuText,
        createdAt: new Date(),
      });
      // Save to Firestore and update history
      const newHaiku: Haiku = {
        id: "",
        theme,
        text: haikuText,
        createdAt: new Date(),
      };
      const savedHaiku = await saveHaiku(newHaiku);
      setCurrentHaiku(savedHaiku); // update with Firestore id
      setTheme("");
      await loadHaikus();
    } catch (err: any) {
      setError("Failed to generate haiku.");
    } finally {
      setLoading(false);
    }
  };

  const saveHaiku = async (haiku: Haiku): Promise<Haiku> => {
    const docRef = await addDoc(collection(db, "haikus"), {
      theme: haiku.theme,
      text: haiku.text,
      createdAt: Timestamp.fromDate(haiku.createdAt),
    });
    return { ...haiku, id: docRef.id };
  };

  const loadHaikus = async () => {
    const q = query(collection(db, "haikus"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const haikuList: Haiku[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        theme: data.theme,
        text: data.text,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(),
      };
    });
    setHaikus(haikuList);
  };

  useEffect(() => {
    loadHaikus();
    // eslint-disable-next-line
  }, []);

  const auth = getAuth();
  signInAnonymously(auth);

  return (
    <div
      style={{
        fontFamily:
          "Inter, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
        background: "#fff8ee",
        minHeight: "100vh",
        padding: 0,
      }}
    >
      <div
        style={{
          padding: "32px 20px 20px 20px",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontFamily:
              "Inter, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
            fontWeight: 800,
            fontSize: 36,
            marginBottom: 8,
            letterSpacing: "-1px",
            color: "#b86b36",
          }}
        >
          Haiku Generator
        </h1>
        <p style={{ color: "#666", marginBottom: 24, fontSize: 18 }}>
          Generate and save beautiful haikus with AI
        </p>
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Enter haiku theme..."
            style={{
              padding: "10px 14px",
              width: "70%",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontSize: 16,
              fontFamily: "inherit",
              background: "#fff",
            }}
            disabled={loading}
          />
          <button
            onClick={generateHaiku}
            disabled={loading || !theme.trim()}
            style={{
              padding: "10px 20px",
              background: loading || !theme.trim() ? "#b5b5b5" : "#b86b36",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 16,
              cursor: loading || !theme.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              boxShadow:
                loading || !theme.trim() ? "none" : "0 2px 8px #b86b3622",
            }}
          >
            {loading ? "Generating..." : "Generate Haiku"}
          </button>
        </div>
        {error && (
          <div style={{ color: "red", marginTop: 10, marginBottom: 10 }}>
            {error}
          </div>
        )}
        {currentHaiku && (
          <div
            style={{
              margin: "24px 0",
              padding: "24px",
              borderRadius: 12,
              background: "#fff",
              boxShadow: "0 2px 12px #0001",
              border: "1px solid #e5e7eb",
            }}
          >
            <h3
              style={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 22,
                margin: 0,
                color: "#b86b36",
              }}
            >
              Your Haiku
            </h3>
            <pre
              style={{
                fontSize: 20,
                margin: "18px 0 8px 0",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                whiteSpace: "pre-wrap",
                color: "#222",
              }}
            >
              {currentHaiku.text}
            </pre>
            <small style={{ color: "#666" }}>Theme: {currentHaiku.theme}</small>
          </div>
        )}
        <div style={{ marginTop: 32 }}>
          <h3
            style={{
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 20,
              marginBottom: 12,
              color: "#222",
            }}
          >
            Past Haikus ({haikus.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {haikus.map((haiku) => (
              <div
                key={haiku.id}
                style={{
                  padding: "16px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 4px #0001",
                }}
              >
                <pre
                  style={{
                    fontSize: 16,
                    margin: 0,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    whiteSpace: "pre-wrap",
                    color: "#222",
                  }}
                >
                  {haiku.text}
                </pre>
                <small style={{ color: "#666" }}>
                  Theme: {haiku.theme} | {haiku.createdAt.toLocaleDateString()}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
