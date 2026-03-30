#!/usr/bin/env node
/**
 * Traduce automáticamente las claves faltantes en los archivos de mensajes
 * usando la API de LibreTranslate (instancia pública o self-hosted).
 *
 * Uso:
 *   node scripts/translate-messages.mjs
 *   LIBRETRANSLATE_URL=http://localhost:5000 node scripts/translate-messages.mjs
 *
 * El script:
 * 1. Lee es.json como fuente de verdad
 * 2. Para cada idioma destino (en, pt), detecta claves faltantes o vacías
 * 3. Traduce cada valor usando LibreTranslate
 * 4. Escribe el archivo actualizado
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, '..', 'messages');

const LT_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LT_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

const TARGETS = [
  { code: 'en', file: 'en.json' },
  { code: 'pt', file: 'pt.json' },
];

// ── Helpers ─────────────────────────────────────────────────────────

async function translate(text, source, target) {
  if (!text || text.trim() === '') return text;

  const body = {
    q: text,
    source,
    target,
    format: 'text',
  };
  if (LT_API_KEY) body.api_key = LT_API_KEY;

  try {
    const res = await fetch(`${LT_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  ✗ Translation failed (${res.status}): ${err}`);
      return text; // fallback to original
    }

    const data = await res.json();
    return data.translatedText || text;
  } catch (err) {
    console.error(`  ✗ Network error: ${err.message}`);
    return text;
  }
}

/** Flatten nested object to dot-notation keys */
function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

/** Set a value in a nested object using dot-notation key */
function setNested(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌐 LibreTranslate Message Sync`);
  console.log(`   API: ${LT_URL}\n`);

  // Check API availability
  try {
    const langRes = await fetch(`${LT_URL}/languages`);
    if (!langRes.ok) throw new Error(`Status ${langRes.status}`);
    const langs = await langRes.json();
    console.log(`   ✓ API available (${langs.length} languages)\n`);
  } catch (err) {
    console.error(`   ✗ Cannot reach LibreTranslate at ${LT_URL}`);
    console.error(`     Set LIBRETRANSLATE_URL env var or start a local instance.`);
    console.error(`     Install: pip install libretranslate && libretranslate\n`);
    process.exit(1);
  }

  const sourceFile = resolve(MESSAGES_DIR, 'es.json');
  const source = JSON.parse(readFileSync(sourceFile, 'utf-8'));
  const sourceFlat = flatten(source);
  const sourceKeys = Object.keys(sourceFlat);

  console.log(`   Source: es.json (${sourceKeys.length} keys)\n`);

  for (const target of TARGETS) {
    const targetFile = resolve(MESSAGES_DIR, target.file);
    let targetObj;
    try {
      targetObj = JSON.parse(readFileSync(targetFile, 'utf-8'));
    } catch {
      targetObj = {};
    }
    const targetFlat = flatten(targetObj);

    // Find missing or empty keys
    const missing = sourceKeys.filter(
      (key) => !(key in targetFlat) || targetFlat[key] === '' || targetFlat[key] === null
    );

    if (missing.length === 0) {
      console.log(`   ${target.code.toUpperCase()}: ✓ All ${sourceKeys.length} keys present\n`);
      continue;
    }

    console.log(`   ${target.code.toUpperCase()}: Translating ${missing.length} missing keys...`);

    let translated = 0;
    for (const key of missing) {
      const sourceValue = sourceFlat[key];
      if (typeof sourceValue !== 'string') {
        setNested(targetObj, key, sourceValue);
        translated++;
        continue;
      }

      // Skip very short strings or placeholders
      if (sourceValue.length <= 2 || /^\{.*\}$/.test(sourceValue)) {
        setNested(targetObj, key, sourceValue);
        translated++;
        continue;
      }

      const result = await translate(sourceValue, 'es', target.code);
      setNested(targetObj, key, result);
      translated++;

      if (translated % 10 === 0) {
        process.stdout.write(`     ${translated}/${missing.length}\r`);
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 150));
    }

    writeFileSync(targetFile, JSON.stringify(targetObj, null, 4) + '\n', 'utf-8');
    console.log(`     ✓ ${translated} keys translated and saved to ${target.file}\n`);
  }

  console.log(`   Done! 🎉\n`);
}

main().catch(console.error);
