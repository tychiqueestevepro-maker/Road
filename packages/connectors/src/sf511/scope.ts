export function isWithinSanFranciscoScope(input: {
  latitude?: number;
  longitude?: number;
  text?: string;
}) {
  if (isWithinSanFranciscoBounds(input.latitude, input.longitude)) return true;

  const text = input.text?.toLowerCase() ?? "";
  return (
    text.includes("san francisco") ||
    text.includes("treasure island") ||
    text.includes("yerba buena island") ||
    text.includes("bay bridge")
  );
}

function isWithinSanFranciscoBounds(latitude?: number, longitude?: number) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return false;

  return latitude >= 37.6 && latitude <= 37.84 && longitude >= -122.55 && longitude <= -122.33;
}
