export function getRepairVideo(partNumber, partsData) {
  for (const modelKey in partsData) {
    const model = partsData[modelKey];
    if (model.parts[partNumber]) {
      return model.parts[partNumber].repair_video_url || null;
    }
  }
  return null;
}
