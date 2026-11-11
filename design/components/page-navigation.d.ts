export type NavigationNode = {id: string; pageId?: string; name?: string; children?: NavigationNode[]};
export type ResolvedNavigationNode = NavigationNode & {name: string; pageName: string; children: ResolvedNavigationNode[]; descendantCount: number};
export type PageNavigationOptions = {projectId: string; pages: {id: string; name: string}[]; nodes?: NavigationNode[]; activePage?: string; initialExpanded?: string[]; onSelect: (pageId: string) => void};
export function resolvePageNavigation(pages: PageNavigationOptions['pages'], nodes?: NavigationNode[]): ResolvedNavigationNode[];
export function mountPageNavigation(host: HTMLElement, options: PageNavigationOptions): {expand(ids: string[]): void; update(options: PageNavigationOptions, reveal?: boolean): void};
