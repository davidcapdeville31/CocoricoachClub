// UI mirrors existing document grants; server policies remain authoritative.
export function canAddAthleteDocument(scope: "personal" | "team", ownsPlayer: boolean, managesCategory: boolean) {
  return managesCategory || (scope === "personal" && ownsPlayer);
}