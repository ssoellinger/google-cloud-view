interface Props {
  size?: number;
}

/** App mark: a cloud with a focal "view" lens, on the app's purple gradient tile. */
export function Logo({ size = 40 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Google Cloud View logo"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="gcv-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6c5ce7" />
          <stop offset="1" stopColor="#a29bfe" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#gcv-logo-grad)" />
      <path
        d="M33 31.5H16.5A5.75 5.75 0 0 1 17 20a7.25 7.25 0 0 1 13.8-2.1A5.75 5.75 0 0 1 33 31.5Z"
        fill="#fff"
      />
      <circle cx="24" cy="23.4" r="3.1" fill="#6c5ce7" />
      <circle cx="22.9" cy="22.3" r="1" fill="#fff" />
    </svg>
  );
}
