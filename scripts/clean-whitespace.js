#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility per pulire le righe che contengono solo spazi o tabulazioni
 * Sostituisce queste righe con righe completamente vuote
 */

// Function to recursively find all files with specific extensions
function findFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file !== 'node_modules' && file !== '.git' && file !== 'build') {
        results = results.concat(findFiles(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  });

  return results;
}

// Function to clean whitespace-only lines
function cleanWhitespaceLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let hasChanges = false;
    let whitespaceLinesCount = 0;

    const cleanedLines = lines.map(line => {
      // Check if line contains only whitespace (spaces or tabs)
      if (line.match(/^[ \t]+$/)) {
        hasChanges = true;
        whitespaceLinesCount++;
        return ''; // Replace with empty line
      }
      return line;
    });

    if (hasChanges) {
      const cleanedContent = cleanedLines.join('\n');
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      console.log(`✅ Cleaned: ${filePath} (${whitespaceLinesCount} lines)`);
      return { cleaned: true, linesCount: whitespaceLinesCount };
    }

    return { cleaned: false, linesCount: 0 };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { cleaned: false, linesCount: 0, error: true };
  }
}

// Main execution
function main() {
  console.log('🧹 Starting whitespace cleanup...\n');

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md'];
  const projectRoot = path.resolve(__dirname, '..');
  const files = findFiles(projectRoot, extensions);

  console.log(`📁 Found ${files.length} files to process...\n`);

  let cleanedCount = 0;
  let totalWhitespaceLines = 0;
  let errorCount = 0;

  files.forEach(file => {
    const result = cleanWhitespaceLines(file);
    if (result.cleaned) {
      cleanedCount++;
      totalWhitespaceLines += result.linesCount;
    }
    if (result.error) {
      errorCount++;
    }
  });

  console.log('\n📊 Summary:');
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files cleaned: ${cleanedCount}`);
  console.log(`   Total whitespace lines removed: ${totalWhitespaceLines}`);
  console.log(`   Errors: ${errorCount}`);

  if (cleanedCount > 0) {
    console.log('\n✅ Cleanup completed successfully!');
  } else {
    console.log('\n✨ No files needed cleaning - code is already clean!');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { cleanWhitespaceLines, findFiles }; 