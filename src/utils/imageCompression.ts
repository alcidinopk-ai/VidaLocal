import { supabase } from '../lib/supabase';

/**
 * Compresses an image file on the frontend before upload.
 * - Resizes the width to a maximum of 1200px (maintaining aspect ratio).
 * - Converts the format to WebP with JPEG fallback.
 * - Iteratively reduces quality if needed to ensure the file size is ideally below 200KB.
 */
export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // If it's not an image, resolve immediately
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Target maximum width of 1200px keeping aspect ratio
          const MAX_WIDTH = 1200;
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter o contexto de renderização do Canvas.'));
            return;
          }

          // Draw image to canvas
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.8; // Initial quality (75% to 80% as requested)
          let format = 'image/webp';
          let compressedBlob: Blob | null = null;
          const TARGET_SIZE_BYTES = 200 * 1024; // 200KB

          const getBlobFromCanvas = (type: string, q: number): Promise<Blob> => {
            return new Promise((resBlob, rejBlob) => {
              canvas.toBlob((b) => {
                if (b) {
                  resBlob(b);
                } else {
                  rejBlob(new Error('Conversão do canvas falhou.'));
                }
              }, type, q);
            });
          };

          // Try compiling as WebP first
          try {
            compressedBlob = await getBlobFromCanvas(format, quality);
            // Fall back to JPEG if WebP is unsupported or returns incorrect MIME
            if (!compressedBlob.type.includes('webp')) {
              format = 'image/jpeg';
              compressedBlob = await getBlobFromCanvas(format, quality);
            }
          } catch {
            format = 'image/jpeg';
            compressedBlob = await getBlobFromCanvas(format, quality);
          }

          // Iterative file reduction if the result exceeds 200KB
          let attempts = 0;
          while (compressedBlob.size > TARGET_SIZE_BYTES && quality > 0.3 && attempts < 4) {
            quality -= 0.15;
            compressedBlob = await getBlobFromCanvas(format, quality);
            attempts++;
          }

          const fileExtension = format === 'image/webp' ? '.webp' : '.jpg';
          const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
          
          const compressedFile = new File(
            [compressedBlob], 
            `${originalNameWithoutExt}_optimized${fileExtension}`, 
            {
              type: format,
              lastModified: Date.now()
            }
          );

          console.log(`[Otimização] Original: ${(file.size / 1024).toFixed(1)}KB, Compactada: ${(compressedFile.size / 1024).toFixed(1)}KB, Formato: ${format}, Qualidade: ${quality.toFixed(2)}`);
          resolve(compressedFile);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => reject(new Error('Erro ao carregar o arquivo de imagem de origem.'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a file directly to its base64 data URL.
 * Used as an ultra-flexible fallback when Supabase Storage is not set up yet.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Compresses an image and uploads it to Supabase Storage.
 * Generates an automatic path inside the configured storage bucket.
 * 
 * If the upload fails due to missing bucket or lack of permissions,
 * it returns a graceful fallback in base64, logging a clear warning.
 */
export async function compressAndUploadImage(
  file: File, 
  bucketName = 'establishments'
): Promise<string> {
  console.log(`[Upload] Iniciando processamento de imagem: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
  
  // 1. Compress image in frontend
  const optimizedFile = await compressImage(file);
  
  // Check if Supabase URL is standard or a placeholder
  const isPlaceholder = import.meta.env.VITE_SUPABASE_URL?.includes('placeholder') || !import.meta.env.VITE_SUPABASE_URL;
  if (isPlaceholder) {
    console.warn(`[Upload] Supabase utilizando credenciais placeholder. Salvando imagem localmente como Base64 otimizado.`);
    return await fileToBase64(optimizedFile);
  }

  // 2. Build unique filename to prevent overwriting
  const fileExtension = optimizedFile.name.split('.').pop() || 'webp';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const safeFileName = `${timestamp}_${randomStr}.${fileExtension}`;
  
  // Save under 'images/' path
  const filePath = `images/${safeFileName}`;

  try {
    console.log(`[Upload] Enviando para o bucket '${bucketName}', caminho: '${filePath}'...`);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, optimizedFile, {
        contentType: optimizedFile.type,
        cacheControl: '31536000', // 1 year cache
        upsert: true
      });

    if (error) {
      console.warn(`[Upload - Erro de Envio] Detalhes do erro do Supabase:`, error);
      
      // Check if bucket might be missing (often error status 404 or message contain "not found")
      if (error.message?.toLowerCase().includes('not found') || (error as any).status === 404) {
        console.warn(`[Upload - Fallback] O Bucket '${bucketName}' não foi encontrado no Supabase. Retornando imagem em Base64 otimizado.`);
        return await fileToBase64(optimizedFile);
      }
      
      // General error fallback to Base64 so the form submitted with photos never crashes
      console.warn(`[Upload - Fallback] Falha no storage, aplicando fallback automático para Base64.`);
      return await fileToBase64(optimizedFile);
    }

    console.log(`[Upload] Upload com sucesso! Obtendo URL do arquivo...`);
    // 3. Retrieve the final public URL of the uploaded asset
    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    
    console.log(`[Upload] URL pública gerada:`, publicUrl);
    return publicUrl;
  } catch (uploadException: any) {
    console.error(`[Upload - Exceção] Falha ao interagir com o Supabase Storage:`, uploadException);
    console.warn(`[Upload - Fallback] Aplicando fallback para Base64 otimizado.`);
    return await fileToBase64(optimizedFile);
  }
}

/**
 * Utility to parse images from various representation formats.
 * Supports:
 * - Real JS string arrays: ['url1', 'url2']
 * - Postgres array string literal representations: '{"url1","url2"}' or '{url1,url2}'
 * - JSON string array representations: '["url1","url2"]'
 * - Comma-separated or singular URL string representations: 'url1,url2' or 'url1'
 */
export function parseImageArray(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter(item => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];

    // Check for postgres array format: {item1,item2}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const content = trimmed.slice(1, -1).trim();
      if (!content) return [];
      
      const items: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"' && (i === 0 || content[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          items.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current || items.length > 0) {
        items.push(current.trim());
      }
      
      return items.map(item => {
        let cleaned = item;
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1);
        }
        return cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
      }).filter(Boolean);
    }

    // Check for JSON array format: ["item1", "item2"]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim()).filter(Boolean);
        }
      } catch (e) {
        // Fall through
      }
    }

    // Comma-separated fallback
    if (trimmed.includes('http') || trimmed.includes('data:image/')) {
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }

    // Single string
    return [trimmed];
  }
  return [];
}

