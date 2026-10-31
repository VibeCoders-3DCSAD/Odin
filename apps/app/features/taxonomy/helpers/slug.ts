// "Dining Out" -> "dining-out". Shared by the category and subcategory forms.
export function generateSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
