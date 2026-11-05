/**
 * Q-Shop's mark (the hexagonal "Q" of assets/img/QShopLogo.webp, without its
 * "SHOP" lettering, which is unreadable at header size) as an SVG in
 * `currentColor`, so it takes each theme's accent instead of needing a light
 * and a dark image. Decorative: the app's name sits beside it.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="106 18 288 332"
      height={size}
      width={Math.round((size * 288) / 332)}
      fill="currentColor"
      style={{ display: "block", flexShrink: 0 }}
    >
      <polygon points="111,102 250,23 318,64 182,144 182,304 111,264" />
      <polygon points="318,64 389,104 389,222 318,182" />
      <polygon points="182,304 319,224 389,263 389,341 320,300 250,344" />
    </svg>
  );
}
