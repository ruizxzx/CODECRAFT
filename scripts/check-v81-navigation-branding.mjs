import fs from 'node:fs';

const files = [
  'src/components/Header.tsx',
  'src/components/CommandPalette.tsx',
  'src/components/KnowledgeView.tsx',
  'src/components/BlogView.tsx',
  'src/components/Hero.tsx',
  'src/components/PublicBlogComposer.tsx',
  'src/components/CommunityView.tsx',
  'src/components/CommunityEditor.tsx',
  'src/components/SocialHubView.tsx',
  'src/components/Footer.tsx',
  'src/App.tsx',
  'src/lib/cms.ts',
];
const missing = files.filter(f => !fs.existsSync(f));
if (missing.length) throw new Error(`Missing expected files: ${missing.join(', ')}`);

const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
const command = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const cms = fs.readFileSync('src/lib/cms.ts', 'utf8');
const knowledge = fs.readFileSync('src/components/KnowledgeView.tsx', 'utf8');

for (const label of ['Home', 'SCRPTS', 'Community', 'Explore']) {
  if (!header.includes(`label: '${label === 'SCRPTS' ? 'SCRPTS' : label}'`)) {
    throw new Error(`Primary navigation label missing: ${label}`);
  }
}
if (!header.includes('ASK OFFSCRPT')) throw new Error('Unified Ask OFFSCRPT entry missing.');
if (header.includes('<span>KNOWLEDGE</span>')) throw new Error('Legacy KNOWLEDGE primary navigation remains.');
if (header.includes('<span className="hidden sm:inline">ASK AI</span>')) throw new Error('Legacy ASK AI header label remains.');
if (!header.includes("handleNavClick('knowledge')")) throw new Error('ASK OFFSCRPT is not wired to the knowledge workspace.');
if (!header.includes('onOpenSiteAI')) throw new Error('Existing site-wide Copilot access is missing.');
if (!command.includes("label:'Open SCRPTS'")) throw new Error('Command palette SCRPTS entry missing.');
if (!command.includes("label:'Ask OFFSCRPT'")) throw new Error('Command palette Ask OFFSCRPT entry missing.');
if (!command.includes("label:'Open AI Copilot'")) throw new Error('Existing Copilot command access missing.');
if (!app.includes("hash === 'blog'")) throw new Error('Legacy /#blog compatibility missing.');
if (!cms.includes("id: 'blog', label: 'SCRPTS'")) throw new Error('Default CMS navigation is not branded SCRPTS.');
if (!knowledge.includes('ASK OFFSCRPT')) throw new Error('Knowledge workspace heading is not branded ASK OFFSCRPT.');

const userFacingLegacy = [
  'READ THE BLOG', 'WRITE A BLOG', 'EDIT BLOG', 'PUBLISH BLOG', 'UNTITLED BLOG',
  '>BLOG<', '>Blog<', 'ASK AI', '>KNOWLEDGE<', '>Knowledge<'
];
const source = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
for (const token of userFacingLegacy) {
  if (source.includes(token)) throw new Error(`Legacy user-facing token remains in navigation/branding surface: ${token}`);
}
console.log('V81 NAVIGATION/BRANDING CHECK OK — SCRPTS branding, unified Ask OFFSCRPT entry, Copilot preservation and /#blog compatibility verified.');
