import { format } from 'date-fns';

export function createMemoList(getData: () => any, getConfig: () => any) {
    const pageSize = () => getConfig().pageSize || 20;
    let visibleCount = $state(pageSize());
    let selectedTag = $state<string | null>(null);
    let selectedDate = $state<string | null>(null);

    // Derived: Get all unique tags
    const allTags = $derived.by(() => {
        const tags = new Set<string>();
        getData().memos.forEach((memo: any) => {
            memo.tags?.forEach((t: string) => tags.add(t));
        });
        return Array.from(tags).sort();
    });

    // Derived: Filter memos by tag
    const filteredMemos = $derived.by(() => getData().memos.filter((memo: any) => {
        const matchesTag = selectedTag === null || memo.tags?.includes(selectedTag);
        const matchesDate = selectedDate === null || format(new Date(memo.date), 'yyyy-MM-dd') === selectedDate;
        return matchesTag && matchesDate;
    }));

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
        visibleCount += pageSize();
    }

    function selectTag(tag: string | null) {
        selectedTag = selectedTag === tag ? null : tag;
        visibleCount = pageSize();
    }

    function selectDate(date: string) {
        selectedDate = selectedDate === date ? null : date;
        visibleCount = pageSize();
    }

    return {
        get visibleCount() { return visibleCount },
        get selectedTag() { return selectedTag },
        get selectedDate() { return selectedDate },
        get allTags() { return allTags },
        get filteredMemos() { return filteredMemos },
        get visibleMemos() { return visibleMemos },
        get groupedMemos() { return groupedMemos },
        loadMore,
        selectTag,
        selectDate
    };
}
