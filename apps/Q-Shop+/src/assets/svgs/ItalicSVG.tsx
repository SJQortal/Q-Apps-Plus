import { SVGProps } from './interfaces'

export const ItalicSVG: React.FC<SVGProps> = ({ color, height, width }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={height}
      viewBox="0 96 960 960"
      width={width}
    >
      <path
        fill={color}
        d="M264 857q-16.8 0-28.4-11.641-11.6-11.641-11.6-28.5t11.6-28.359Q247.2 777 264 777h94l139-409H378q-16.8 0-28.4-11.641-11.6-11.641-11.6-28.5t11.6-28.359Q361.2 288 378 288h300q16.8 0 28.4 11.641 11.6 11.641 11.6 28.5T706.4 356.5Q694.8 368 678 368h-94L445 777h119q16.8 0 28.4 11.641 11.6 11.641 11.6 28.5T592.4 845.5Q580.8 857 564 857H264Z"
      />
    </svg>
  )
}
