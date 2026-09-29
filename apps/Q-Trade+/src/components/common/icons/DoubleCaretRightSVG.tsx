import { IconTypes } from "./IconTypes";

export const DoubleCaretRightSVG: React.FC<IconTypes> = ({
  color,
  height,
  width,
  className,
}) => {
  return (
    <svg
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 -960 960 960"
      width={width}
    >
      <path d="M383-480 200-664l56-56 240 240-240 240-56-56 183-184Zm264 0L464-664l56-56 240 240-240 240-56-56 183-184Z" />
    </svg>
  );
};
