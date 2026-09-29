export const objectIsNull = (variable: object) => {
  return Object.is(variable, null);
};
export const objectIsUndefined = (variable: object) => {
  return Object.is(variable, undefined);
};

export const printVar = (variable: object) => {
  if (objectIsNull(variable)) {
    console.log("variable is NULL");
    return;
  }
  if (objectIsUndefined(variable)) {
    console.log("variable is UNDEFINED");
    return;
  }

  const [key, value] = Object.entries(variable)[0];
  console.log(key, " is: ", value);
};

export const isNumber = (input: string) => {
  if (input === "") return false;
  const num = Number(input);
  return !isNaN(num);
};

export const truncateNumber = (value: string | number, sigDigits: number) => {
  return Number(value).toFixed(sigDigits);
};
export const objectIndexToKey = (obj: object, index: number) => {
  const keys = Object.keys(obj);

  if (index < 0 || index >= keys.length) {
    throw new Error(`Invalid index: ${index}`);
  }
  const key = keys[index];
  return key;
};
