import { IconTypes } from "./IconTypes";

export const MinimizeSVG: React.FC<IconTypes> = ({
  color,
  height,
  width,
  className,
  onClickFunc
}) => {
  return (
    <svg
      fill={color}
      className={className}
      onClick={onClickFunc}
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 -960 960 960"
      width={width}
    >
      <path d="M240-130v-60h481v60H240Z" />
    </svg>
  );
};
