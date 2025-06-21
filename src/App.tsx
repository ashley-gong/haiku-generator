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
import "./App.css";

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
    <div className="app-container">
      <div className="app-content">
        <h1 className="app-title">Haiku Generator</h1>
        <p className="app-subtitle">
          Generate and save beautiful haikus with AI
        </p>
        <div className="input-container">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Enter haiku theme..."
            className="theme-input"
            disabled={loading}
          />
          <button
            onClick={generateHaiku}
            disabled={loading || !theme.trim()}
            className="generate-button"
          >
            {loading ? "Generating..." : "Generate Haiku"}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        {currentHaiku && (
          <div className="current-haiku">
            <h3 className="current-haiku-title">Your Haiku</h3>
            <pre className="haiku-text">{currentHaiku.text}</pre>
            <small className="haiku-theme">Theme: {currentHaiku.theme}</small>
          </div>
        )}
        <div className="past-haikus-section">
          <h3 className="past-haikus-title">Past Haikus ({haikus.length})</h3>
          <div className="haiku-list">
            {haikus.map((haiku) => (
              <div key={haiku.id} className="haiku-item">
                <pre className="haiku-item-text">{haiku.text}</pre>
                <div className="haiku-item-meta">
                  Theme: {haiku.theme} | {haiku.createdAt.toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
