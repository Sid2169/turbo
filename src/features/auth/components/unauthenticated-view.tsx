"use client";

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export const UnauthenticatedView = () => {
  return (
    <div className="landing-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        .landing-root {
          min-height: 100vh;
          background: #0a0a0f;
          color: #f0ece4;
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        .grid-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(244, 91, 22, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244, 91, 22, 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
        }

        .noise {
          position: fixed;
          inset: 0;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          pointer-events: none;
          z-index: 0;
        }

        .glow-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
        }

        .glow-1 {
          width: 600px;
          height: 600px;
          background: rgba(244, 91, 22, 0.12);
          top: -200px;
          right: -100px;
        }

        .glow-2 {
          width: 400px;
          height: 400px;
          background: rgba(64, 205, 255, 0.08);
          bottom: 100px;
          left: -100px;
        }

        .content {
          position: relative;
          z-index: 1;
        }

        /* NAV */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 48px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          display: block;
          width: 32px;
          height: 32px;
        }

        .logo-icon-sm {
          width: 24px;
          height: 24px;
        }

        .logo-text {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f5efe5;
        }

        .nav-badge {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          background: rgba(244, 91, 22, 0.15);
          border: 1px solid rgba(244, 91, 22, 0.3);
          color: #FFA35C;
          padding: 3px 8px;
          border-radius: 20px;
          letter-spacing: 0.08em;
        }

        .nav-sign-in button {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          color: #c4b8a8 !important;
          padding: 8px 20px !important;
          border-radius: 8px !important;
          font-family: 'Syne', sans-serif !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }

        .nav-sign-in button:hover {
          background: rgba(244, 91, 22, 0.15) !important;
          border-color: rgba(244, 91, 22, 0.4) !important;
          color: #f5efe5 !important;
        }

        /* HERO */
        .hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 100px 48px 80px;
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(244, 91, 22, 0.1);
          border: 1px solid rgba(244, 91, 22, 0.25);
          border-radius: 20px;
          padding: 6px 14px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #FFA35C;
          letter-spacing: 0.06em;
          margin-bottom: 40px;
        }

        .pill-dot {
          width: 6px;
          height: 6px;
          background: #F45B16;
          border-radius: 50%;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .hero h1 {
          font-size: clamp(48px, 7vw, 76px);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -0.04em;
          margin: 0 0 24px;
          color: #f5efe5;
        }

        .hero h1 .accent {
          background: linear-gradient(135deg, #FFA35C 0%, #F45B16 50%, #40CDFF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: 18px;
          line-height: 1.7;
          color: #9a8e7e;
          max-width: 520px;
          margin: 0 0 48px;
          font-weight: 400;
        }

        .hero-cta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .cta-primary button {
          background: linear-gradient(135deg, #F45B16, #F66A19) !important;
          border: none !important;
          color: white !important;
          padding: 14px 32px !important;
          border-radius: 10px !important;
          font-family: 'Syne', sans-serif !important;
          font-size: 15px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
          box-shadow: 0 0 40px rgba(244, 91, 22, 0.3) !important;
        }

        .cta-primary button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 0 60px rgba(244, 91, 22, 0.45) !important;
        }

        /* EDITOR PREVIEW */
        .editor-preview {
          max-width: 1000px;
          margin: 0 auto 100px;
          padding: 0 48px;
        }

        .editor-window {
          background: #111118;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,91,22,0.1);
        }

        .editor-titlebar {
          background: #0d0d14;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .dot-group {
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot-r { background: #ff5f57; }
        .dot-y { background: #febc2e; }
        .dot-g { background: #28c840; }

        .tab-bar {
          display: flex;
          gap: 0;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
        }

        .tab {
          padding: 4px 14px;
          border-radius: 6px 6px 0 0;
          color: #6b5a4a;
        }

        .tab.active {
          background: rgba(244, 91, 22, 0.12);
          color: #FFA35C;
          border: 1px solid rgba(244, 91, 22, 0.2);
          border-bottom: none;
        }

        .editor-body {
          display: grid;
          grid-template-columns: 180px 1fr 260px;
          min-height: 340px;
        }

        .file-tree {
          background: #0d0d14;
          border-right: 1px solid rgba(255,255,255,0.04);
          padding: 16px 0;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
        }

        .tree-item {
          padding: 4px 16px;
          color: #6b5a4a;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.15s;
        }

        .tree-item:hover { color: #9a8e7e; }
        .tree-item.active { color: #FFA35C; background: rgba(244,91,22,0.08); }
        .tree-folder { color: #F45B16; font-size: 10px; }
        .tree-indent { padding-left: 28px; }

        .code-area {
          padding: 20px 24px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          line-height: 1.8;
          overflow: hidden;
        }

        .line { display: flex; gap: 20px; }
        .ln { color: #362e28; min-width: 20px; text-align: right; user-select: none; }
        .kw { color: #FFA35C; }
        .fn { color: #40CDFF; }
        .str { color: #34d399; }
        .cmt { color: #4a3d35; }
        .var { color: #f5efe5; }
        .num { color: #fb923c; }
        .ghost { color: #4a3d35; font-style: italic; }

        .ai-panel {
          background: #0d0d14;
          border-left: 1px solid rgba(255,255,255,0.04);
          display: flex;
          flex-direction: column;
        }

        .ai-panel-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 11px;
          color: #6b5a4a;
          font-family: 'DM Mono', monospace;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ai-dot {
          width: 6px;
          height: 6px;
          background: #F45B16;
          border-radius: 50%;
        }

        .ai-messages {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .ai-msg {
          font-size: 11px;
          line-height: 1.6;
          padding: 10px 12px;
          border-radius: 8px;
          font-family: 'DM Mono', monospace;
        }

        .ai-msg.user {
          background: rgba(244,91,22,0.12);
          border: 1px solid rgba(244,91,22,0.2);
          color: #c4b8a8;
          align-self: flex-end;
          max-width: 90%;
        }

        .ai-msg.assistant {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #9a8e7e;
          max-width: 95%;
        }

        /* FEATURES */
        .features {
          max-width: 1000px;
          margin: 0 auto 100px;
          padding: 0 48px;
        }

        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #F45B16;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 36px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #f5efe5;
          margin-bottom: 48px;
          line-height: 1.15;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .feature-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.2s;
        }

        .feature-card:hover {
          background: rgba(244,91,22,0.05);
          border-color: rgba(244,91,22,0.2);
          transform: translateY(-2px);
        }

        .feature-icon {
          width: 36px;
          height: 36px;
          background: rgba(244,91,22,0.12);
          border: 1px solid rgba(244,91,22,0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          font-size: 16px;
        }

        .feature-card h3 {
          font-size: 15px;
          font-weight: 600;
          color: #f0ece4;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }

        .feature-card p {
          font-size: 13px;
          color: #6664858;
          line-height: 1.6;
          margin: 0;
          color: #6b5a4a;
        }

        /* FOOTER */
        .footer {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 32px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #4a3d35;
        }

        .footer-right {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #4a3d35;
        }

        @media (max-width: 768px) {
          .nav { padding: 16px 24px; }
          .hero { padding: 60px 24px 60px; }
          .editor-preview { padding: 0 24px; }
          .features { padding: 0 24px; }
          .footer { padding: 24px; flex-direction: column; gap: 12px; }
          .editor-body { grid-template-columns: 1fr; }
          .file-tree { display: none; }
          .ai-panel { display: none; }
          .features-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="grid-bg" />
      <div className="noise" />
      <div className="glow-orb glow-1" />
      <div className="glow-orb glow-2" />

      <div className="content">
        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo">
            <img src="/logo.svg" alt="Turbo" className="logo-icon" />
            <span className="logo-text">Turbo</span>
            <span className="nav-badge">AI EDITOR</span>
          </div>
          <div className="nav-sign-in">
            <SignInButton>
              <button>Sign in</button>
            </SignInButton>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-pill">
            <div className="pill-dot" />
            POWERED BY CLAUDE AI
          </div>
          <h1>
            Code at the speed<br />
            of <span className="accent">thought</span>
          </h1>
          <p className="hero-sub">
            A browser-based IDE with AI that actually understands your codebase.
            Real-time suggestions, instant edits, and a coding agent that ships for you.
          </p>
          <div className="hero-cta">
            <div className="cta-primary">
              <SignInButton>
                <button>Get started free →</button>
              </SignInButton>
            </div>
          </div>
        </section>

        {/* EDITOR PREVIEW */}
        <div className="editor-preview">
          <div className="editor-window">
            <div className="editor-titlebar">
              <div className="dot-group">
                <div className="dot dot-r" />
                <div className="dot dot-y" />
                <div className="dot dot-g" />
              </div>
              <div className="tab-bar">
                <div className="tab active">app.tsx</div>
                <div className="tab">utils.ts</div>
                <div className="tab">api.ts</div>
              </div>
            </div>
            <div className="editor-body">
              <div className="file-tree">
                <div className="tree-item"><span className="tree-folder">▾</span> src</div>
                <div className="tree-item tree-indent active">app.tsx</div>
                <div className="tree-item tree-indent">utils.ts</div>
                <div className="tree-item tree-indent">api.ts</div>
                <div className="tree-item"><span className="tree-folder">▾</span> components</div>
                <div className="tree-item tree-indent">Button.tsx</div>
                <div className="tree-item tree-indent">Modal.tsx</div>
                <div className="tree-item"><span className="tree-folder">▸</span> hooks</div>
                <div className="tree-item"><span className="tree-folder">▸</span> lib</div>
              </div>
              <div className="code-area">
                <div className="line"><span className="ln">1</span><span><span className="kw">import</span> <span className="var">React</span> <span className="kw">from</span> <span className="str">'react'</span></span></div>
                <div className="line"><span className="ln">2</span><span><span className="kw">import</span> {"{"} <span className="var">useState</span>, <span className="var">useEffect</span> {"}"} <span className="kw">from</span> <span className="str">'react'</span></span></div>
                <div className="line"><span className="ln">3</span><span className="cmt">// ─────────────────────────────────────────────</span></div>
                <div className="line"><span className="ln">4</span><span></span></div>
                <div className="line"><span className="ln">5</span><span><span className="kw">interface</span> <span className="fn">User</span> {"{"}</span></div>
                <div className="line"><span className="ln">6</span><span>  <span className="var">id</span>: <span className="kw">string</span></span></div>
                <div className="line"><span className="ln">7</span><span>  <span className="var">name</span>: <span className="kw">string</span></span></div>
                <div className="line"><span className="ln">8</span><span>  <span className="var">email</span>: <span className="kw">string</span></span></div>
                <div className="line"><span className="ln">9</span><span>{"}"}</span></div>
                <div className="line"><span className="ln">10</span><span></span></div>
                <div className="line"><span className="ln">11</span><span><span className="kw">export const</span> <span className="fn">Dashboard</span> = () {"=> {"}</span></div>
                <div className="line"><span className="ln">12</span><span>  <span className="kw">const</span> [<span className="var">users</span>, <span className="var">setUsers</span>] = <span className="fn">useState</span>&lt;<span className="fn">User</span>[]&gt;([])</span></div>
                <div className="line"><span className="ln">13</span><span>  <span className="fn">useEffect</span>(() {"=> {"}</span></div>
                <div className="line"><span className="ln">14</span><span>    <span className="fn">fetchUsers</span>().<span className="fn">then</span>(<span className="var">setUsers</span>)</span></div>
                <div className="line"><span className="ln">15</span><span>  {"}"}, [])</span></div>
                <div className="line"><span className="ln">16</span><span>  <span className="ghost">// ↳ add error handling and loading state</span></span></div>
              </div>
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div className="ai-dot" />
                  AI ASSISTANT
                </div>
                <div className="ai-messages">
                  <div className="ai-msg user">
                    Add error handling to the useEffect
                  </div>
                  <div className="ai-msg assistant">
                    I'll add try/catch with a loading state and error boundary. Here's the updated hook with proper error handling...
                  </div>
                  <div className="ai-msg user">
                    Also add TypeScript types for the API response
                  </div>
                  <div className="ai-msg assistant">
                    Done. Created ApiResponse&lt;T&gt; generic type and updated fetchUsers to use it with proper type narrowing...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <section className="features">
          <div className="section-label">CAPABILITIES</div>
          <h2 className="section-title">Everything you need<br />to ship faster</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>AI Suggestions</h3>
              <p>Ghost-text completions that understand your entire codebase context, not just the current file.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✦</div>
              <h3>Quick Edit (⌘K)</h3>
              <p>Select any code, describe what you want, and watch it transform instantly with Cmd+K.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">◈</div>
              <h3>AI Agent</h3>
              <p>Ask the agent to build entire features. It reads, creates, and modifies files autonomously.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⬡</div>
              <h3>Live Preview</h3>
              <p>WebContainer-powered in-browser execution. See your app running without leaving the editor.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⟁</div>
              <h3>GitHub Sync</h3>
              <p>Import any GitHub repo instantly. Export your project back with a single click.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">◎</div>
              <h3>Real-time Collab</h3>
              <p>Convex-powered live database keeps everything in sync across sessions instantly.</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-left">
            <img src="/logo.svg" alt="Turbo" className="logo-icon logo-icon-sm" />
            <span>Turbo AI Editor</span>
          </div>
          <div className="footer-right">BUILT WITH CLAUDE SONNET</div>
        </footer>
      </div>
    </div>
  );
};