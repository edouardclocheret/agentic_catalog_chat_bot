export function getRepairVideo(partNumber, partsData) {
  for (const model in partsData) {
    if (partsData[model].parts[partNumber]) {
      return partsData[model].parts[partNumber].repair_video_url || null;
    }
  }
  return null;
}
