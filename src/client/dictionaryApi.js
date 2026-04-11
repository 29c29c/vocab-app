export async function requestDictionaryLookup(fetchWithAuth, payload) {
    const response = await fetchWithAuth('/api/dictionary/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || '词典请求失败');
    }

    return data;
}
