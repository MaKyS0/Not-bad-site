import type { ToolMeta } from '../types';

export const archiveTools: ToolMeta[] = [
  {
    id: 'zip',
    name: 'ZIP Creator',
    category: 'archive',
    description: 'Create a ZIP from files and folders, or open a ZIP to add and remove files.',
    about: 'Build ZIP archives in your browser: add files or whole folders, remove entries, rename the archive and choose the compression level. You can also open an existing ZIP, change its contents and download the updated archive.',
    supportedFormats: ['*'],
    icon: 'archive',
    component: 'archive/zipCreator',
    keywords: ['zip', 'compress', 'archive', 'create zip', 'folder', 'deflate'],
    popular: true,
    batch: true,
    faq: [
      { q: 'Can I edit an existing ZIP?', a: 'Yes. Open a .zip file and its contents appear in the list; add or remove files and download the new archive.' },
      { q: 'Are encrypted ZIPs supported?', a: 'No. Creating or opening password-protected ZIP archives is not supported.' },
    ],
  },
  {
    id: 'unzip',
    name: 'ZIP Extractor',
    category: 'archive',
    description: 'Open ZIP files, browse their contents and download single files.',
    about: 'Extract ZIP archives without installing anything. See every file with its size, preview images and text, download individual files or everything at once.',
    supportedFormats: ['zip'],
    icon: 'unzip',
    component: 'archive/unzip',
    keywords: ['unzip', 'extract', 'open zip', 'decompress', 'archive'],
    popular: true,
    faq: [
      { q: 'Which archive formats are supported?', a: 'Standard ZIP files (stored and deflate compression). RAR, 7z and encrypted ZIPs are not supported.' },
    ],
  },
];
