import { IconTypes } from "./IconTypes";

export const CaretDownSVG: React.FC<IconTypes> = ({ color, height, width }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 15 8"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1 1L7.5 7L14 1" stroke="#464646" strokeLinecap="round" />
    </svg>
  );
};
