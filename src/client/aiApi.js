export async function requestAiCompletion(fetchWithAuth, { prompt, responseFormat = 'text' }) {
    const response = await fetchWithAuth('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, responseFormat })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error || 'AI 请求失败');
    }

    return data.content || '';
}
