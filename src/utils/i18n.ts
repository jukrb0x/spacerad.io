export type Lang = 'en' | 'zh';

export const translations = {
  en: {
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.about': 'About',
    'nav.friends': 'Friends',
    'search.placeholder': 'Search articles...',
    'search.trigger': 'Search',
    'theme.toggle': 'Toggle theme',
    'lang.switch': '中文',
    'post.readMore': 'Read more',
    'post.tags': 'Tags',
    'post.publishedOn': 'Published on',
    'post.updatedOn': 'Updated on',
    'home.welcome': 'Welcome to Space Radio',
    'home.description': 'Calling from the universe',
    'blog.title': 'Blog',
    'blog.description': 'All articles',
    'about.title': 'About',
    'friends.title': 'Friends',
    'footer.copyright': 'All rights reserved.',
  },
  zh: {
    'nav.home': '首页',
    'nav.blog': '文章',
    'nav.about': '关于',
    'nav.friends': '友链',
    'search.placeholder': '搜索文章...',
    'search.trigger': '搜索',
    'theme.toggle': '切换主题',
    'lang.switch': 'EN',
    'post.readMore': '阅读更多',
    'post.tags': '标签',
    'post.publishedOn': '发布于',
    'post.updatedOn': '更新于',
    'home.welcome': '欢迎来到太空电台',
    'home.description': '来自宇宙的呼唤',
    'blog.title': '文章',
    'blog.description': '所有文章',
    'about.title': '关于',
    'friends.title': '友链',
    'footer.copyright': '保留所有权利。',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: Lang = 'en'): string {
  return translations[lang][key] || translations.en[key];
}

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  return lang === 'zh' ? 'zh' : 'en';
}

export function getLocalizedPath(path: string, lang: Lang): string {
  const cleanPath = path.replace(/^\/(en|zh)/, '') || '/';
  return lang === 'zh' ? `/zh${cleanPath}` : cleanPath;
}
