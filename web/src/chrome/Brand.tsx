// The brand: a prompt in a rounded square (`>_`) and the name in the
// terminal's own face. The mark is drawn in currentColor so the tokens
// colour it in both themes.
export function BrandMark({ className = "bc-brand-mark" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="26" height="26" rx="7" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 10l5 4-5 4" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 19h5.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
    );
}
