/** File-type icons (SVG). PDF = red, as used across Hani's apps. */
export function PdfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#E5322D" />
      <path d="M14.5 2v4a1.5 1.5 0 0 0 1.5 1.5h4L14.5 2Z" fill="#FF8A80" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="6.4" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">PDF</text>
    </svg>
  );
}

export function PrintIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8V3.5h10V8" />
      <rect x="3" y="8" width="18" height="9" rx="2.2" fill="currentColor" fillOpacity=".12" />
      <path d="M7 14h10v6.5H7z" fill="#fff" />
      <circle cx="17.5" cy="11" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}
