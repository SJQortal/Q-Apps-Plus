export const cropAddress = (string: string = "", range: number = 5) => {
  const [start, end] = [
    string?.substring(0, range),
    string?.substring(string?.length - range, string?.length),
    //
  ];
  return start + "..." + end;
};
