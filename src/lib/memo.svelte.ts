import { format } from 'date-fns';

export function createMemoList(getData: () => any, config: any) {
    let visibleCount = $state(config.pageSize || 20);
    let selectedTag = $state<string | null>(null);
    let selectedCategory = $state<string | null>(null);

    // Derived: Get all unique categories
    const allCategories = $derived.by(() => {
        const cats = new Set<string>();
        getData().memos.forEach((memo: any) => {
            if (memo.category) cats.add(memo.category);
        });
        return Array.from(cats).sort();
    });

    // Derived: Get all unique tags
    const allTags = $derived.by(() => {
        const tags = new Set<string>();
        getData().memos.forEach((memo: any) => {
            memo.tags?.forEach((t: string) => tags.add(t));
        });
        return Array.from(tags).sort();
    });

    // Derived: Filter memos by category and tag
    const filteredMemos = $derived(
        getData().memos.filter((memo: any) => {
            const matchCategory = selectedCategory === null || memo.category === selectedCategory;
            const matchTag = selectedTag === null || memo.tags?.includes(selectedTag as string);
            return matchCategory && matchTag;
        })
    );

    // Derived: Slice the memos first
    const visibleMemos = $derived(filteredMemos.slice(0, visibleCount));

    // Group memos by Date (YYYY-MM-DD)
    const groupedMemos = $derived.by(() => {
        const groups: Record<string, any[]> = {};
        visibleMemos.forEach((memo: any) => {
            const dateKey = format(memo.date, 'yyyy-MM-dd');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(memo);
        });
        return groups;
    });

    function loadMore() {
        visibleCount += (config.pageSize || 20);
    }

    function selectTag(tag: string | null) {
        selectedTag = selectedTag === tag ? null : tag;
        visibleCount = config.pageSize || 20;
    }

    function selectCategory(cat: string | null) {
        selectedCategory = selectedCategory === cat ? null : cat;
        selectedTag = null;
        visibleCount = config.pageSize || 20;
    }

    return {
        get visibleCount() { return visibleCount },
        get selectedTag() { return selectedTag },
        get selectedCategory() { return selectedCategory },
        get allCategories() { return allCategories },
        get allTags() { return allTags },
        get filteredMemos() { return filteredMemos },
        get visibleMemos() { return visibleMemos },
        get groupedMemos() { return groupedMemos },
        loadMore,
        selectTag,
        selectCategory
    };
}
