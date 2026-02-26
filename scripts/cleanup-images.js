import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const imagesDir = path.resolve('src/memos/images');
const memosDir = path.resolve('src/memos');

if (!fs.existsSync(imagesDir)) {
  console.log('Images directory does not exist. Skipping cleanup.');
  process.exit(0);
}

// 1. Get all images in the directory
const imageFiles = fs.readdirSync(imagesDir).filter(file => {
  return fs.statSync(path.join(imagesDir, file)).isFile();
});

if (imageFiles.length === 0) {
  console.log('No images found in images directory.');
  process.exit(0);
}

// 2. Get all markdown files recursively
const getMarkdownFiles = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getMarkdownFiles(file));
    } else if (file.endsWith('.md')) {
      results.push(file);
    }
  });
  return results;
};

const memoFiles = getMarkdownFiles(memosDir);

// 3. Scan all markdown files for image references
let allContent = '';
for (const file of memoFiles) {
  allContent += fs.readFileSync(file, 'utf-8');
}

// 4. Identify unused images
const unusedImages = imageFiles.filter(image => {
  // Use a simple check: is the filename present in any of the markdown content?
  // We check for the filename specifically to be flexible with paths (e.g. ./images/foo.png or images/foo.png)
  return !allContent.includes(image);
});

if (unusedImages.length === 0) {
  console.log('No unused images found.');
  process.exit(0);
}

console.log(`Found ${unusedImages.length} unused images:`);
unusedImages.forEach(img => console.log(` - ${img}`));

// 5. Remove unused images using git rm
for (const image of unusedImages) {
  const imagePath = path.join('src/memos/images', image);
  try {
    console.log(`Removing ${imagePath}...`);
    execSync(`git rm "${imagePath}"`);
  } catch (error) {
    console.error(`Failed to remove ${imagePath}: ${error.message}`);
    // Fallback to normal fs.unlink if git rm fails (e.g. file not tracked)
    try {
      fs.unlinkSync(path.join(imagesDir, image));
    } catch (e) {
      console.error(`Also failed to unlink ${imagePath}: ${e.message}`);
    }
  }
}

console.log('Cleanup completed.');
