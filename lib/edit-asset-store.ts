/**
 * Temporary store for the asset id when opening the modal in edit mode.
 * Used because URL params may not propagate correctly to modals in Expo Go.
 */
let editingAssetId: string | null = null;

export function setEditingAssetId(id: string | null): void {
  editingAssetId = id;
}

export function getEditingAssetId(): string | null {
  return editingAssetId;
}

export function clearEditingAssetId(): void {
  editingAssetId = null;
}
