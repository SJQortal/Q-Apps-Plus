export interface IconTypes {
  color?: string;
  height: string;
  width: string;
  className?: string;
  onClickFunc?: (e?: any) => void;
}
export const TimesSVG: React.FC<IconTypes> = ({
  color,
  height,
  width,
  className,
  onClickFunc,
}) => {
  return (
    <svg
      onClick={onClickFunc}
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 -960 960 960"
      width={width}
    >
      <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
    </svg>
  );
};
