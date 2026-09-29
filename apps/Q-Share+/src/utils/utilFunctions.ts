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
