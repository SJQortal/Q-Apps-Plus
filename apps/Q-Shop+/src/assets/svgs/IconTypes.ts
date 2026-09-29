export interface IconTypes {
  color: string;
  height: string;
  width: string;
  className?: string;
  onClickFunc?: ((e: React.MouseEvent<any>) => void) | ((params?: any) => void);
  id?: string;
}
