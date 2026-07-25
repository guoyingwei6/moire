declare module 'virtual:moire-root-index' {
  type MenuItem = {
    label: string;
    icon: string;
    href: string;
    type: 'sidebar' | 'header' | 'footer';
    source: string;
    path: string;
  };

  const configuration: {
    menu: MenuItem[] | null;
    properties: Record<string, string>;
    issues: string[];
  };

  export default configuration;
}
