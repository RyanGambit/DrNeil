export const metadata = {
  title: "AskDrFleshner — Virtual Urology Consultation",
  description: "Virtual consultation platform by Dr. Neil Fleshner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
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
          input:focus, textarea:focus {
            border-color: #1A6B5B !important;
          }
          ::placeholder { color: #547C72; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #D8F0EA; border-radius: 3px; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
