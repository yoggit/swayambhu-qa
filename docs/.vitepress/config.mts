import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'swayambhu-qa',
  description: 'Agentic AI QA pipeline. Give it a ticket. Get back a passing test suite.',
  base: '/swayambhu-qa/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/swayambhu-qa/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'swayambhu-qa',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Agents', link: '/guide/agents' },
      { text: 'Reference', link: '/reference/commands' },
      { text: 'GitHub', link: 'https://github.com/yoggit/swayambhu-qa' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Installation & Setup', link: '/guide/getting-started' },
          { text: 'Your First Pipeline Run', link: '/guide/first-run' },
        ],
      },
      {
        text: 'Agents',
        items: [
          { text: 'All Agents Overview', link: '/guide/agents' },
          { text: '/qa-pipeline', link: '/guide/qa-pipeline' },
          { text: '/create-test-cases', link: '/guide/create-test-cases' },
          { text: '/generate-tests', link: '/guide/generate-tests' },
          { text: '/automate-from-tms', link: '/guide/automate-from-tms' },
          { text: '/heal-tests', link: '/guide/heal-tests' },
          { text: '/bug-to-test', link: '/guide/bug-to-test' },
          { text: '/analyze-flaky', link: '/guide/analyze-flaky' },
          { text: '/qa-report', link: '/guide/qa-report' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'Environment Variables', link: '/guide/configuration' },
          { text: 'URL Resolution', link: '/guide/url-resolution' },
          { text: 'File Source', link: '/guide/file-source' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Command Combinations', link: '/reference/commands' },
          { text: 'All Flags', link: '/reference/flags' },
          { text: 'Output Folders', link: '/reference/output' },
          { text: 'CI / GitHub Actions', link: '/reference/ci' },
          { text: 'Future Enhancements', link: '/reference/future' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yoggit/swayambhu-qa' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'swayambhu-qa — Built to show that AI agents can handle the repetitive parts of QA.',
    },

    editLink: {
      pattern: 'https://github.com/yoggit/swayambhu-qa/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
