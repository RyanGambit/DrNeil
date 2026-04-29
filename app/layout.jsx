export const metadata = {
  title: "AskDrFleshner — Virtual Urology Consultation",
  description: "Virtual consultation platform by Dr. Neil Fleshner",
};

// Global CSS stays inline (no separate globals.css) for portability.
// Using dangerouslySetInnerHTML rather than children so React's text-content
// reconciliation doesn't kick in — otherwise single-quotes inside the CSS
// (e.g. 'Segoe UI') HTML-encode to &#x27; on the server and trigger 4
// hydration mismatch warnings on every page load.
const globalStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; }
  @keyframes blink {
    0%, 20% { opacity: 0.2; }
    50% { opacity: 1; }
    80%, 100% { opacity: 0.2; }
  }
  @keyframes waitPulse {
    0%, 100% { transform: scale(1); opacity: 0.15; }
    50% { transform: scale(1.18); opacity: 0.4; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes hintFadeIn {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes hintBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(2px); }
  }
  input:focus, textarea:focus {
    border-color: #1A6B5B !important;
    outline: 2px solid #1A6B5B;
    outline-offset: 1px;
  }
  button:focus-visible,
  [role="button"]:focus-visible,
  [role="radio"]:focus-visible,
  a:focus-visible {
    outline: 3px solid #1A6B5B;
    outline-offset: 2px;
    border-radius: 4px;
  }
  ::placeholder { color: #506D65; opacity: 1; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D8F0EA; border-radius: 3px; }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
