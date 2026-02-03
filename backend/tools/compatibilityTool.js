export function isPartCompatible(partNumber, model, partsData) {
  return Boolean(partsData[model]?.parts[partNumber]);
}
