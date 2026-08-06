import { BrowserRouter, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import { PlaylistProvider } from "./lib/playlist";
import Overview from "./pages/Overview";
import Recommendations from "./pages/Recommendations";
import Mood from "./pages/Mood";
import Genre from "./pages/Genre";
import Playlist from "./pages/Playlist";
import Visualize from "./pages/Visualize";
import HowItWorks from "./pages/HowItWorks";

export default function App() {
  return (
    <PlaylistProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/mood" element={<Mood />} />
              <Route path="/genre" element={<Genre />} />
              <Route path="/playlist" element={<Playlist />} />
              <Route path="/visualize" element={<Visualize />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
            </Routes>
          </main>
          <footer className="border-t border-border/70 px-5 py-6">
            <p className="mx-auto max-w-7xl text-xs text-muted-foreground">
              Harmoniq | Hybrid music recommendation, mood discovery, genre exploration, and
              explainable AI in one polished web experience.
            </p>
          </footer>
        </div>
      </BrowserRouter>
    </PlaylistProvider>
  );
}
