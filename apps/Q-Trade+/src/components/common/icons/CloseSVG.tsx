import { IconTypes } from "./IconTypes";

export const CloseSVG: React.FC<IconTypes> = ({
  color,
  height,
  width,
  onClickFunc,
  className
}) => {
  return (
    <div className={className} onClick={onClickFunc}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height={height}
        viewBox="0 96 960 960"
        width={width}
        fill={color}
      >
        <path d="m249 849-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
      </svg>
    </div>
  );
};
