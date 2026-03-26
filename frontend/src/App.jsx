import EncegenChatWidget from "./components/EncegenChatWidget.jsx";

/**
 * App.jsx — Encegen Enci Chatbot
 *
 * This file only mounts the chat widget.
 * The widget renders as a fixed bottom-right floating button — it does NOT
 * take up any space in your layout.
 *
 * To embed in your own website, see INTEGRATION.md
 */
export default function App() {
  return <EncegenChatWidget />;
}
