import fs from 'node:fs';
import path from 'node:path';
const required = [
  ['src/lib/aiTheme.ts', 'DEFAULT_AI_THEME'],
  ['src/lib/aiTheme.ts', 'saveAITheme'],
  ['src/lib/aiTheme.ts', 'applyAIThemeToDocument'],
  ['src/App.tsx', 'applyAIThemeToDocument'],
  ['src/index.css', '--ai-primary'],
  ['src/components/AdminControlPanel.tsx', 'AI CONTROL · APPEARANCE'],
  ['firestore.rules', 'isValidAITheme'],
];
for (const [file, needle] of required) {
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  if (!text.includes(needle)) throw new Error(`Missing ${needle} in ${file}`);
}
const wrappers = ['AIAssistantPanel.tsx','AIWriterAssistant.tsx','SiteAIAssistant.tsx','KnowledgeView.tsx','LearnView.tsx'];
for (const name of wrappers) {
  const text = fs.readFileSync(path.resolve('src/components', name), 'utf8');
  if (!text.includes('ai-themed')) throw new Error(`Missing ai-themed wrapper in ${name}`);
}
console.log(`V82 AI THEME CHECK OK — ${wrappers.length} core AI surfaces wrapped, central tokens/admin config/rules present.`);
