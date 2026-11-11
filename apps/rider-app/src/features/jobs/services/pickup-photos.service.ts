import { supabase } from '../../../lib/supabase';

const BUCKET = 'order-pickup-photos';
const SIGNED_URL_SECONDS = 60 * 60;

export type PickupPhoto = {
  path: string;
  url: string;
};

function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

function contentTypeFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'image/png';
  if (mimeType.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

async function signedPhotos(paths: string[]): Promise<PickupPhoto[]> {
  if (paths.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);

  if (error) throw new Error(error.message);

  return paths.flatMap((path, index) => {
    const row = data?.[index];
    if (!row?.signedUrl || row.error) return [];
    return [{ path, url: row.signedUrl }];
  });
}

export async function listPickupPhotos(orderId: string): Promise<PickupPhoto[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(orderId, {
    limit: 50,
    sortBy: { column: 'created_at', order: 'asc' },
  });

  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) return [];
    throw new Error(error.message);
  }

  const paths = (data ?? [])
    .filter((file) => file.name.includes('.') && !file.name.startsWith('.'))
    .map((file) => `${orderId}/${file.name}`);

  return signedPhotos(paths);
}

export async function uploadPickupPhoto(
  orderId: string,
  localUri: string,
  mimeType = 'image/jpeg',
): Promise<PickupPhoto> {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error('Could not read the photo');

  const arrayBuffer = await response.arrayBuffer();
  const path = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(mimeType)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: contentTypeFor(mimeType),
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const [photo] = await signedPhotos([path]);
  if (!photo) throw new Error('Photo uploaded, but it could not be opened');
  return photo;
}

export async function removePickupPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** Deletes every pickup photo for an order. Safe to call when none exist. */
export async function deletePickupPhotos(orderId: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).list(orderId, {
    limit: 100,
  });

  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) return;
    throw new Error(error.message);
  }

  const paths = (data ?? [])
    .filter((file) => file.name && !file.name.startsWith('.'))
    .map((file) => `${orderId}/${file.name}`);

  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw new Error(removeError.message);
}
