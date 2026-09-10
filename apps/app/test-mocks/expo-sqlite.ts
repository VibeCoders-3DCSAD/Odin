export async function openDatabaseAsync(): Promise<never> {
  throw new Error("expo-sqlite is unavailable in Jest; mock the repository that uses it.");
}
