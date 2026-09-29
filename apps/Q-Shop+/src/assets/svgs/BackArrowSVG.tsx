import { IconTypes } from "./IconTypes";

export const BackArrowSVG: React.FC<IconTypes> = ({
  color,
  height,
  width,
  className
}) => {
  return (
    <svg
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 96 960 960"
      width={width}
    >
      <path d="M480 896 160 576l320-320 42 42-248 248h526v60H274l248 248-42 42Z" />
    </svg>
  );
};
