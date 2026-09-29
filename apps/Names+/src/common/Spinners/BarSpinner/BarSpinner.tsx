import './barSpinner.css';

interface BarSpinnerProps {
  width: string | number;
  color: string;
}
export const BarSpinner = ({ width = '20px', color }: BarSpinnerProps) => {
  return (
    <div
      style={{
        width,
        color: color || 'green',
      }}
      className="loader-bar"
    ></div>
  );
};
