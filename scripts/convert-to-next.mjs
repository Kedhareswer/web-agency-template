import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const sourcePath = path.join(projectRoot, 'source.html');

function escapeTemplateLiteral(value) {
  return value.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function collectMatches(content, regex) {
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match);
  }
  return matches;
}

function normalizeWhitespace(value) {
  return value.replace(/^\s+|\s+$/g, '');
}

async function main() {
  const sourceHtml = await fs.readFile(sourcePath, 'utf8');

  const titleMatch = sourceHtml.match(/<title>([\s\S]*?)<\/title>/i);
  const descriptionMatch = sourceHtml.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i);

  const styleMatches = collectMatches(sourceHtml, /<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  const cssChunks = styleMatches.map((m) => normalizeWhitespace(m[1])).filter(Boolean);

  const bodyMatch = sourceHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    throw new Error('Could not find <body> in source.html');
  }

  let bodyContent = bodyMatch[1];

  const scriptMatches = collectMatches(bodyContent, /<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  const scripts = scriptMatches.map((m, index) => {
    const attributes = m[1] ?? '';
    const content = (m[2] ?? '').trim();
    const srcMatch = attributes.match(/\ssrc=["']([^"']+)["']/i);
    const strategy = index === 0 ? 'beforeInteractive' : 'afterInteractive';

    return {
      id: `source-script-${index + 1}`,
      src: srcMatch?.[1] ?? null,
      content,
      strategy,
      isModule: /\stype=["']module["']/i.test(attributes),
      noModule: /\snomodule\b/i.test(attributes),
      async: /\sasync\b/i.test(attributes),
      defer: /\sdefer\b/i.test(attributes),
      crossOrigin: (() => {
        const match = attributes.match(/\scrossorigin(?:=["']([^"']+)["'])?/i);
        if (!match) return null;
        return match[1] || 'anonymous';
      })(),
      referrerPolicy: (() => {
        const match = attributes.match(/\sreferrerpolicy=["']([^"']+)["']/i);
        return match?.[1] ?? null;
      })(),
    };
  });

  bodyContent = bodyContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const appDir = path.join(projectRoot, 'app');
  await fs.mkdir(appDir, { recursive: true });

  const globalsCss = `${cssChunks.join('\n\n')}\n`;
  await fs.writeFile(path.join(appDir, 'globals.css'), globalsCss, 'utf8');

  const layoutTsx = `import type { Metadata } from \"next\";
import \"./globals.css\";

export const metadata: Metadata = {
  title: ${JSON.stringify(titleMatch?.[1] ?? 'Website Clone')},
  description: ${JSON.stringify(descriptionMatch?.[1] ?? 'Converted from source HTML')},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang=\"en\">
      <body>{children}</body>
    </html>
  );
}
`;

  await fs.writeFile(path.join(appDir, 'layout.tsx'), layoutTsx, 'utf8');

  const scriptImports = scripts.length ? 'import Script from "next/script";\n\n' : '';
  const scriptComponents = scripts
    .map((script) => {
      const props = [
        `id=\"${script.id}\"`,
        `strategy=\"${script.strategy}\"`,
        script.src ? `src=\"${script.src}\"` : null,
        script.isModule ? 'type=\"module\"' : null,
        script.noModule ? 'noModule' : null,
        script.async ? 'async' : null,
        script.defer ? 'defer' : null,
        script.crossOrigin ? `crossOrigin=\"${script.crossOrigin}\"` : null,
        script.referrerPolicy ? `referrerPolicy=\"${script.referrerPolicy}\"` : null,
      ]
        .filter(Boolean)
        .join(' ');

      if (script.src) {
        return `      <Script ${props} />`;
      }

      return `      <Script ${props}>{\`${escapeTemplateLiteral(script.content)}\`}</Script>`;
    })
    .join('\n');

  const pageTsx = `${scriptImports}const pageMarkup = \`${escapeTemplateLiteral(bodyContent.trim())}\`;

export default function HomePage() {
  return (
    <>
      <main suppressHydrationWarning dangerouslySetInnerHTML={{ __html: pageMarkup }} />
${scriptComponents}
    </>
  );
}
`;

  await fs.writeFile(path.join(appDir, 'page.tsx'), pageTsx, 'utf8');

  const nextConfig = `/** @type {import(\"next\").NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
`;
  await fs.writeFile(path.join(projectRoot, 'next.config.mjs'), nextConfig, 'utf8');

  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: false,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  };

  await fs.writeFile(path.join(projectRoot, 'tsconfig.json'), `${JSON.stringify(tsConfig, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(projectRoot, 'next-env.d.ts'),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited.\n',
    'utf8',
  );

  const gitignore = ['node_modules', '.next', 'out', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', '.DS_Store'].join('\n') + '\n';
  await fs.writeFile(path.join(projectRoot, '.gitignore'), gitignore, 'utf8');
}

await main();
