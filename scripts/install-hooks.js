#!/usr/bin/env node

/**
 * Script per installare automaticamente i Git hooks
 * Funziona su Windows, macOS e Linux
 */

import { execSync } from 'child_process';
import { existsSync, chmodSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const hooksDir = join(projectRoot, '.git', 'hooks');

console.log('🔧 Installing Git hooks...');

try {
  // Verifica che siamo in un repository Git
  if (!existsSync(join(projectRoot, '.git'))) {
    console.error('❌ Questo non sembra essere un repository Git');
    process.exit(1);
  }

  // Verifica che la directory hooks esista
  if (!existsSync(hooksDir)) {
    console.error('❌ Directory .git/hooks non trovata');
    process.exit(1);
  }

  // Rendi eseguibile il hook pre-commit
  const preCommitHook = join(hooksDir, 'pre-commit');

  if (existsSync(preCommitHook)) {
    try {
      // Su Unix-like systems (macOS, Linux)
      chmodSync(preCommitHook, 0o755);
      console.log('✅ Pre-commit hook reso eseguibile');
    } catch (error) {
      // Su Windows, chmodSync potrebbe fallire, ma va bene
      console.log('ℹ️  Pre-commit hook installato (Windows)');
    }
  } else {
    console.log('⚠️  Pre-commit hook non trovato, crealo prima');
  }

  console.log('\n🎉 Git hooks installati con successo!');
  console.log('📝 Il hook pre-commit pulirà automaticamente il whitespace prima di ogni commit');
  console.log('💡 Per saltare il hook: git commit --no-verify');

} catch (error) {
  console.error('❌ Errore durante l\'installazione dei hooks:', error.message);
  process.exit(1);
} 